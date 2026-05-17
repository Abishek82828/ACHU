import Database from "better-sqlite3";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RuleName =
  | "refill"
  | "problem_to_regular"
  | "regular_to_improver"
  | "cross_sell"
  | "combo"
  | "gender"
  | "popular"
  | "cold_start_profile"
  | "cold_start_trending"
  | "collaborative"
  | "brand_affinity"
  | "bundle"
  | "semantic_similar";

interface ProductRow {
  id: number;
  pname: string;
  category: string;
  netprice: number;
  sellingprice: number;
  severity: string;
  description: string;
  image: string;
  problem_tags: string | null;
  brand: string | null;
  product_type: string | null;
  average_lifespan_days: number | null;
  skin_types: string | null;
  target_concerns: string | null;
  average_rating: number | null;
  review_count: number | null;
  stock_level: number | null;
  seasonal: string | null;
}

interface PurchasedProduct {
  id: number;
  pname: string;
  category: string;
  severity: string;
  problem_tags: string | null;
  brand: string | null;
  quantity: number;
  last_date: string;
}

interface Candidate {
  product: ProductRow;
  rawScores: Map<RuleName, number>;
  reasons: Set<string>;
  primaryRule: RuleName;
}

export interface RecommendationResult extends ProductRow {
  recommendation_rule: RuleName;
  recommendation_reason: string;
  recommendation_score: number;
}

