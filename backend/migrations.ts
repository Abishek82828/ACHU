import type Database from "better-sqlite3";
import fs from "fs";
import path from "path";

type DB = Database.Database;

function hasColumn(db: DB, table: string, column: string): boolean {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((r) => r.name === column);
}

function addColumnIfMissing(db: DB, table: string, column: string, decl: string): boolean {
  if (hasColumn(db, table, column)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  return true;
}

export interface MigrationReport {
  productsAdded: string[];
  customersAdded: string[];
  tablesCreated: string[];
  indexesCreated: string[];
}

export function runMigrations(db: DB): MigrationReport {
  const report: MigrationReport = {
    productsAdded: [],
    customersAdded: [],
    tablesCreated: [],
    indexesCreated: [],
  };

  const productCols: Array<[string, string]> = [
    ["average_lifespan_days", "INTEGER"],
    ["skin_types", "TEXT"],
    ["target_concerns", "TEXT"],
    ["ingredients", "TEXT"],
    ["seasonal", "TEXT"],
    ["average_rating", "REAL DEFAULT 0"],
    ["review_count", "INTEGER DEFAULT 0"],
    ["stock_level", "INTEGER DEFAULT 100"],
    ["created_at", "TEXT DEFAULT '2000-01-01 00:00:00'"],
    ["brand", "TEXT"],
    ["product_type", "TEXT"],
  ];
  for (const [name, decl] of productCols) {
    if (addColumnIfMissing(db, "products", name, decl)) report.productsAdded.push(name);
  }

  // Populate brand & product_type for all 50 hair products
  const brandTypeMap: Array<[string, string, string]> = [
    ["Bringadi Intensive Hair Treatment Oil", "Kama Ayurveda", "Hair Oil"],
    ["Bringadi Hair Cleanser", "Kama Ayurveda", "Shampoo"],
    ["Bringadi Hair Conditioner", "Kama Ayurveda", "Conditioner"],
    ["Sanobar Hair Cleanser", "Kama Ayurveda", "Shampoo"],
    ["Himalayan Deodar Hair Cleanser", "Kama Ayurveda", "Shampoo"],
    ["Rose & Jasmine Hair Conditioner", "Kama Ayurveda", "Conditioner"],
    ["Organic Henna Powder", "Kama Ayurveda", "Hair Color & Treatment"],
    ["Organic Indigo Powder", "Kama Ayurveda", "Hair Color"],
    ["Bhringraj Hair Vitalizer", "Forest Essentials", "Hair Tonic"],
    ["Japapatti Hair Cleanser", "Forest Essentials", "Shampoo"],
    ["Bhringraj & Shikakai Hair Cleanser", "Forest Essentials", "Shampoo"],
    ["Japapatti Hair Conditioner", "Forest Essentials", "Conditioner"],
    ["Intensive Hair Repair Masque Japapatti & Brahmi", "Forest Essentials", "Hair Mask"],
    ["Hair Thickening Spray Bhringraj & Shikakai", "Forest Essentials", "Hair Spray"],
    ["Bio Kelp Protein Shampoo", "Biotique", "Shampoo"],
    ["Bio Green Apple Shampoo", "Biotique", "Shampoo"],
    ["Bio Soya Protein Shampoo", "Biotique", "Shampoo"],
    ["Bio Bhringraj Therapeutic Hair Oil", "Biotique", "Hair Oil"],
    ["Bio Mountain Ebony Hair Serum", "Biotique", "Serum"],
    ["Bio Thyme Volume Conditioner", "Biotique", "Conditioner"],
    ["Bio Henna Leaf Fresh Texture Shampoo", "Biotique", "Shampoo"],
    ["Onion Hair Oil", "Mamaearth", "Hair Oil"],
    ["Onion Shampoo", "Mamaearth", "Shampoo"],
    ["Onion Conditioner", "Mamaearth", "Conditioner"],
    ["Tea Tree Shampoo", "Mamaearth", "Anti-Dandruff Shampoo"],
    ["BhringAmla Hair Oil", "Mamaearth", "Hair Oil"],
    ["Rosemary Hair Growth Oil", "Mamaearth", "Hair Oil"],
    ["Apple Cider Vinegar Shampoo", "WOW Skin Science", "Shampoo"],
    ["Onion Black Seed Hair Oil", "WOW Skin Science", "Hair Oil"],
    ["Coconut Milk Shampoo", "WOW Skin Science", "Shampoo"],
    ["Moroccan Argan Oil Shampoo", "WOW Skin Science", "Shampoo"],
    ["Red Onion Black Seed Oil Shampoo", "WOW Skin Science", "Shampoo"],
    ["Himalayan Rose Conditioner", "WOW Skin Science", "Conditioner"],
    ["Amla & Bhringraj Shampoo", "Khadi Natural", "Shampoo"],
    ["Neem & Aloe Vera Shampoo", "Khadi Natural", "Shampoo"],
    ["Shikakai & Honey Shampoo", "Khadi Natural", "Shampoo"],
    ["Herbal Hair Conditioner", "Khadi Natural", "Conditioner"],
    ["Bhringraj Hair Oil", "Khadi Natural", "Hair Oil"],
    ["Amla Hair Oil", "Khadi Natural", "Hair Oil"],
    ["Kesh Kanti Natural Hair Cleanser", "Patanjali", "Shampoo"],
    ["Kesh Kanti Aloe Vera Hair Cleanser", "Patanjali", "Shampoo"],
    ["Kesh Kanti Milk Protein Hair Cleanser", "Patanjali", "Shampoo"],
    ["Kesh Kanti Anti-Dandruff Hair Cleanser", "Patanjali", "Shampoo"],
    ["Kesh Kanti Hair Oil", "Patanjali", "Hair Oil"],
    ["Aloe Vera Juice Shampoo", "Organic Harvest", "Shampoo"],
    ["Organic Harvest Anti-Dandruff Shampoo", "Organic Harvest", "Shampoo"],
    ["Organic Harvest Hair Conditioner", "Organic Harvest", "Conditioner"],
    ["Bhringraj & Onion Hair Oil", "Just Herbs", "Hair Oil"],
    ["Castor & Black Onion Seed Hair Oil", "Juicy Chemistry", "Hair Oil"],
    ["Hibiscus & Onion Hair Oil", "SoulTree", "Hair Oil"],
  ];
  const updateBrandType = db.prepare(
    "UPDATE products SET brand = ?, product_type = ? WHERE pname = ? AND (brand IS NULL OR product_type IS NULL)"
  );
  for (const [pname, brand, ptype] of brandTypeMap) {
    updateBrandType.run(brand, ptype, pname);
  }

  // --- Backfill target_concerns & skin_types from problem_tags + description ---
  const needsBackfill = db.prepare(
    "SELECT id, problem_tags, description, product_type FROM products WHERE target_concerns IS NULL OR target_concerns = ''"
  ).all() as Array<{ id: number; problem_tags: string | null; description: string | null; product_type: string | null }>;

  const CONCERN_KEYWORDS: Record<string, string[]> = {
    "hair-fall": ["hair-fall", "hair fall", "fall control", "weak-roots", "weak roots"],
    "dandruff": ["dandruff", "anti-dandruff", "flaky-scalp", "flaky scalp", "itchy-scalp"],
    "dry-hair": ["dry-hair", "dry hair", "rough-hair", "rough hair", "moisturizing"],
    "frizz": ["frizz-control", "frizz control", "frizz", "smooth-hair"],
    "dull-hair": ["dull-hair", "dull hair", "shine", "dull"],
    "scalp-care": ["scalp-care", "scalp care", "scalp-buildup", "scalp buildup"],
    "hair-growth": ["hair-growth", "hair growth", "thin-hair", "hair-volume"],
    "damaged-hair": ["damaged-hair", "damaged hair", "hair-repair", "deep-conditioning"],
    "grey-hair": ["grey-hair", "grey hair", "grey coverage"],
    "hair-color": ["hair-color", "hair color", "henna", "indigo"],
  };

  const SKIN_TYPE_KEYWORDS: Record<string, string[]> = {
    "all": ["daily-use", "daily use", "normal-hair", "regular"],
    "dry": ["dry-hair", "dry hair", "dry-scalp", "rough-hair", "moisturizing"],
    "oily": ["oily", "scalp-buildup", "oil-control"],
    "sensitive": ["sensitive", "gentle"],
  };

  if (needsBackfill.length > 0) {
    const updateAttrs = db.prepare(
      "UPDATE products SET target_concerns = ?, skin_types = ? WHERE id = ?"
    );
    for (const row of needsBackfill) {
      const text = `${row.problem_tags || ""} ${row.description || ""}`.toLowerCase();

      const concerns: string[] = [];
      for (const [concern, keywords] of Object.entries(CONCERN_KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) concerns.push(concern);
      }

      const skinTypes: string[] = [];
      for (const [stype, keywords] of Object.entries(SKIN_TYPE_KEYWORDS)) {
        if (keywords.some(kw => text.includes(kw))) skinTypes.push(stype);
      }
      if (skinTypes.length === 0) skinTypes.push("all");

      updateAttrs.run(concerns.join(","), skinTypes.join(","), row.id);
    }
  }

  // --- Recommendation impressions table for conversion tracking ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendation_impressions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      rule TEXT NOT NULL,
      score REAL NOT NULL DEFAULT 0,
      reason TEXT,
      context_product_id INTEGER,
      converted INTEGER NOT NULL DEFAULT 0,
      transaction_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      converted_at TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(context_product_id) REFERENCES products(id),
      FOREIGN KEY(transaction_id) REFERENCES transactions(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_reco_imp_customer ON recommendation_impressions(customer_id, created_at DESC)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_reco_imp_product ON recommendation_impressions(product_id)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_reco_imp_converted ON recommendation_impressions(converted)");

  // --- Dismissed recommendations table (negative feedback) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS recommendation_dismissals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      dismissed_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_dismissals_customer ON recommendation_dismissals(customer_id, dismissed_at DESC)");

  // --- Product bundles table (frequently bought together) ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_bundles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_ids TEXT NOT NULL,
      co_purchase_count INTEGER NOT NULL DEFAULT 0,
      last_updated TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec("CREATE INDEX IF NOT EXISTS idx_bundles_count ON product_bundles(co_purchase_count DESC)");

  // --- Learned rule weights from conversion data ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS learned_rule_weights (
      rule TEXT PRIMARY KEY,
      alpha REAL NOT NULL DEFAULT 1,
      beta REAL NOT NULL DEFAULT 1,
      last_updated TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const customerCols: Array<[string, string]> = [
    ["skin_type", "TEXT"],
    ["concerns", "TEXT"],
    ["budget_range", "TEXT"],
    ["preferred_categories", "TEXT"],
    ["age_range", "TEXT"],
    ["onboarding_completed", "INTEGER DEFAULT 0"],
  ];
  for (const [name, decl] of customerCols) {
    if (addColumnIfMissing(db, "customers", name, decl)) report.customersAdded.push(name);
  }

  const beforeUserEvents = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='user_events'"
  ).get();
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN
        ('view','add_to_cart','wishlist','search','purchase','reco_impression','reco_click','dismiss')),
      product_id INTEGER,
      search_query TEXT,
      metadata TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(customer_id) REFERENCES customers(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
  if (!beforeUserEvents) report.tablesCreated.push("user_events");

  // If user_events already existed but without 'dismiss' in the CHECK constraint,
  // recreate it (SQLite doesn't support ALTER CHECK)
  if (beforeUserEvents) {
    try {
      db.prepare("INSERT INTO user_events (customer_id, event_type, product_id) VALUES (0, 'dismiss', 0)").run();
      db.prepare("DELETE FROM user_events WHERE customer_id = 0 AND event_type = 'dismiss'").run();
    } catch {
      // CHECK constraint failed — need to recreate
      db.exec(`
        CREATE TABLE IF NOT EXISTS user_events_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          event_type TEXT NOT NULL CHECK(event_type IN
            ('view','add_to_cart','wishlist','search','purchase','reco_impression','reco_click','dismiss')),
          product_id INTEGER,
          search_query TEXT,
          metadata TEXT,
          timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(customer_id) REFERENCES customers(id),
          FOREIGN KEY(product_id) REFERENCES products(id)
        );
        INSERT INTO user_events_new SELECT * FROM user_events;
        DROP TABLE user_events;
        ALTER TABLE user_events_new RENAME TO user_events;
      `);
    }
  }

  const indexes: Array<[string, string]> = [
    ["idx_user_events_customer_time", "user_events(customer_id, timestamp DESC)"],
    ["idx_user_events_product_time", "user_events(product_id, timestamp DESC)"],
    ["idx_user_events_type", "user_events(event_type, timestamp DESC)"],
  ];
  for (const [name, spec] of indexes) {
    const exists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='index' AND name=?"
    ).get(name);
    db.exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${spec}`);
    if (!exists) report.indexesCreated.push(name);
  }

  // --- Seed Face products from face-care.txt ---
  const faceFile = path.join(process.cwd(), "face-care.txt");
  if (fs.existsSync(faceFile)) {
    const existingFaceCount = (db.prepare("SELECT COUNT(*) as c FROM products WHERE category = 'Face'").get() as any).c;
    if (existingFaceCount === 0) {
      const faceProducts = JSON.parse(fs.readFileSync(faceFile, "utf-8")) as Array<{
        pname: string; netprice: number; sellingprice: number; category: string;
        severity: string; description: string; image: string; problem_tags: string;
      }>;

      function extractFaceBrandAndType(pname: string): { brand: string; product_type: string } {
        const brandPatterns: Array<[string, string]> = [
          ["Kumkumadi", "Kama Ayurveda"], ["Rose Jasmine Face", "Kama Ayurveda"],
          ["Pure Rose Water", "Kama Ayurveda"], ["Mridul", "Kama Ayurveda"],
          ["Nimrah", "Kama Ayurveda"], ["Suvarna", "Kama Ayurveda"],
          ["Eladi", "Kama Ayurveda"], ["Nalpamaradi", "Kama Ayurveda"],
          ["Soundarya", "Forest Essentials"], ["Facial Tonic Mist", "Forest Essentials"],
          ["Delicate Facial Cleanser", "Forest Essentials"], ["Tejasvi", "Forest Essentials"],
          ["Sanjeevani", "Forest Essentials"], ["Narangi", "Forest Essentials"],
          ["Multani Mitti Facial", "Forest Essentials"],
          ["Bio ", "Biotique"],
          ["Organic Harvest", "Organic Harvest"],
          ["Ubtan Face", "Mamaearth"], ["Vitamin C Face", "Mamaearth"],
          ["Tea Tree Face", "Mamaearth"], ["Skin Illuminate", "Mamaearth"],
          ["Aloe Vera Gel", "Mamaearth"],
          ["Green Tea", "Plum"], ["Chamomile", "Plum"], ["E-Luminence", "Plum"],
          ["Sandalwood & Saffron", "WOW Skin Science"],
          ["Neem & Tulsi Face", "WOW Skin Science"],
          ["Rose Water Toner", "WOW Skin Science"],
          ["Herbal Anti-Acne", "Patanjali"], ["Ayurvedic Face Scrub", "Patanjali"],
          ["Gotukola", "SoulTree"], ["Silksplash", "SoulTree"],
          ["Apricot Sparkle", "SoulTree"],
          ["Kimsukadi", "Just Herbs"],
          ["Elixir Facial Serum", "Forest Essentials"],
          ["Turmeric & Sandalwood Face", "Forest Essentials"],
          ["Kakadu Plum", "Juicy Chemistry"],
        ];
        let brand = "Unknown";
        for (const [pattern, b] of brandPatterns) {
          if (pname.includes(pattern)) { brand = b; break; }
        }

        let product_type = "Face Wash";
        const lower = pname.toLowerCase();
        if (lower.includes("face oil") || lower.includes("facial oil") || lower.includes("thailam")) product_type = "Face Oil";
        else if (lower.includes("serum") || lower.includes("elixir")) product_type = "Serum";
        else if (lower.includes("face cream") || lower.includes("radiance cream") || lower.includes("night cream") || lower.includes("moisturiz") || lower.includes("creme")) product_type = "Moisturizer";
        else if (lower.includes("toner") || lower.includes("rose water") || lower.includes("facial mist") || lower.includes("tonic mist")) product_type = "Toner";
        else if (lower.includes("face pack") || lower.includes("face mask") || lower.includes("ubtan") && !lower.includes("wash")) product_type = "Face Pack";
        else if (lower.includes("sunscreen") || lower.includes("spf")) product_type = "Sunscreen";
        else if (lower.includes("face scrub") || lower.includes("body polisher")) product_type = "Face Scrub";
        else if (lower.includes("facial kit")) product_type = "Facial Kit";
        else if (lower.includes("night gel")) product_type = "Night Gel";
        else if (lower.includes("body mist")) product_type = "Body Mist";
        else if (lower.includes("gel") && !lower.includes("wash")) product_type = "Gel Moisturizer";
        else if (lower.includes("emulsion")) product_type = "Moisturizer";

        return { brand, product_type };
      }

      // Build image map from FACE CARE assets
      const faceAssetsDir = path.join(process.cwd(), "assets", "FACE CARE");
      const faceImageMap = new Map<string, string>();
      if (fs.existsSync(faceAssetsDir)) {
        for (const file of fs.readdirSync(faceAssetsDir)) {
          const ext = path.extname(file).toLowerCase();
          if (![".jpeg", ".jpg", ".png", ".webp"].includes(ext)) continue;
          // Skip misplaced files
          if (file.toLowerCase().includes("remove from face list") || file.toLowerCase().includes("bringadi")) continue;
          const nameWithoutExt = path.basename(file, path.extname(file)).trim().toLowerCase().replace(/[^a-z0-9]/g, "");
          faceImageMap.set(nameWithoutExt, `/assets/${encodeURIComponent("FACE CARE")}/${encodeURIComponent(file)}`);
        }
      }

      const insFace = db.prepare(
        "INSERT INTO products (pname, netprice, sellingprice, category, severity, description, image, problem_tags, brand, product_type) VALUES (?,?,?,?,?,?,?,?,?,?)"
      );
      const insertFace = db.transaction(() => {
        for (const p of faceProducts) {
          const { brand, product_type } = extractFaceBrandAndType(p.pname);
          const normalizedName = p.pname.toLowerCase().replace(/[^a-z0-9]/g, "");
          let imagePath = faceImageMap.get(normalizedName) || "";
          if (!imagePath) {
            for (const [key, val] of faceImageMap) {
              if (key.includes(normalizedName) || normalizedName.includes(key)) {
                imagePath = val;
                break;
              }
            }
          }
          insFace.run(p.pname, p.netprice, p.sellingprice, p.category, p.severity, p.description, imagePath, p.problem_tags, brand, product_type);
        }
      });
      insertFace();
    }
  }

  // --- Seed Body products from bodycare.txt ---
  const bodyFile = path.join(process.cwd(), "bodycare.txt");
  if (fs.existsSync(bodyFile)) {
    const existingBodyCount = (db.prepare("SELECT COUNT(*) as c FROM products WHERE category = 'Body'").get() as any).c;
    if (existingBodyCount === 0) {
      const bodyProducts = JSON.parse(fs.readFileSync(bodyFile, "utf-8")) as Array<{
        pname: string; netprice: number; sellingprice: number; category: string;
        severity: string; description: string; image: string; problem_tags: string;
      }>;

      function extractBodyBrandAndType(pname: string): { brand: string; product_type: string } {
        const brandPatterns: Array<[string, string]> = [
          ["Kama Ayurveda", "Kama Ayurveda"], ["Forest Essentials", "Forest Essentials"],
          ["Bio ", "Biotique"], ["Organic Harvest", "Organic Harvest"],
          ["Organic Sweet", "Kama Ayurveda"], ["Organic Coconut", "Forest Essentials"],
          ["Mamaearth", "Mamaearth"], ["WOW", "WOW Skin Science"],
          ["Himalayan", "WOW Skin Science"], ["Nalpamaradi", "Kama Ayurveda"],
          ["Soundarya", "Forest Essentials"], ["Sugandha", "Forest Essentials"],
          ["Nargis", "Forest Essentials"], ["Indian Rose", "Forest Essentials"],
          ["Rose & Jasmine Body Cleanser", "Kama Ayurveda"],
          ["Rose Jasmine Body Cleanser", "Kama Ayurveda"],
          ["Madurai", "Forest Essentials"],
          ["Ubtan", "Mamaearth"], ["Vitamin C", "Mamaearth"],
          ["CoCo", "Mamaearth"], ["Tea Tree", "Mamaearth"],
          ["Coconut Milk", "Mamaearth"], ["Apple Cider", "WOW Skin Science"],
          ["Neem & Tulsi", "Mamaearth"], ["Rose & Honey", "WOW Skin Science"],
          ["Shea Butter", "Mamaearth"],
          ["Sandalwood Soap", "Patanjali"], ["Kesar Chandan", "Patanjali"],
          ["Haldi Chandan", "Patanjali"], ["Neem Kanti", "Patanjali"],
          ["Saundarya", "Patanjali"], ["Ayurvedic Body", "Patanjali"],
          ["Lavender B", "Patanjali"], ["Herbal Body", "Patanjali"],
          ["Aloe Vera Gel", "Patanjali"], ["Aloe Vera Bathing", "Patanjali"],
          ["Rose Bathing", "Patanjali"], ["Lavender Bathing", "Patanjali"],
          ["Aloe & Green Tea", "Plum"], ["Vanilla Vibes", "Plum"],
          ["Hawaiian Rumba", "Plum"], ["Trippin", "Plum"],
          ["Caramel Popcorn", "Plum"],
          ["Sandalwood & Turmeric", "SoulTree"], ["Kumuda", "SoulTree"],
          ["Rose & Sandalwood", "SoulTree"],
        ];
        let brand = "Unknown";
        for (const [pattern, b] of brandPatterns) {
          if (pname.includes(pattern)) { brand = b; break; }
        }

        let product_type = "Body Wash";
        const lower = pname.toLowerCase();
        if (lower.includes("body lotion")) product_type = "Body Lotion";
        else if (lower.includes("body butter")) product_type = "Body Butter";
        else if (lower.includes("body oil") || lower.includes("massage oil")) product_type = "Body Oil";
        else if (lower.includes("body mist")) product_type = "Body Mist";
        else if (lower.includes("body polish") || lower.includes("body scrub")) product_type = "Body Scrub";
        else if (lower.includes("soap") || lower.includes("bathing bar")) product_type = "Soap";
        else if (lower.includes("gel") && !lower.includes("shower gel")) product_type = "Body Gel";
        else if (lower.includes("shower gel") || lower.includes("shower oil") || lower.includes("bath")) product_type = "Body Wash";
        else if (lower.includes("cleanser")) product_type = "Body Wash";
        else if (lower.includes("thailam")) product_type = "Body Oil";
        else if (lower.includes("almond oil")) product_type = "Body Oil";
        else if (lower.includes("makeup cleanser")) product_type = "Cleanser";

        return { brand, product_type };
      }

      // Build image map from BODY CARE assets
      const bodyAssetsDir = path.join(process.cwd(), "assets", "BODY CARE PRODUTS img");
      const bodyImageMap = new Map<string, string>();
      if (fs.existsSync(bodyAssetsDir)) {
        for (const file of fs.readdirSync(bodyAssetsDir)) {
          const ext = path.extname(file).toLowerCase();
          if (![".jpeg", ".jpg", ".png", ".webp"].includes(ext)) continue;
          const nameWithoutExt = path.basename(file, path.extname(file)).toLowerCase().replace(/[^a-z0-9]/g, "");
          bodyImageMap.set(nameWithoutExt, `/assets/${encodeURIComponent("BODY CARE PRODUTS img")}/${encodeURIComponent(file)}`);
        }
      }

      // Manual overrides for typos in asset filenames
      const manualBodyImageMap: Record<string, string> = {
        "Aloe & Green Tea Body Wash": "ALOE & GREEEN TEA BODY WASH.jpeg",
        "Hawaiian Rumba Shower Gel": "HAWAIIAN RUMBA SHOWEER GEL.jpeg",
        "Trippin' Mimosas Body Mist": "TRIPPIN MIMOSA BODY MIST.jpeg",
        "Organic Coconut Body Butter": "ORGANIC COCNUT BODY BUTTER.jpeg",
        "Saundarya Body Lotion": "SAUNDARY BODY LOTION.jpeg",
        "Lavender Bathing Bar": "LAVENDER BATHING SOAP.jpeg",
        "Vitamin C Body Wash": "VITAMIN C BODY WASH (2).jpeg",
        "Madurai Jasmine & Mogra Shower Gel": "MADURAI JASMINE & MORGA SHOWER.jpeg",
        "Bio Almond Oil Soothing Face & Eye Makeup Cleanser": "BIO ALMOND OIL SOOTHING FACE MAKEUP CLEANSER.jpeg",
        "Bio Apricot Refreshing Body Wash": "BIO APRICOT OIL SOOTHING FACE MAKEUP CLEANSER.jpeg",
        "Kumuda Indian White Water Lily Body Wash": "WHITE WATER LILY BODY WASH.jpeg",
        "Himalayan Rose Body Wash": "HIMALYAN ORANGE BODY WASH.jpeg",
      };

      const insBody = db.prepare(
        "INSERT INTO products (pname, netprice, sellingprice, category, severity, description, image, problem_tags, brand, product_type) VALUES (?,?,?,?,?,?,?,?,?,?)"
      );
      const insertBody = db.transaction(() => {
        for (const p of bodyProducts) {
          const { brand, product_type } = extractBodyBrandAndType(p.pname);
          let imagePath = "";

          // Check manual override first
          if (manualBodyImageMap[p.pname]) {
            const manualFile = manualBodyImageMap[p.pname];
            const fullPath = path.join(bodyAssetsDir || "", manualFile);
            if (fs.existsSync(fullPath)) {
              imagePath = `/assets/${encodeURIComponent("BODY CARE PRODUTS img")}/${encodeURIComponent(manualFile)}`;
            }
          }

          // Auto-match by normalized name
          if (!imagePath) {
            const normalizedName = p.pname.toLowerCase().replace(/[^a-z0-9]/g, "");
            const exactMatch = bodyImageMap.get(normalizedName);
            if (exactMatch) {
              imagePath = exactMatch;
            } else {
              for (const [key, val] of bodyImageMap) {
                if (key.includes(normalizedName) || normalizedName.includes(key)) {
                  imagePath = val;
                  break;
                }
              }
            }
          }

          insBody.run(p.pname, p.netprice, p.sellingprice, p.category, p.severity, p.description, imagePath, p.problem_tags, brand, product_type);
        }
      });
      insertBody();
    }
  }

  // --- Seed Oral products from oral.txt ---
  const oralFile = path.join(process.cwd(), "oral.txt");
  if (fs.existsSync(oralFile)) {
    const existingOralCount = (db.prepare("SELECT COUNT(*) as c FROM products WHERE category = 'Oral'").get() as any).c;
    if (existingOralCount === 0) {
      const oralProducts = JSON.parse(fs.readFileSync(oralFile, "utf-8")) as Array<{
        pname: string; netprice: number; sellingprice: number; category: string;
        severity: string; description: string; image: string; problem_tags: string;
      }>;

      // Determine brand and product_type from product name
      function extractBrandAndType(pname: string): { brand: string; product_type: string } {
        const brandPatterns: Array<[string, string]> = [
          ["Dabur", "Dabur"], ["Meswak", "Dabur"], ["Vicco", "Vicco"],
          ["Himalaya", "Himalaya"], ["Patanjali", "Patanjali"], ["Bentodent", "Bentodent"],
          ["Perfora", "Perfora"], ["Organic India", "Organic India"], ["Splat India", "Splat India"],
          ["Ayush", "Lever Ayush"], ["Colgate", "Colgate"], ["Sri Sri Tattva", "Sri Sri Tattva"],
          ["Khadi Natural", "Khadi Natural"], ["Herbodent", "Herbodent"],
          ["Dr. Vaidya", "Dr. Vaidya's"], ["The Tribe Concepts", "The Tribe Concepts"],
          ["Herbal Strategi", "Herbal Strategi"],
        ];
        let brand = "Unknown";
        for (const [pattern, b] of brandPatterns) {
          if (pname.includes(pattern)) { brand = b; break; }
        }

        let product_type = "Toothpaste";
        const lower = pname.toLowerCase();
        if (lower.includes("mouthwash") || lower.includes("oral rinse")) product_type = "Mouthwash";
        else if (lower.includes("tooth powder") || lower.includes("dant manjan")) product_type = "Tooth Powder";
        else if (lower.includes("tongue cleaner")) product_type = "Tongue Cleaner";
        else if (lower.includes("mouth protect spray") || lower.includes("oral spray")) product_type = "Oral Spray";
        else if (lower.includes("gum astringent")) product_type = "Gum Treatment";
        else if (lower.includes("gel") && !lower.includes("toothpaste")) product_type = "Tooth Gel";

        return { brand, product_type };
      }

      // Manual overrides for typos in oral asset filenames
      const manualOralImageMap: Record<string, string> = {
        "Perfora Alcohol-Free Mouthwash": "Perfora Alcohol-Free Mouthwas.png",
      };

      // Build image map from ORAL CARE assets
      const oralAssetsDir = path.join(process.cwd(), "assets", "ORAL CARE");
      const oralImageMap = new Map<string, string>();
      if (fs.existsSync(oralAssetsDir)) {
        for (const file of fs.readdirSync(oralAssetsDir)) {
          const ext = path.extname(file).toLowerCase();
          if (![".jpeg", ".jpg", ".png", ".webp"].includes(ext)) continue;
          const nameWithoutExt = path.basename(file, path.extname(file)).toLowerCase().trim();
          oralImageMap.set(nameWithoutExt, `/assets/${encodeURIComponent("ORAL CARE")}/${encodeURIComponent(file)}`);
        }
      }

      const ins = db.prepare(
        "INSERT INTO products (pname, netprice, sellingprice, category, severity, description, image, problem_tags, brand, product_type) VALUES (?,?,?,?,?,?,?,?,?,?)"
      );
      const insertOral = db.transaction(() => {
        for (const p of oralProducts) {
          const { brand, product_type } = extractBrandAndType(p.pname);
          let imagePath = "";
          // Check manual override
          if (manualOralImageMap[p.pname]) {
            const manualFile = manualOralImageMap[p.pname];
            const fullPath = path.join(oralAssetsDir, manualFile);
            if (fs.existsSync(fullPath)) {
              imagePath = `/assets/${encodeURIComponent("ORAL CARE")}/${encodeURIComponent(manualFile)}`;
            }
          }
          if (!imagePath) {
            const imageKey = p.pname.toLowerCase().trim();
            imagePath = oralImageMap.get(imageKey) || "";
          }
          ins.run(p.pname, p.netprice, p.sellingprice, p.category, p.severity, p.description, imagePath, p.problem_tags, brand, product_type);
        }
      });
      insertOral();
    }
  }

  // --- Fix known image typos for existing products ---
  const oralFixDir = path.join(process.cwd(), "assets", "ORAL CARE");
  if (fs.existsSync(oralFixDir)) {
    const perforaFile = path.join(oralFixDir, "Perfora Alcohol-Free Mouthwas.png");
    if (fs.existsSync(perforaFile)) {
      db.prepare("UPDATE products SET image = ? WHERE pname = ? AND (image IS NULL OR image = '')").run(
        `/assets/${encodeURIComponent("ORAL CARE")}/${encodeURIComponent("Perfora Alcohol-Free Mouthwas.png")}`,
        "Perfora Alcohol-Free Mouthwash"
      );
    }
  }

  // --- Backfill product images from local assets folder ---
  const assetsDir = path.join(process.cwd(), "assets");
  if (fs.existsSync(assetsDir)) {
    const productsNeedingImage = db.prepare(
      "SELECT id, pname, category FROM products WHERE image IS NULL OR image = ''"
    ).all() as Array<{ id: number; pname: string; category: string }>;

    if (productsNeedingImage.length > 0) {
      const imageEntries: Array<{ normalized: string; urlPath: string }> = [];
      const subdirs = fs.readdirSync(assetsDir, { withFileTypes: true });
      for (const dir of subdirs) {
        if (!dir.isDirectory()) continue;
        const dirPath = path.join(assetsDir, dir.name);
        const files = fs.readdirSync(dirPath);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (![".jpeg", ".jpg", ".png", ".webp"].includes(ext)) continue;
          const nameWithoutExt = path.basename(file, path.extname(file));
          const normalized = nameWithoutExt.toLowerCase().replace(/[^a-z0-9]/g, "");
          const urlPath = `/assets/${encodeURIComponent(dir.name)}/${encodeURIComponent(file)}`;
          imageEntries.push({ normalized, urlPath });
        }
      }

      const updateImage = db.prepare("UPDATE products SET image = ? WHERE id = ?");
      for (const product of productsNeedingImage) {
        const normalizedName = product.pname.toLowerCase().replace(/[^a-z0-9]/g, "");
        // Exact match first
        let match = imageEntries.find(e => e.normalized === normalizedName);
        // Partial match: asset name contains product name or vice versa
        if (!match) {
          match = imageEntries.find(e => e.normalized.includes(normalizedName) || normalizedName.includes(e.normalized));
        }
        if (match) {
          updateImage.run(match.urlPath, product.id);
        }
      }
    }
  }

  return report;
}
