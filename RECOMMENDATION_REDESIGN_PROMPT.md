# Recommendation System Redesign

## 0. Reality Check — Current State

Before redesigning, anchor on what actually exists. The previous version of this doc made several wrong assumptions; the redesign must work against the real schema.

### Actual `verdant.db` schema (SQLite, AUTOINCREMENT IDs)

```sql
customers(id, cname, gender INTEGER 0|1, pno, email, password, amountspent, revenue, created_at)
products(id, pname, netprice, sellingprice, category CHECK IN ('Oral','Body','Hair','Face'),
         severity CHECK IN ('Regular','High Severity','Improver'), description, image, problem_tags)
transactions(id, customer_id, tname, amount, count, product TEXT /* JSON array of {id,quantity,price} */, discount, date)
model(id, customer_id, transaction_id, problem, recommendedproduct, lastpurchased, created_at)
log(id, transaction_id, customer_id, recommendation_sent, product_purchased, created_at)
```

Key facts the redesign must respect:
- `gender` is `INTEGER` (0 = Male, 1 = Female), not a string. The engine at [backend/recommendationEngine.ts:178](backend/recommendationEngine.ts:178) already uses `customer.gender === 1`.
- **There is no `transaction_items` table.** Line items live as a JSON blob inside `transactions.product`. Any new query that wants per-product purchase history must `JSON.parse` that column (or use SQLite's `json_each`).
- `model` and `log` already exist and are partially wired for feedback: `log.recommendation_sent` and `log.product_purchased` are written on every purchase ([server.ts:212](server.ts:212)). The redesign should extend these, not invent a parallel table.
- `problem_tags` is a comma-separated TEXT column. The current engine splits and lowercases it ([backend/recommendationEngine.ts:60](backend/recommendationEngine.ts:60)).
- Product naming is `pname` / `netprice` / `sellingprice` — **do not rename** these. The engine, frontend, and seed scripts all depend on these names.
- SQLite **does not support** `ALTER TABLE ADD COLUMN IF NOT EXISTS`. Migrations must check `PRAGMA table_info(<table>)` and add columns conditionally.

### Actual catalog state (as of this writing)
- 51 products total — 50 Hair (just seeded via [scripts/insert_hair_products.mjs](scripts/insert_hair_products.mjs)) + 1 debug.
- **0 products in Face, Body, Oral.** Any cross-category logic (cross-sell, gender-boost into Face) currently has no candidates. The redesign should be testable against Hair alone, then degrade gracefully when other categories are empty.

### Existing rule engine ([backend/recommendationEngine.ts](backend/recommendationEngine.ts))
- 7 rules in `RULE_PRIORITY`: `refill | problem_to_regular | regular_to_improver | gender | cross_sell | combo | popular`.
- Scores are additive with no normalization; final sort by raw score.
- Refill threshold: 20 days for all products. Improver threshold: 30 days.
- `getRecommendations()` is synchronous, hits the DB on every call, no caching.

### Existing endpoints in [server.ts](server.ts)
```
POST /api/register, /api/login
GET  /api/user/:id, /api/user/:id/history
GET  /api/products, /api/products/:id, /api/search
POST /api/purchase                          (writes transactions + log)
POST /api/notifications/product             (SMS/email/call)
POST /api/debug/notifications/master
POST /api/debug/recommendation/simulate-days
GET  /api/recommendations/:customer_id
GET  /api/dashboard
```

---

## 1. Goals & Non-Goals

**Goals**

**Non-goals (explicitly out of scope for v2)**
- Real collaborative filtering with matrix factorization. With <100 customers and ~50 SKUs, MF will overfit. Use item co-occurrence instead and revisit once data > 1k customers.
- Real-time streaming / Kafka. A synchronous engine + 5-minute in-memory cache is enough.
- LLM-based reranking. Save for v3.
- Replacing SQLite. The hybrid engine fits in SQL + JS for this catalog size.

---

## 2. Schema Migrations

All migrations go in a new `backend/migrations.ts` invoked on server boot, idempotent via `PRAGMA table_info`.

### 2.1 New columns on `products`
```sql
-- run only if column missing
ALTER TABLE products ADD COLUMN average_lifespan_days INTEGER;   -- per-SKU refill cadence
ALTER TABLE products ADD COLUMN skin_types TEXT;                  -- JSON: ["oily","dry","combination","sensitive","normal"]
ALTER TABLE products ADD COLUMN target_concerns TEXT;             -- JSON: standardized concern tags
ALTER TABLE products ADD COLUMN ingredients TEXT;                 -- JSON: standardized ingredient tags
ALTER TABLE products ADD COLUMN seasonal TEXT;                    -- 'spring'|'summer'|'fall'|'winter'|'all-year'
ALTER TABLE products ADD COLUMN average_rating REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN review_count INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN stock_level INTEGER DEFAULT 100;
ALTER TABLE products ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
```

**Backfill plan** (one-shot script `scripts/backfill_product_attributes.mjs`):
- `average_lifespan_days`: derive from category + size hints in `pname` (e.g. "Shampoo" → 35, "Hair Oil" → 60, "Conditioner" → 40, "Hair Mask" → 90, default 45). Document the lookup table in the script.
- `target_concerns`: map from existing `problem_tags` using the controlled vocabulary in §6. E.g. `hair-fall` → `hairfall`, `dandruff` → `dandruff`, `dry-hair` → `dryness`.
- `ingredients`: keyword-extract from `pname` + `description` against the vocab in §6 (`bhringraj`, `onion`, `amla`, `neem`, `tea-tree`, etc.).
- `skin_types`: leave NULL for Hair products; populate when Face/Body SKUs are added.
- `seasonal`: default `'all-year'` for everything.
- `stock_level`: 100 for all (placeholder until inventory integration).

### 2.2 New columns on `customers`
```sql
ALTER TABLE customers ADD COLUMN skin_type TEXT;
ALTER TABLE customers ADD COLUMN concerns TEXT;              -- JSON array
ALTER TABLE customers ADD COLUMN budget_range TEXT;          -- 'budget'|'mid'|'premium'
ALTER TABLE customers ADD COLUMN preferred_categories TEXT;  -- JSON array
ALTER TABLE customers ADD COLUMN age_range TEXT;
ALTER TABLE customers ADD COLUMN onboarding_completed INTEGER DEFAULT 0;
```

### 2.3 New tables
```sql
CREATE TABLE IF NOT EXISTS user_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('view','add_to_cart','wishlist','search','purchase','reco_impression','reco_click')),
  product_id INTEGER,
  search_query TEXT,
  metadata TEXT,    -- JSON, e.g. {"rule":"refill","score":0.83,"position":2}
  timestamp TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(customer_id) REFERENCES customers(id),
  FOREIGN KEY(product_id) REFERENCES products(id)
);
CREATE INDEX idx_user_events_customer_time ON user_events(customer_id, timestamp DESC);
CREATE INDEX idx_user_events_product_time ON user_events(product_id, timestamp DESC);
CREATE INDEX idx_user_events_type ON user_events(event_type, timestamp DESC);
```

A separate `recommendation_feedback` table is **not needed** — joining `user_events` (where `event_type IN ('reco_impression','reco_click')`) with the existing `transactions.product` JSON gives the same conversion signal, with one fewer table to keep in sync.

### 2.4 Reusing existing `log` table
Continue to write `log.recommendation_sent = 1` whenever a reco surface renders. The new `user_events` rows are more granular (per product, per rule); `log` becomes the per-transaction rollup. Keep both — they answer different questions.

---

## 3. Hybrid Ranker

### 3.1 Per-component scores (all normalized to [0, 1])

| Component | Formula | Notes |
|---|---|---|
| `content_match` | Jaccard(user.concerns ∪ user.skin_type, product.target_concerns ∪ product.skin_types) | 0 when user profile missing → falls back to gender prior |
| `collaborative` | item-item co-occurrence: max over j∈user_history of `count(i,j) / sqrt(count(i)·count(j))` | Built nightly from `transactions.product` JSON via `json_each`. Cached in-memory. |
| `behavioral` | exponentially-decayed event count: `Σ w(event_type) · exp(-Δt / τ)` then squashed via `x/(x+1)` | τ = 7 days. Weights: view 1, search 2, add_to_cart 5, wishlist 3. |
| `seasonality` | 1.0 if product.seasonal matches current season OR `'all-year'`, else 0.3 | Cheap multiplier. |
| `popularity_decay` | `log(1 + purchases_last_30d) / log(1 + max_purchases_last_30d)` | Prevents always-top-seller bias by capping with log. |
| `price_alignment` | 1 - \|product_segment_idx - user_budget_idx\| / 2 over segments {budget, mid, premium} | Segment thresholds: budget < 300, mid 300–700, premium > 700 (₹). |

Segment thresholds are configurable in `backend/config.ts` — do not hardcode in the ranker.

### 3.2 Final score
```ts
score = 0.25*content + 0.20*collab + 0.20*behavioral + 0.10*seasonal + 0.15*popularity + 0.10*price
```
Weights MUST live in a single `WEIGHTS` constant in `backend/config.ts` so A/B variants can override them per request via a `?variant=` query param without code changes.

### 3.3 Knowledge rules are **boosters, not gates**
The existing rule logic (refill, severity progression, combo) becomes a set of additive boosts on top of the hybrid score:

| Rule | Boost | Trigger |
|---|---|---|
| Refill due | +0.30 | `days_since_purchase >= product.average_lifespan_days` |
| Refill overdue | +0.10 per 10 days past, cap +0.30 | Stacks with above. |
| Severity progression | +0.15 | User bought High-Severity in this category > 14 days ago, candidate is Regular same category. |
| Improver upgrade | +0.10 | User on Regular > 30 days, candidate is Improver same category. |
| Combo (context product set) | +0.20 | Overlap ≥ 2 problem_tags with the product currently being viewed. |
| Out-of-stock | × 0 | Hard filter. |
| Already in cart | × 0 | Hard filter. |
| Purchased < refill window | × 0 | Hard filter. |

This keeps the explainability of rules (the `recommendation_reason` string still works) while moving the **ordering** decision to the learned-ish hybrid score.

### 3.4 Diversity guardrail (MMR-lite)
After scoring, apply a greedy diversity pass before returning the top-N:
```
result = []
remaining = candidates sorted by score desc
while len(result) < N and remaining:
  pick = argmax over remaining of score(c) - λ · max_jaccard(c.tags, r.tags for r in result)
  λ = 0.3
  result.append(pick); remaining.remove(pick)
```
Prevents 6 near-identical shampoos in a row, which the current additive engine produces routinely.

---

## 4. Cold Start

### 4.1 Onboarding quiz (5 questions, skippable)
1. Primary concern (multi-select from §6 vocab)
2. Hair/Skin type
3. Budget (budget / mid / premium)
4. Preferred categories
5. Age range

Persist to the new `customers` columns; set `onboarding_completed = 1`. Stored profile then powers `content_match` from request #1.

### 4.2 Pre-quiz fallback
If `onboarding_completed = 0` AND `purchase_count = 0`:
- Show one product per category that is the **highest-popularity Regular-severity SKU**.
- Surface the quiz CTA above the grid.
- Track `event_type = 'view'` so behavioral signal starts accumulating immediately.

### 4.3 Few-shot (1–2 transactions)
Collaborative co-occurrence is unreliable with one purchase. Weight `collab = 0` and renormalize the remaining 5 components to sum to 1.0 until `purchase_count >= 3`.

---

## 5. API Surface

Only **additive** changes — existing endpoints keep their contracts.

```
POST   /api/customers/:id/profile           { skin_type?, concerns?, budget_range?, preferred_categories?, age_range? }
GET    /api/customers/:id/profile

POST   /api/events                          { customer_id, event_type, product_id?, search_query?, metadata? }
                                            Fire-and-forget; returns 202 immediately.

GET    /api/recommendations/:customer_id
        ?limit=6
        &context_product_id=:id             // for combo boosts on PDP
        &exclude_category=Oral
        &price_max=500
        &variant=A|B                        // for weight-set A/B test
        Response items now include:
          { ...product, recommendation_rule, recommendation_reason,
            recommendation_score, score_breakdown: {content, collab, behavioral, seasonal, popularity, price, rule_boost} }

GET    /api/analytics/recommendations
        ?from=YYYY-MM-DD&to=YYYY-MM-DD
        Returns { impressions, clicks, conversions, ctr, cvr, by_rule: [...] }
```

### 5.1 Impression logging
Inside `GET /api/recommendations/:customer_id`, after building the result list, write one `user_events` row per returned item with `event_type='reco_impression'` and `metadata={rule, score, position}`. This is what powers offline eval (§7).

---

## 6. Controlled Vocabularies

Live in `backend/validators.ts`. All inputs to profile / event endpoints are validated against these — unknown values rejected with 400.

```ts
export const CONCERNS = [
  'acne','dandruff','hairfall','dryness','oiliness','sensitivity',
  'aging','pigmentation','dullness','flakiness','frizz','grey-hair',
  'thin-hair','damaged-hair','itchy-scalp'
] as const;

export const SKIN_TYPES = ['oily','dry','combination','sensitive','normal'] as const;

export const PRICE_SEGMENTS = ['budget','mid','premium'] as const;

export const INGREDIENTS = [
  'neem','aloe','tea-tree','vitamin-c','salicylic-acid','hyaluronic-acid',
  'retinol','coconut','biotin','bhringraj','onion','amla','hibiscus',
  'rosemary','argan','castor','shikakai','henna','indigo','brahmi'
] as const;

export const SEASONS = ['spring','summer','fall','winter','all-year'] as const;
```

A mapping table `LEGACY_TAG_MAP` translates the existing `problem_tags` CSV values to the canonical set above. Reject ingestion of any new product whose `problem_tags` contain values outside the legacy map until the catalog is fully normalized.

---

## 7. Evaluation

### 7.1 Offline metrics (run weekly, output to console + `analytics_runs.json`)
Compute against the last 30 days of `user_events` + `transactions`:
- **Precision@6**: of the 6 recommended, how many did the user purchase within 14 days?
- **Recall@6**: of products the user actually purchased in the window, how many appeared in their reco list?
- **MAP@6**: mean average precision, rewards ranking conversions near the top.
- **Catalog coverage**: % of SKUs that appeared in any reco list. Target > 60% — a tell for filter-bubble collapse.
- **Per-rule CVR**: conversions / impressions, segmented by `metadata.rule`. Disable any rule with CVR < 1% over ≥ 200 impressions.

Implementation: `scripts/eval_recommender.mjs` that replays history without writing to the DB.

### 7.2 Online A/B
- Bucket users by `customer_id % 10`. Buckets 0–4 → variant A (current weights), 5–9 → variant B (challenger).
- Stamp the variant onto every `reco_impression` event in `metadata.variant`.
- Compare CVR + AOV across buckets after ≥ 2k impressions per arm.

---

## 8. Caching & Performance

- Build the item-item co-occurrence matrix once per server boot (and on a 1-hour timer). Store as `Map<productId, Map<productId, number>>` in module scope. Catalog of 51 × 51 is trivial; will scale to ~5k SKUs before this becomes a concern.
- Per-user reco list cached in-memory with 5-minute TTL keyed on `(customer_id, variant, limit, context_product_id)`. Invalidate on any incoming `user_events` write for that user.
- Every query that scans `transactions.product` JSON must go through a single helper `getCustomerPurchaseHistory(db, customerId)` that's also memoized for the request lifetime — current code re-parses JSON multiple times per recommendation call.

---

## 9. Frontend Hooks (minimum viable)

The redesign isn't done when the engine compiles. Three frontend tasks are part of v2 scope:

1. **Onboarding modal** triggered on first dashboard visit when `onboarding_completed === 0`. Submits to `POST /api/customers/:id/profile`.
2. **Behavioral tracking** — a tiny `useTrackEvent(eventType, productId)` hook fired from product cards (`view` on intersection-observer entry) and PDP (`add_to_cart`, `wishlist`). Debounced to one `view` per product per session.
3. **Reco list rendering** — show `recommendation_reason` as a chip beneath each card so the explainability isn't lost; the previous design hid it.

---

## 10. Phased Rollout (by PR, not by week)

| PR | Scope | Risk | Rollback |
|---|---|---|---|
| 1 | `migrations.ts` + new columns/tables + backfill script | Low — additive only | Drop columns / tables |
| 2 | `validators.ts` + `POST /api/customers/:id/profile` + onboarding modal | Low | Hide modal, keep route |
| 3 | `POST /api/events` + frontend tracking hook | Low | Stop firing client-side |
| 4 | Hybrid ranker behind feature flag `RECO_V2=false`, defaults off | Medium — new code path | Flip flag |
| 5 | Impression logging in `GET /api/recommendations` | Low | Flip flag |
| 6 | Enable `RECO_V2=true` for `customer_id % 10 >= 5` | Medium | Flip flag |
| 7 | Eval script + `/api/analytics/recommendations` dashboard | Low | n/a |
| 8 | Full rollout: `RECO_V2=true` for all, archive old engine | Low if PR 6 metrics hold | Re-flip flag |

The flag check lives at the top of the request handler, not deep inside the engine — that way the old code path stays untouched and a single env var change reverts the system end-to-end.

---

## 11. Worked Example

User #42: `gender=1`, `skin_type=null`, `concerns=["hairfall","dryness"]`, `budget=mid`, completed onboarding 3 days ago, purchased "Bio Bhringraj Therapeutic Hair Oil" (₹349, High-Severity, `bhringraj,hair-fall,scalp-care,weak-roots`) 25 days ago. Has viewed "Onion Shampoo" and "Tea Tree Shampoo" 4 times in the last 2 days.

Candidate: **Amla & Bhringraj Shampoo** (₹349, High-Severity, `hair-fall,amla,bhringraj,scalp-care`)

| Component | Value | Math |
|---|---|---|
| content_match | 0.50 | concerns ∩ target_concerns = {hairfall} of {hairfall, dryness, scalp-care, weak-roots} ≈ 0.25; +0.25 ingredient overlap (bhringraj) |
| collab | 0.62 | 9 of 14 users who bought the Bhringraj oil also bought this shampoo |
| behavioral | 0.41 | 4 views of shampoo SKUs in last 2 days, τ=7 → raw 3.1 → 3.1/4.1 = 0.76 × concern-match factor 0.55 |
| seasonal | 1.00 | `all-year` |
| popularity | 0.55 | mid-popularity in the 30-day window |
| price | 1.00 | mid-budget user, mid-segment product (₹349) |
| Base score | **0.604** | 0.25·0.50 + 0.20·0.62 + 0.20·0.41 + 0.10·1.0 + 0.15·0.55 + 0.10·1.0 |
| Rule boosts | +0.15 | Severity progression (High → would normally suggest Regular, but here same severity so this boost does NOT apply — drop it) |
| **Final** | **0.604** | Strong; ranks above the popular-fallback baseline of ~0.30 |

The `score_breakdown` is returned to the client so the analytics dashboard can show *why* each item was chosen — critical for debugging "this reco doesn't make sense" complaints.

---

## 12. Files to Create / Modify

```
backend/
  ├── recommendationEngine.ts        REWRITE — hybrid ranker, modules for each component
  ├── recommendationEngine.test.ts   EXTEND — unit tests per component + golden tests for end-to-end
  ├── migrations.ts                  NEW    — idempotent ALTER TABLE / CREATE TABLE
  ├── validators.ts                  NEW    — vocabularies + zod schemas for new endpoints
  ├── config.ts                      NEW    — WEIGHTS, segment thresholds, τ, λ
  ├── cooccurrence.ts                NEW    — build + query item-item matrix
  └── analytics.ts                   NEW    — /api/analytics/recommendations handler

scripts/
  ├── backfill_product_attributes.mjs NEW   — populate new product columns from existing data
  └── eval_recommender.mjs            NEW   — offline metrics

src/
  ├── components/OnboardingModal.tsx NEW
  ├── hooks/useTrackEvent.ts         NEW
  └── pages/* (touch reco list rendering to show recommendation_reason chip)

server.ts                            UPDATE — call migrations on boot, register new routes, flag-gate engine
```

---

## 13. Open Questions

These should be answered before PR 4 lands, not after:

1. **Refill cadence ground truth.** The `average_lifespan_days` table in §2.1 is a guess. Is there real consumption data anywhere (returns, repurchase intervals on a sister product line) we can mine instead?
2. **Severity ordering.** Is the canonical user journey `High → Regular → Improver` or `Regular → High → Improver`? The current engine implies both at different lines. Pick one and document.
3. **Notification coupling.** The existing `POST /api/notifications/product` sends SMS/email/call. Should refill-due recommendations auto-fire a notification, or remain pull-only via the reco list? Affects whether PR 4 needs to touch the notification pipeline.
4. **Customer count.** Collaborative scoring assumes ≥ 50 customers with ≥ 2 transactions each. If we're below that, leave `collab` weight at 0 and redistribute — but we need a number to decide.

---

## 14. Notes for the Implementing AI

- Don't break `GET /api/recommendations/:customer_id` response shape — only add fields.
- The `transactions.product` JSON blob is load-bearing for the existing engine and frontend. Do not migrate to a `transaction_items` table in this redesign; revisit in v3.
- Every new SQL statement must be `prepare`d once at module scope, not inside the request handler — `better-sqlite3` is synchronous and prepared statements are ~10x faster.
- Treat the `WEIGHTS` constant as a hyperparameter. Anything that *looks* like a magic number in the ranker belongs in `config.ts`.
- Tests: each scoring component must have a unit test with hand-rolled fixtures. The end-to-end `getHybridRecommendations` test should assert ordering on a known input, not just "returned 6 items".