export interface RecommendationInput {
  customerId: number;
  productId?: number;
  limit?: number;
  now?: Date;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_REFILL_DAYS = 20;

const PRODUCT_REFILL_CADENCE: Record<string, number> = {
  "Shampoo": 30, "Anti-Dandruff Shampoo": 30, "Conditioner": 45,
  "Hair Oil": 25, "Hair Mask": 60, "Hair Spray": 45, "Hair Tonic": 30,
  "Serum": 35, "Hair Color": 60, "Hair Color & Treatment": 60,
  "Toothpaste": 30, "Tooth Powder": 45, "Mouthwash": 25,
  "Tongue Cleaner": 90, "Oral Spray": 30, "Gum Treatment": 20, "Tooth Gel": 30,
  "Body Wash": 30, "Body Lotion": 45, "Body Butter": 60, "Body Oil": 40,
  "Body Mist": 30, "Body Scrub": 60, "Body Gel": 45, "Soap": 20,
  "Cleanser": 30, "Face Wash": 25, "Face Oil": 35, "Moisturizer": 45,
  "Toner": 30, "Face Pack": 30, "Face Scrub": 45, "Sunscreen": 30,
  "Facial Kit": 60, "Night Gel": 45, "Gel Moisturizer": 40,
};

const IMPROVER_THRESHOLD_DAYS = 30;
const TIME_DECAY_HALF_LIFE = 90;
const NEGATIVE_FEEDBACK_DAYS = 30;
const BUNDLE_MIN_CO_PURCHASES = 5;
const CLICK_BOOST_FACTOR = 1.2;

const RULE_PRIORITY: RuleName[] = [
  "refill", "collaborative", "bundle",
  "problem_to_regular", "regular_to_improver", "brand_affinity",
  "cold_start_profile", "gender", "cross_sell", "combo",
  "semantic_similar", "cold_start_trending", "popular",
];

const DEFAULT_RULE_WEIGHTS: Record<RuleName, number> = {
  refill: 0.28,
  collaborative: 0.22,
  problem_to_regular: 0.18,
  regular_to_improver: 0.14,
  brand_affinity: 0.14,
  cold_start_profile: 0.18,
  gender: 0.05,
  cross_sell: 0.16,
  combo: 0.14,
  bundle: 0.16,
  semantic_similar: 0.12,
  cold_start_trending: 0.10,
  popular: 0.05,
};

const CROSS_SELL_MAP: Record<string, string[]> = {
  Hair: ["Face", "Body"], Face: ["Hair", "Body"],
  Body: ["Face", "Hair"], Oral: ["Body", "Face"],
};

const FEMALE_BOOST_CATEGORIES = ["Face", "Hair"];

const SEASON_MONTH_MAP: Record<string, number[]> = {
  summer: [3, 4, 5, 6],
  monsoon: [7, 8, 9],
  winter: [10, 11, 12, 1, 2],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseTags(csv: string | null): string[] {
  return (csv ?? "").split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function getRefillDays(product: ProductRow): number {
  if (product.average_lifespan_days && product.average_lifespan_days > 0)
    return product.average_lifespan_days;
  if (product.product_type && PRODUCT_REFILL_CADENCE[product.product_type])
    return PRODUCT_REFILL_CADENCE[product.product_type];
  return DEFAULT_REFILL_DAYS;
}

function normalize(raw: number, maxRaw: number): number {
  if (maxRaw <= 0) return 0;
  return Math.min(raw / maxRaw, 1.0);
}

function timeDecay(daysSince: number): number {
  return Math.exp(-daysSince / TIME_DECAY_HALF_LIFE);
}

function getCurrentSeason(month: number): string {
  for (const [season, months] of Object.entries(SEASON_MONTH_MAP)) {
    if (months.includes(month)) return season;
  }
  return "summer";
}

function parseBudgetRange(budget: string): [number, number] {
  const clean = budget.replace(/[^0-9\-,]/g, "");
  const parts = clean.split(/[-,]/).map(Number).filter(n => !isNaN(n));
  if (parts.length >= 2) return [Math.min(parts[0], parts[1]), Math.max(parts[0], parts[1])];
  if (parts.length === 1) return [0, parts[0]];
  return [0, 99999];
}

// ---------------------------------------------------------------------------
// Thompson sampling for learned weights
// ---------------------------------------------------------------------------

function getLearnedWeights(db: Database.Database): Record<RuleName, number> {
  const weights = { ...DEFAULT_RULE_WEIGHTS };
  try {
    const rows = db.prepare("SELECT rule, alpha, beta FROM learned_rule_weights").all() as any[];
    if (rows.length === 0) return weights;

    const samples: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
      const mean = row.alpha / (row.alpha + row.beta);
      samples[row.rule] = mean;
      total += mean;
    }

    if (total > 0) {
      for (const rule of Object.keys(weights) as RuleName[]) {
        if (samples[rule] !== undefined) {
          weights[rule] = samples[rule] / total * 1.5;
        }
      }
    }
  } catch {}
  return weights;
}

export function updateLearnedWeights(db: Database.Database): void {
  try {
    const rules = db.prepare(`
      SELECT rule, COUNT(*) as impressions, SUM(converted) as conversions
      FROM recommendation_impressions
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY rule
    `).all() as any[];

    const upsert = db.prepare(`
      INSERT INTO learned_rule_weights (rule, alpha, beta, last_updated)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(rule) DO UPDATE SET alpha = ?, beta = ?, last_updated = datetime('now')
    `);

    for (const row of rules) {
      const alpha = 1 + (row.conversions || 0);
      const beta = 1 + (row.impressions - (row.conversions || 0));
      upsert.run(row.rule, alpha, beta, alpha, beta);
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Bundle detection
// ---------------------------------------------------------------------------

export function refreshBundles(db: Database.Database): void {
  try {
    const txRows = db.prepare(`
      SELECT product FROM transactions WHERE product IS NOT NULL
    `).all() as any[];

    const pairCounts = new Map<string, number>();
    for (const tx of txRows) {
      try {
        const items = JSON.parse(tx.product || "[]");
        const ids = items.map((i: any) => i.id).filter(Boolean).sort((a: number, b: number) => a - b);
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const key = `${ids[i]},${ids[j]}`;
            pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
          }
          for (let j = i + 1; j < ids.length; j++) {
            for (let k = j + 1; k < ids.length; k++) {
              const key = `${ids[i]},${ids[j]},${ids[k]}`;
              pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
            }
          }
        }
      } catch {}
    }

    db.prepare("DELETE FROM product_bundles").run();
    const ins = db.prepare(
      "INSERT INTO product_bundles (product_ids, co_purchase_count, last_updated) VALUES (?, ?, datetime('now'))"
    );
    for (const [ids, count] of pairCounts) {
      if (count >= BUNDLE_MIN_CO_PURCHASES) {
        ins.run(ids, count);
      }
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function getRecommendations(db: Database.Database, input: RecommendationInput): RecommendationResult[] {
  const now = input.now ?? new Date();
  const limit = Math.max(1, Math.min(input.limit ?? 6, 20));
  const currentMonth = now.getMonth() + 1;
  const currentSeason = getCurrentSeason(currentMonth);

  const allProducts = db.prepare("SELECT * FROM products WHERE pname != 'Debug Product'").all() as ProductRow[];
  const productById = new Map(allProducts.map(p => [p.id, p]));
  const contextProduct = input.productId ? productById.get(input.productId) : undefined;

  const candidateMap = new Map<number, Candidate>();

  // Load learned weights (Thompson sampling from conversion data)
  const RULE_WEIGHTS = getLearnedWeights(db);

  const addCandidate = (product: ProductRow, rawScore: number, rule: RuleName, reason: string) => {
    if (contextProduct && contextProduct.id === product.id) return;
    const existing = candidateMap.get(product.id);
    if (existing) {
      const prev = existing.rawScores.get(rule) ?? 0;
      existing.rawScores.set(rule, Math.max(prev, rawScore));
      existing.reasons.add(reason);
      if (RULE_PRIORITY.indexOf(rule) < RULE_PRIORITY.indexOf(existing.primaryRule)) {
        existing.primaryRule = rule;
      }
    } else {
      const scores = new Map<RuleName, number>();
      scores.set(rule, rawScore);
      candidateMap.set(product.id, {
        product, rawScores: scores, reasons: new Set([reason]), primaryRule: rule,
      });
    }
  };

  // ---- Load customer & purchase history ----
  let customer: any = null;
  let purchaseHistory: PurchasedProduct[] = [];

  if (input.customerId > 0) {
    customer = db.prepare("SELECT * FROM customers WHERE id = ?").get(input.customerId) as any;

    const txRows = db.prepare(`
      SELECT t.product, t.date FROM transactions t
      WHERE t.customer_id = ? ORDER BY t.date DESC
    `).all(input.customerId) as any[];

    const productMap = new Map<number, PurchasedProduct>();
    for (const tx of txRows) {
      try {
        const items = JSON.parse(tx.product || "[]");
        for (const item of items) {
          const p = productById.get(item.id);
          if (!p) continue;
          const existing = productMap.get(p.id);
          if (!existing || new Date(tx.date) > new Date(existing.last_date)) {
            productMap.set(p.id, {
              id: p.id, pname: p.pname, category: p.category, severity: p.severity,
              problem_tags: p.problem_tags, brand: p.brand,
              quantity: (existing?.quantity || 0) + (item.quantity || 1),
              last_date: tx.date,
            });
          } else if (existing) {
            existing.quantity += item.quantity || 1;
          }
        }
      } catch {}
    }
    purchaseHistory = [...productMap.values()].sort((a, b) =>
      new Date(b.last_date).getTime() - new Date(a.last_date).getTime()
    );
  }

  const purchasedIds = new Set(purchaseHistory.map(p => p.id));
  const isNewUser = purchaseHistory.length === 0;

  // ---- Load dismissed products (negative feedback, last 30 days) ----
  const dismissedIds = new Set<number>();
  const dismissedTags = new Set<string>();
  if (input.customerId > 0) {
    try {
      const dismissals = db.prepare(`
        SELECT product_id FROM recommendation_dismissals
        WHERE customer_id = ? AND dismissed_at >= datetime('now', '-${NEGATIVE_FEEDBACK_DAYS} days')
      `).all(input.customerId) as any[];
      for (const d of dismissals) {
        dismissedIds.add(d.product_id);
        const p = productById.get(d.product_id);
        if (p) for (const t of parseTags(p.problem_tags)) dismissedTags.add(t);
      }
    } catch {}
  }

  // ---- Load click/view signals (soft signals) ----
  const clickedProducts = new Set<number>();
  const viewedTags = new Set<string>();
  if (input.customerId > 0) {
    try {
      const clicks = db.prepare(`
        SELECT DISTINCT product_id FROM user_events
        WHERE customer_id = ? AND event_type = 'reco_click'
        AND timestamp >= datetime('now', '-30 days')
      `).all(input.customerId) as any[];
      for (const c of clicks) {
        if (c.product_id && !purchasedIds.has(c.product_id)) {
          clickedProducts.add(c.product_id);
        }
      }

      const views = db.prepare(`
        SELECT DISTINCT product_id FROM user_events
        WHERE customer_id = ? AND event_type = 'view'
        AND timestamp >= datetime('now', '-14 days')
      `).all(input.customerId) as any[];
      for (const v of views) {
        const p = productById.get(v.product_id);
        if (p) for (const t of parseTags(p.problem_tags)) viewedTags.add(t);
      }
    } catch {}
  }

  // ---- Build brand affinity map ----
  const brandPurchaseCount = new Map<string, number>();
  for (const ph of purchaseHistory) {
    if (ph.brand) {
      brandPurchaseCount.set(ph.brand, (brandPurchaseCount.get(ph.brand) || 0) + 1);
    }
  }

  // ---- Load collaborative filtering data ----
  const coPurchaseMap = new Map<number, Map<number, number>>();
  if (!isNewUser) {
    try {
      for (const purchased of purchaseHistory) {
        const coRows = db.prepare(`
          SELECT json_extract(je2.value, '$.id') as co_pid, COUNT(DISTINCT t2.customer_id) as cnt
          FROM transactions t1, json_each(t1.product) je1
          JOIN transactions t2 ON t2.customer_id != ? AND t2.id != t1.id
          JOIN json_each(t2.product) je2
          WHERE json_extract(je1.value, '$.id') = ?
            AND t1.customer_id != ?
            AND json_extract(je2.value, '$.id') != ?
          GROUP BY co_pid
          ORDER BY cnt DESC LIMIT 10
        `).all(input.customerId, purchased.id, input.customerId, purchased.id) as any[];

        for (const row of coRows) {
          if (!row.co_pid || row.cnt < 2) continue;
          if (!coPurchaseMap.has(purchased.id)) coPurchaseMap.set(purchased.id, new Map());
          coPurchaseMap.get(purchased.id)!.set(row.co_pid, row.cnt);
        }
      }
    } catch {}
  }

  // ---- Load bundles ----
  let bundles: Array<{ productIds: number[]; count: number }> = [];
  try {
    const bundleRows = db.prepare(
      "SELECT product_ids, co_purchase_count FROM product_bundles ORDER BY co_purchase_count DESC LIMIT 50"
    ).all() as any[];
    bundles = bundleRows.map(r => ({
      productIds: r.product_ids.split(",").map(Number),
      count: r.co_purchase_count,
    }));
  } catch {}

  // Helper: check if product should be penalized/excluded
  const shouldPenalize = (productId: number): number => {
    if (dismissedIds.has(productId)) return -50;
    const p = productById.get(productId);
    if (p) {
      const tags = parseTags(p.problem_tags);
      const dismissedOverlap = tags.filter(t => dismissedTags.has(t)).length;
      if (dismissedOverlap > 0) return -dismissedOverlap * 10;
    }
    return 0;
  };

  // =========================================================================
  // COLD-START: new user with no purchase history
  // =========================================================================
  if (isNewUser && input.customerId > 0 && customer) {
    const skinType = customer.skin_type ? customer.skin_type.toLowerCase() : null;
    const concerns = parseTags(customer.concerns);
    const preferredCats = parseTags(customer.preferred_categories);
    const budget = customer.budget_range;

    if (skinType || concerns.length > 0 || preferredCats.length > 0) {
      for (const product of allProducts) {
        if (dismissedIds.has(product.id)) continue;
        let matchScore = 0;
        const matchReasons: string[] = [];

        if (skinType) {
          const prodSkinTypes = parseTags(product.skin_types);
          if (prodSkinTypes.includes(skinType)) {
            matchScore += 40;
            matchReasons.push(`matches your ${skinType} skin type`);
          }
        }

        if (concerns.length > 0) {
          const prodConcerns = parseTags(product.target_concerns);
          const prodTags = parseTags(product.problem_tags);
          const allProdTags = [...new Set([...prodConcerns, ...prodTags])];
          const overlap = concerns.filter(c => allProdTags.includes(c));
          if (overlap.length > 0) {
            matchScore += 30 + overlap.length * 10;
            matchReasons.push(`targets ${overlap[0].replace(/-/g, " ")}`);
          }
        }

        if (preferredCats.length > 0 && preferredCats.includes(product.category.toLowerCase())) {
          matchScore += 20;
        }

        if (budget && product.netprice) {
          const [lo, hi] = parseBudgetRange(budget);
          if (product.netprice >= lo && product.netprice <= hi) matchScore += 10;
        }

        matchScore += (product.average_rating ?? 0) * 3;

        // Seasonal boost for cold-start too
        if (product.seasonal) {
          const prodSeasons = parseTags(product.seasonal);
          if (prodSeasons.includes(currentSeason)) matchScore += 15;
        }

        if (matchScore > 10) {
          const reason = matchReasons.length > 0
            ? `Picked for you — ${matchReasons[0]}.`
            : `Recommended based on your profile.`;
          addCandidate(product, matchScore, "cold_start_profile", reason);
        }
      }
    }

    // Trending products
    const trendingRows = db.prepare(`
      SELECT json_extract(je.value, '$.id') as pid, COUNT(*) as cnt
      FROM transactions t, json_each(t.product) je
      WHERE t.date >= datetime('now', '-30 days')
      GROUP BY pid ORDER BY cnt DESC LIMIT 20
    `).all() as any[];

    for (let i = 0; i < trendingRows.length; i++) {
      const product = productById.get(trendingRows[i].pid);
      if (!product || dismissedIds.has(product.id)) continue;
      const trendScore = 50 - i * 2 + Math.min(trendingRows[i].cnt * 3, 30);
      addCandidate(product, trendScore, "cold_start_trending",
        `Trending — bought ${trendingRows[i].cnt} times this month.`);
    }

    if (customer.gender === 1) {
      for (const product of allProducts) {
        if (FEMALE_BOOST_CATEGORIES.includes(product.category) && !dismissedIds.has(product.id)) {
          addCandidate(product, 25, "gender", `Recommended for you based on your profile.`);
        }
      }
    }
  }

  // =========================================================================
  // RETURNING USER RULES
  // =========================================================================
  if (!isNewUser) {
    // --- RULE 1: Refill Reminders (with time-decay) ---
    for (const purchased of purchaseHistory) {
      const product = productById.get(purchased.id);
      if (!product) continue;
      const refillDays = getRefillDays(product);
      const daysSince = daysBetween(new Date(purchased.last_date), now);
      if (daysSince >= refillDays) {
        const urgency = Math.min(daysSince - refillDays, 40);
        const decay = timeDecay(daysSince);
        const rawScore = (100 + urgency) * decay;
        addCandidate(product, rawScore, "refill",
          `You bought ${product.pname} ${daysSince} days ago — time for a refill!`);
      }
    }

    // --- RULE 2: Collaborative filtering ("Customers also bought") ---
    for (const [purchasedId, coProducts] of coPurchaseMap) {
      const purchasedProduct = productById.get(purchasedId);
      if (!purchasedProduct) continue;
      for (const [coPid, count] of coProducts) {
        if (purchasedIds.has(coPid) || dismissedIds.has(coPid)) continue;
        const coProduct = productById.get(coPid);
        if (!coProduct) continue;
        const rawScore = 60 + Math.min(count * 8, 40);
        addCandidate(coProduct, rawScore, "collaborative",
          `Customers who bought ${purchasedProduct.pname} also bought this.`);
      }
    }

    // --- RULE 3: Problem product → Regular (TAG-WEIGHTED + PRODUCT-TYPE DIVERSITY) ---
    for (const purchased of purchaseHistory) {
      if (purchased.severity !== "High Severity") continue;
      const daysSince = daysBetween(new Date(purchased.last_date), now);
      const decay = timeDecay(daysSince);
      const purchasedTags = parseTags(purchased.problem_tags);
      const purchasedProduct = productById.get(purchased.id);
      const purchasedType = purchasedProduct?.product_type ?? null;

      const scored: Array<{ p: ProductRow; overlap: number; score: number }> = [];
      for (const alt of allProducts) {
        if (alt.category !== purchased.category) continue;
        if (purchasedIds.has(alt.id) || dismissedIds.has(alt.id)) continue;
        if (alt.severity === "High Severity") continue;

        const altTags = parseTags(alt.problem_tags);
        const overlap = purchasedTags.filter(t => altTags.includes(t)).length;

        let rawScore = overlap > 0 ? 70 + overlap * 25 : 30;
        rawScore += Math.min(daysSince, 30);
        rawScore *= decay;

        if (purchasedType && alt.product_type && alt.product_type !== purchasedType) rawScore += 15;
        if (alt.severity === "Regular") rawScore += 5;

        if (purchasedProduct && purchasedProduct.netprice > 0 && alt.netprice > 0) {
          const ratio = alt.netprice / purchasedProduct.netprice;
          if (ratio > 0.4 && ratio < 2.5) rawScore += 3;
        }

        scored.push({ p: alt, overlap, score: rawScore });
      }

      scored.sort((a, b) => b.score - a.score);
      const seenTypes = new Set<string>();
      let added = 0;
      for (const { p, overlap, score } of scored) {
        if (added >= 4) break;
        const t = p.product_type ?? "_unknown";
        if (seenTypes.has(t)) continue;
        seenTypes.add(t);
        const sharedTag = overlap > 0
          ? (purchasedTags.find(tag => parseTags(p.problem_tags).includes(tag)) || "")
          : "";
        const reason = sharedTag
          ? `Pairs with ${purchased.pname} — targets ${sharedTag.replace(/-/g, " ")}${overlap > 1 ? ` (+${overlap - 1} more)` : ""}.`
          : `Complete your ${purchased.category.toLowerCase()} routine with ${p.pname}.`;
        addCandidate(p, score, "problem_to_regular", reason);
        added++;
      }
    }

    // --- RULE 4: Regular → Improver (TAG-RELEVANT ONLY) ---
    for (const purchased of purchaseHistory) {
      if (purchased.severity !== "Regular") continue;
      const daysSince = daysBetween(new Date(purchased.last_date), now);
      if (daysSince < IMPROVER_THRESHOLD_DAYS) continue;

      const purchasedTags = parseTags(purchased.problem_tags);
      const scored: Array<{ p: ProductRow; overlap: number; score: number }> = [];
      for (const imp of allProducts) {
        if (imp.category !== purchased.category || imp.severity !== "Improver") continue;
        if (purchasedIds.has(imp.id) || dismissedIds.has(imp.id)) continue;
        const overlap = purchasedTags.filter(t => parseTags(imp.problem_tags).includes(t)).length;
        if (purchasedTags.length > 0 && overlap === 0) continue;
        const rawScore = (70 + overlap * 15 + Math.min(daysSince - 30, 20)) * timeDecay(daysSince);
        scored.push({ p: imp, overlap, score: rawScore });
      }
      scored.sort((a, b) => b.score - a.score);
      for (const { p, score } of scored.slice(0, 2)) {
        addCandidate(p, score, "regular_to_improver",
          `You've been using ${purchased.pname} for ${daysSince} days — try ${p.pname} for an upgrade.`);
      }
    }

    // --- RULE 5: Brand affinity ---
    for (const [brand, count] of brandPurchaseCount) {
      if (count < 2) continue;
      const brandBoost = Math.min(count * 10, 30);
      for (const product of allProducts) {
        if (product.brand !== brand) continue;
        if (purchasedIds.has(product.id) || dismissedIds.has(product.id)) continue;
        const rawScore = 50 + brandBoost + (product.average_rating ?? 0) * 3;
        addCandidate(product, rawScore, "brand_affinity",
          `You love ${brand} — try ${product.pname}.`);
      }
    }

    // --- RULE 6: Gender-based ---
    const purchasedCats = new Set(purchaseHistory.map(p => p.category));
    if (customer && customer.gender === 1) {
      for (const product of allProducts) {
        if (!FEMALE_BOOST_CATEGORIES.includes(product.category)) continue;
        if (purchasedIds.has(product.id) || dismissedIds.has(product.id)) continue;
        const score = purchasedCats.has(product.category) ? 15 : 30;
        addCandidate(product, score, "gender", `Popular with shoppers like you.`);
      }
    }

    // --- RULE 7: Cross-sell (TAG-AWARE) ---
    const purchasedCategoriesSet = new Set(purchaseHistory.map(p => p.category));
    const allPurchasedTags = new Set<string>();
    for (const ph of purchaseHistory) {
      for (const t of parseTags(ph.problem_tags)) allPurchasedTags.add(t);
    }

    for (const cat of purchasedCategoriesSet) {
      const targets = CROSS_SELL_MAP[cat] || [];
      for (const targetCat of targets) {
        if (purchasedCategoriesSet.has(targetCat)) continue;
        const scored: Array<{ p: ProductRow; score: number }> = [];
        for (const c of allProducts) {
          if (c.category !== targetCat) continue;
          if (purchasedIds.has(c.id) || dismissedIds.has(c.id)) continue;
          if (c.severity === "High Severity") continue;
          const candTags = parseTags(c.problem_tags);
          const tagBoost = candTags.filter(t => allPurchasedTags.has(t)).length * 12;
          const ratingBoost = (c.average_rating ?? 4) * 2;
          scored.push({ p: c, score: 70 + tagBoost + ratingBoost });
        }
        scored.sort((a, b) => b.score - a.score);
        for (const { p, score } of scored.slice(0, 3)) {
          addCandidate(p, score, "cross_sell",
            `You shop ${cat} — explore ${targetCat} care with ${p.pname}.`);
        }
      }
    }

    // --- RULE 8: Bundle recommendations ("missing piece") ---
    for (const bundle of bundles) {
      const owned = bundle.productIds.filter(id => purchasedIds.has(id));
      const missing = bundle.productIds.filter(id => !purchasedIds.has(id) && !dismissedIds.has(id));
      if (owned.length >= 1 && missing.length >= 1 && missing.length <= 2) {
        for (const missingId of missing) {
          const product = productById.get(missingId);
          if (!product) continue;
          const ownedNames = owned.map(id => productById.get(id)?.pname).filter(Boolean);
          const rawScore = 65 + bundle.count * 3;
          addCandidate(product, rawScore, "bundle",
            `Complete your set — customers who bought ${ownedNames[0]} usually also get this.`);
        }
      }
    }
  }

  // --- RULE 9: Combo offers (context product page) ---
  if (contextProduct) {
    const sameCategory = allProducts.filter(p =>
      p.category === contextProduct.category && p.id !== contextProduct.id
      && !purchasedIds.has(p.id) && !dismissedIds.has(p.id)
    );
    for (const combo of sameCategory.slice(0, 3)) {
      addCandidate(combo, 70, "combo",
        `Pairs great with ${contextProduct.pname} for a complete ${contextProduct.category} routine.`);
    }

    const problemOverlap = parseTags(contextProduct.problem_tags);
    if (problemOverlap.length > 0) {
      for (const product of allProducts) {
        if (product.id === contextProduct.id || purchasedIds.has(product.id) || dismissedIds.has(product.id)) continue;
        const tags = parseTags(product.problem_tags);
        const overlap = tags.filter(t => problemOverlap.includes(t));
        if (overlap.length > 0) {
          addCandidate(product, 75 + overlap.length * 5, "combo",
            `Also targets ${overlap[0].replace(/-/g, " ")} — use together for better results.`);
        }
      }
    }

    if (contextProduct.brand) {
      const sameBrand = allProducts.filter(p =>
        p.brand === contextProduct.brand && p.id !== contextProduct.id
        && !purchasedIds.has(p.id) && !dismissedIds.has(p.id)
      );
      for (const bp of sameBrand.slice(0, 3)) {
        addCandidate(bp, 60, "combo",
          `More from ${contextProduct.brand} — pairs well with ${contextProduct.pname}.`);
      }
    }
  }

  // --- RULE 10: Popular fallback ---
  const popularProducts = allProducts
    .filter(p => !purchasedIds.has(p.id) && !dismissedIds.has(p.id)
      && !(contextProduct && p.id === contextProduct.id))
    .sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0))
    .slice(0, Math.max(limit * 2, 10));
  for (const p of popularProducts) {
    addCandidate(p, 30, "popular", "Popular with shoppers right now.");
  }

  // =========================================================================
  // NORMALIZE + WEIGHT → hybrid score
  // =========================================================================
  const maxPerRule = new Map<RuleName, number>();
  for (const c of candidateMap.values()) {
    for (const [rule, score] of c.rawScores) {
      maxPerRule.set(rule, Math.max(maxPerRule.get(rule) ?? 0, score));
    }
  }

  const scored: Array<{ candidate: Candidate; finalScore: number }> = [];
  for (const c of candidateMap.values()) {
    let finalScore = 0;
    for (const [rule, raw] of c.rawScores) {
      const maxRaw = maxPerRule.get(rule) ?? 1;
      const normalized = normalize(raw, maxRaw);
      const weight = RULE_WEIGHTS[rule] ?? 0.05;
      finalScore += normalized * weight;
    }

    // Click boost: products the user clicked but didn't buy get a 1.2x multiplier
    if (clickedProducts.has(c.product.id)) {
      finalScore *= CLICK_BOOST_FACTOR;
    }

    // Viewed-tag boost: products matching recently viewed tags get a small boost
    if (viewedTags.size > 0) {
      const productTags = parseTags(c.product.problem_tags);
      const viewOverlap = productTags.filter(t => viewedTags.has(t)).length;
      if (viewOverlap > 0) finalScore += viewOverlap * 0.03;
    }

    // Seasonal boost
    if (c.product.seasonal) {
      const prodSeasons = parseTags(c.product.seasonal);
      if (prodSeasons.includes(currentSeason)) finalScore += 0.08;
    }

    // Negative feedback penalty
    const penalty = shouldPenalize(c.product.id);
    if (penalty < 0) finalScore += penalty * 0.01;

    // Small stock/rating tiebreaker
    const ratingBonus = ((c.product.average_rating ?? 0) / 5) * 0.02;
    const stockPenalty = (c.product.stock_level ?? 100) <= 0 ? -0.5 : 0;
    finalScore += ratingBonus + stockPenalty;

    scored.push({ candidate: c, finalScore });
  }

  // --- Sort & diversify ---
  const sorted = scored.sort((a, b) => b.finalScore - a.finalScore);
  const maxPerCategory = !isNewUser ? Math.max(2, Math.ceil(limit * 0.5)) : limit;
  const perCatCount = new Map<string, number>();
  const primary: typeof sorted = [];
  const overflow: typeof sorted = [];

  for (const item of sorted) {
    const cat = item.candidate.product.category;
    const count = perCatCount.get(cat) ?? 0;
    if (count < maxPerCategory) {
      primary.push(item);
      perCatCount.set(cat, count + 1);
    } else {
      overflow.push(item);
    }
    if (primary.length >= limit) break;
  }
  while (primary.length < limit && overflow.length > 0) {
    primary.push(overflow.shift()!);
  }

  return primary
    .slice(0, limit)
    .map(({ candidate: c, finalScore }) => ({
      ...c.product,
      recommendation_rule: c.primaryRule,
      recommendation_reason: [...c.reasons][0],
      recommendation_score: Number((finalScore * 100).toFixed(1)),
    }));
}
