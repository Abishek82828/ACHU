import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { getRecommendations, updateLearnedWeights, refreshBundles } from "./backend/recommendationEngine";
import { runMigrations } from "./backend/migrations";
import { sendProductNotifications } from "./backend/productNotifications";
import { publishPurchaseNotification } from "./backend/sns";

const app = express();
const PORT = 3000;

app.use(express.json());

const db = new Database("verdant.db");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cname TEXT NOT NULL,
    gender INTEGER NOT NULL DEFAULT 0,
    pno TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    amountspent INTEGER NOT NULL DEFAULT 0,
    revenue REAL NOT NULL DEFAULT 0.0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pname TEXT NOT NULL,
    netprice INTEGER NOT NULL,
    sellingprice INTEGER NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Oral','Body','Hair','Face')),
    severity TEXT NOT NULL CHECK(severity IN ('Regular','High Severity','Improver')),
    description TEXT,
    image TEXT,
    problem_tags TEXT,
    brand TEXT,
    product_type TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    tname TEXT,
    amount INTEGER NOT NULL DEFAULT 0,
    count INTEGER NOT NULL DEFAULT 0,
    product TEXT,
    discount INTEGER NOT NULL DEFAULT 0,
    date TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS model (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    transaction_id INTEGER,
    problem TEXT,
    recommendedproduct TEXT,
    lastpurchased TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(customer_id) REFERENCES customers(id),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER,
    customer_id INTEGER NOT NULL,
    recommendation_sent INTEGER NOT NULL DEFAULT 0,
    product_purchased INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(transaction_id) REFERENCES transactions(id),
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id, date DESC);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_severity ON products(severity);
  CREATE INDEX IF NOT EXISTS idx_model_customer ON model(customer_id);
  CREATE INDEX IF NOT EXISTS idx_log_customer ON log(customer_id);
`);

// Add is_admin, profile_photo, preferences columns if missing
try { db.exec("ALTER TABLE customers ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE customers ADD COLUMN profile_photo TEXT"); } catch {}
try { db.exec("ALTER TABLE customers ADD COLUMN preferences TEXT"); } catch {}

// Seed admin user (ARCHANA / ACHU)
const adminExists = db.prepare("SELECT id FROM customers WHERE email = 'ARCHANA'").get();
if (!adminExists) {
  db.prepare("INSERT OR IGNORE INTO customers (cname, email, password, gender, is_admin) VALUES (?,?,?,?,?)").run("Archana", "ARCHANA", "ACHU", 1, 1);
}
// Update existing admin if credentials changed
db.prepare("UPDATE customers SET password = 'ACHU', is_admin = 1 WHERE email = 'ARCHANA'").run();

const migrationReport = runMigrations(db);
if (
  migrationReport.productsAdded.length ||
  migrationReport.customersAdded.length ||
  migrationReport.tablesCreated.length ||
  migrationReport.indexesCreated.length
) {
  console.log("[migrations]", migrationReport);
}

const productCount = (db.prepare("SELECT COUNT(*) as c FROM products").get() as any).c;
if (productCount === 0) {
  const ins = db.prepare(`INSERT INTO products (pname, netprice, sellingprice, category, severity, description, image, problem_tags) VALUES (?,?,?,?,?,?,?,?)`);

  const products: [string, number, number, string, string, string, string, string][] = [];

  const insertMany = db.transaction((rows: typeof products) => {
    for (const row of rows) ins.run(...row);
  });
  insertMany(products);
}


// Serve product images from assets folder
app.use("/assets", express.static(path.join(process.cwd(), "assets")));

// --- API Routes ---

app.post("/api/register", (req, res) => {
  const { name, email, password, gender, phone, preferences } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  try {
    const info = db.prepare("INSERT INTO customers (cname, gender, pno, email, password, preferences) VALUES (?,?,?,?,?,?)").run(name, gender ? 1 : 0, phone || null, email, password, preferences || null);
    const user = db.prepare("SELECT id, cname, gender, pno, email, amountspent, revenue, is_admin, profile_photo, preferences FROM customers WHERE id = ?").get(info.lastInsertRowid) as any;
    res.json(user);
  } catch (e: any) {
    if (e.message?.includes("UNIQUE")) {
      return res.status(409).json({ error: "Email already registered" });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT id, cname, gender, pno, email, amountspent, revenue, is_admin, profile_photo, preferences, skin_type, concerns, budget_range, preferred_categories, onboarding_completed FROM customers WHERE email = ? AND password = ?").get(email, password) as any;
  if (user) {
    res.json({ id: user.id, name: user.cname, email: user.email, gender: user.gender, phone: user.pno, amountspent: user.amountspent, revenue: user.revenue, is_admin: user.is_admin, profile_photo: user.profile_photo, preferences: user.preferences, skin_type: user.skin_type, concerns: user.concerns, budget_range: user.budget_range, preferred_categories: user.preferred_categories, onboarding_completed: user.onboarding_completed });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

app.get("/api/user/:id", (req, res) => {
  const user = db.prepare("SELECT id, cname, gender, pno, email, amountspent, revenue, is_admin, profile_photo, preferences FROM customers WHERE id = ?").get(req.params.id) as any;
  if (user) {
    res.json({ id: user.id, name: user.cname, email: user.email, gender: user.gender, phone: user.pno, amountspent: user.amountspent, revenue: user.revenue, is_admin: user.is_admin, profile_photo: user.profile_photo, preferences: user.preferences });
  } else {
    res.status(404).json({ error: "User not found" });
  }
});

// Update user profile
app.put("/api/user/:id", (req, res) => {
  const { name, phone, gender, profile_photo, preferences } = req.body;
  const userId = req.params.id;
  const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(userId);
  if (!existing) return res.status(404).json({ error: "User not found" });

  const updates: string[] = [];
  const params: any[] = [];
  if (name !== undefined) { updates.push("cname = ?"); params.push(name); }
  if (phone !== undefined) { updates.push("pno = ?"); params.push(phone); }
  if (gender !== undefined) { updates.push("gender = ?"); params.push(gender ? 1 : 0); }
  if (profile_photo !== undefined) { updates.push("profile_photo = ?"); params.push(profile_photo); }
  if (preferences !== undefined) { updates.push("preferences = ?"); params.push(preferences); }

  if (updates.length > 0) {
    params.push(userId);
    db.prepare(`UPDATE customers SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  }

  const user = db.prepare("SELECT id, cname, gender, pno, email, amountspent, revenue, is_admin, profile_photo, preferences FROM customers WHERE id = ?").get(userId) as any;
  res.json({ id: user.id, name: user.cname, email: user.email, gender: user.gender, phone: user.pno, amountspent: user.amountspent, revenue: user.revenue, is_admin: user.is_admin, profile_photo: user.profile_photo, preferences: user.preferences });
});

app.get("/api/products", (req, res) => {
  const { category, search, severity, product_type, brand } = req.query;
  let query = "SELECT * FROM products";
  const params: any[] = [];
  const conditions: string[] = ["pname != 'Debug Product'"];

  if (category) { conditions.push("category = ?"); params.push(category); }
  if (severity) { conditions.push("severity = ?"); params.push(severity); }
  if (product_type) { conditions.push("product_type = ?"); params.push(product_type); }
  if (brand) { conditions.push("brand = ?"); params.push(brand); }
  if (search) { conditions.push("(pname LIKE ? OR description LIKE ? OR problem_tags LIKE ? OR brand LIKE ?)"); params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }

  query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY category, product_type, brand, pname";

  res.json(db.prepare(query).all(...params));
});

app.get("/api/products/filters", (_req, res) => {
  const types = db.prepare("SELECT DISTINCT product_type FROM products WHERE product_type IS NOT NULL ORDER BY product_type").all();
  const brands = db.prepare("SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL ORDER BY brand").all();
  res.json({
    product_types: types.map((r: any) => r.product_type),
    brands: brands.map((r: any) => r.brand),
  });
});

app.get("/api/products/:id", (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (product) res.json(product);
  else res.status(404).json({ error: "Product not found" });
});

app.get("/api/search", (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const customerId = Number(req.query.customer_id ?? 0);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 6), 1), 10);

  if (!q) return res.json({ matched_products: [], recommended_products: [] });

  const term = `%${q}%`;
  const matched = db.prepare(`
    SELECT id, pname, category, sellingprice, severity, image, problem_tags,
      CASE
        WHEN lower(pname) LIKE ? THEN 100
        WHEN lower(category) LIKE ? THEN 80
        WHEN lower(COALESCE(problem_tags,'')) LIKE ? THEN 70
        WHEN lower(COALESCE(description,'')) LIKE ? THEN 40
        ELSE 0
      END AS relevance
    FROM products
    WHERE lower(pname) LIKE ? OR lower(category) LIKE ? OR lower(COALESCE(problem_tags,'')) LIKE ? OR lower(COALESCE(description,'')) LIKE ?
    ORDER BY relevance DESC, pname ASC LIMIT ?
  `).all(term, term, term, term, term, term, term, term, limit);

  const recs = getRecommendations(db, { customerId, limit: limit * 2 });
  const recommended = recs.slice(0, limit).map(p => ({
    id: p.id, pname: p.pname, category: p.category, sellingprice: p.sellingprice,
    recommendation_reason: p.recommendation_reason,
  }));

  res.json({ matched_products: matched, recommended_products: recommended });
});

app.get("/search", (req, res) => {
  req.url = "/api/search" + req.url.slice(req.url.indexOf("?"));
  app.handle(req, res);
});

app.post("/api/purchase", (req, res) => {
  const { customer_id, items, total } = req.body;
  if (!customer_id || !items?.length) {
    return res.status(400).json({ error: "customer_id and items required" });
  }

  try {
    const result = db.transaction(() => {
      const productJson = JSON.stringify(items);
      const info = db.prepare(
        "INSERT INTO transactions (customer_id, tname, amount, count, product, discount) VALUES (?,?,?,?,?,?)"
      ).run(customer_id, "Purchase", Math.round(total), items.length, productJson, 0);
      const txId = info.lastInsertRowid;

      db.prepare("UPDATE customers SET amountspent = amountspent + ?, revenue = revenue + ? WHERE id = ?")
        .run(Math.round(total), Math.round(total * 0.3), customer_id);

      db.prepare("INSERT INTO log (transaction_id, customer_id, recommendation_sent, product_purchased) VALUES (?,?,?,?)")
        .run(txId, customer_id, 0, 1);

      // Tie purchased products back to recommendation impressions
      for (const item of items) {
        if (!item.id) continue;
        db.prepare(`
          UPDATE recommendation_impressions
          SET converted = 1, transaction_id = ?, converted_at = datetime('now')
          WHERE customer_id = ? AND product_id = ? AND converted = 0
        `).run(txId, customer_id, item.id);
      }

      return txId;
    })();

    // Periodically refresh learned weights and bundles after purchases
    const txCount = (db.prepare("SELECT COUNT(*) as c FROM transactions").get() as any).c;
    if (txCount % 10 === 0) {
      updateLearnedWeights(db);
      refreshBundles(db);
    }

    res.json({ success: true, transaction_id: Number(result) });
  } catch (error) {
    console.error("Purchase error:", error);
    res.status(500).json({ error: "Purchase failed" });
  }
});

function getCustomerContact(customerId: number) {
  return db.prepare("SELECT email, pno as phone, cname as name FROM customers WHERE id = ?").get(customerId) as { email?: string; phone?: string; name?: string } | undefined;
}

function getProductInfo(productId: number) {
  return db.prepare("SELECT id, pname, sellingprice FROM products WHERE id = ?").get(productId) as { id: number; pname: string; sellingprice: number } | undefined;
}

app.post("/api/notifications/product", async (req, res) => {
  const customerId = Number(req.body.customer_id ?? 0);
  const productId = req.body.product_id ? Number(req.body.product_id) : undefined;
  const channels = Array.isArray(req.body.channels) ? req.body.channels.filter((c) => ["sms", "email", "call"].includes(c)) : [];
  const message = String(req.body.message || "").trim();

  if (!customerId || channels.length === 0 || !message) {
    return res.status(400).json({ error: "customer_id, channels, and message are required" });
  }

  const customer = getCustomerContact(customerId);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const product = productId ? getProductInfo(productId) : undefined;
  const payload = {
    channels,
    customerName: customer.name,
    productName: product?.pname,
    message,
    smsTo: req.body.smsTo ?? customer.phone,
    emailTo: req.body.emailTo ?? customer.email,
    callTo: req.body.callTo ?? customer.phone,
    emailSubject: req.body.emailSubject ?? (product ? `Verdant product update: ${product.pname}` : undefined),
  };

  try {
    const result = await sendProductNotifications(payload);
    return res.json(result);
  } catch (error) {
    console.error("Notification error:", error);
    return res.status(500).json({ error: "Failed to send notifications" });
  }
});

app.post("/api/debug/notifications/master", async (req, res) => {
  const customerId = Number(req.body.customer_id ?? 0);
  const productId = req.body.product_id ? Number(req.body.product_id) : undefined;
  const daysElapsed = Number(req.body.days_elapsed ?? 0);

  if (!customerId || !productId) {
    return res.status(400).json({ error: "customer_id and product_id are required" });
  }

  const customer = getCustomerContact(customerId);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const product = getProductInfo(productId);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const purchasedAt = new Date(Date.now() - daysElapsed * 86400000).toISOString();
  const snsResult = await publishPurchaseNotification({
    transactionId: Date.now(),
    customerId,
    total: product.sellingprice,
    itemCount: 1,
    purchasedAt,
  });

  const notificationPayload = {
    channels: ["sms", "email", "call"],
    customerName: customer.name,
    productName: product.pname,
    message: String(req.body.message ?? `Debug master alert for ${product.pname}`),
    smsTo: customer.phone,
    emailTo: customer.email,
    callTo: customer.phone,
    emailSubject: req.body.emailSubject ?? `Verdant debug notification for ${product.pname}`,
  };

  try {
    const notifications = await sendProductNotifications(notificationPayload);
    return res.json({ success: true, snsEvent: snsResult, notifications });
  } catch (error) {
    console.error("Debug master notification error:", error);
    return res.status(500).json({ error: "Failed to trigger master debug notifications" });
  }
});

app.post("/api/debug/recommendation/simulate-days", (req, res) => {
  const customerId = Number(req.body.customer_id ?? 0);
  const productId = req.body.product_id ? Number(req.body.product_id) : undefined;
  const daysElapsed = Number(req.body.days_elapsed ?? 0);

  if (!customerId || !productId || Number.isNaN(daysElapsed) || daysElapsed < 0) {
    return res.status(400).json({ error: "customer_id, product_id, and days_elapsed are required" });
  }

  const customer = getCustomerContact(customerId);
  if (!customer) {
    return res.status(404).json({ error: "Customer not found" });
  }

  const product = getProductInfo(productId);
  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  const transactionDate = new Date(Date.now() - daysElapsed * 86400000).toISOString();
  try {
    const info = db.prepare(
      "INSERT INTO transactions (customer_id, tname, amount, count, product, discount, date) VALUES (?,?,?,?,?,?,?)"
    ).run(
      customerId,
      "Debug simulation",
      Math.round(product.sellingprice),
      1,
      JSON.stringify([{ id: product.id, name: product.pname, price: product.sellingprice, quantity: 1 }]),
      0,
      transactionDate,
    );

    return res.json({ success: true, transaction_id: Number(info.lastInsertRowid), simulated_date: transactionDate });
  } catch (error) {
    console.error("Simulation error:", error);
    return res.status(500).json({ error: "Failed to simulate purchase days" });
  }
});

app.get("/api/user/:id/history", (req, res) => {
  const transactions = db.prepare("SELECT * FROM transactions WHERE customer_id = ? ORDER BY date DESC").all(req.params.id);
  const enriched = transactions.map((t: any) => {
    let items: any[] = [];
    try {
      const parsed = JSON.parse(t.product || "[]");
      items = parsed.map((item: any) => {
        const product = db.prepare("SELECT id, pname, image, sellingprice, category FROM products WHERE id = ?").get(item.id) as any;
        return {
          product_id: item.id,
          product_name: product?.pname || item.name || "Unknown",
          image: product?.image,
          quantity: item.quantity || 1,
          price: item.price || product?.sellingprice || 0,
          category: product?.category,
        };
      });
    } catch {}
    return { ...t, items };
  });
  res.json(enriched);
});

app.get("/api/recommendations/:customer_id", (req, res) => {
  const customerId = Number(req.params.customer_id) || 0;
  const productId = req.query.product_id ? Number(req.query.product_id) : undefined;
  const limit = Number(req.query.limit) || 6;

  try {
    const recs = getRecommendations(db, { customerId, productId, limit });

    if (customerId > 0 && recs.length > 0) {
      const ins = db.prepare("INSERT INTO model (customer_id, problem, recommendedproduct, lastpurchased) VALUES (?,?,?,?)");
      const lastTx = db.prepare("SELECT date FROM transactions WHERE customer_id = ? ORDER BY date DESC LIMIT 1").get(customerId) as any;
      ins.run(customerId, recs[0].recommendation_rule, JSON.stringify(recs.map(r => r.id)), lastTx?.date || null);

      const logIns = db.prepare("INSERT INTO log (customer_id, recommendation_sent, product_purchased) VALUES (?,?,?)");
      logIns.run(customerId, 1, 0);

      // Log per-product impression for conversion tracking
      const impIns = db.prepare(
        "INSERT INTO recommendation_impressions (customer_id, product_id, rule, score, reason, context_product_id) VALUES (?,?,?,?,?,?)"
      );
      for (const rec of recs) {
        impIns.run(customerId, rec.id, rec.recommendation_rule, rec.recommendation_score, rec.recommendation_reason, productId ?? null);
      }

      // Also log to user_events
      const evIns = db.prepare(
        "INSERT INTO user_events (customer_id, event_type, product_id, metadata) VALUES (?,?,?,?)"
      );
      for (const rec of recs) {
        evIns.run(customerId, "reco_impression", rec.id, JSON.stringify({ rule: rec.recommendation_rule, score: rec.recommendation_score }));
      }
    }

    res.json(recs);
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

// Track when user clicks a recommended product
app.post("/api/reco-tracking/click", (req, res) => {
  const { customer_id, product_id } = req.body;
  if (!customer_id || !product_id) return res.status(400).json({ error: "customer_id and product_id required" });
  db.prepare("INSERT INTO user_events (customer_id, event_type, product_id) VALUES (?,?,?)").run(customer_id, "reco_click", product_id);
  res.json({ ok: true });
});

// Recommendation conversion analytics
app.get("/api/reco-tracking/analytics", (_req, res) => {
  const totalImpressions = (db.prepare("SELECT COUNT(*) as c FROM recommendation_impressions").get() as any).c;
  const totalConverted = (db.prepare("SELECT COUNT(*) as c FROM recommendation_impressions WHERE converted = 1").get() as any).c;
  const conversionRate = totalImpressions > 0 ? Number(((totalConverted / totalImpressions) * 100).toFixed(1)) : 0;

  const byRule = db.prepare(`
    SELECT rule, COUNT(*) as impressions, SUM(converted) as conversions,
      ROUND(CAST(SUM(converted) AS REAL) / COUNT(*) * 100, 1) as conversion_rate
    FROM recommendation_impressions GROUP BY rule ORDER BY conversions DESC
  `).all();

  const recentConversions = db.prepare(`
    SELECT ri.*, p.pname, p.category, c.cname as customer_name
    FROM recommendation_impressions ri
    JOIN products p ON p.id = ri.product_id
    JOIN customers c ON c.id = ri.customer_id
    WHERE ri.converted = 1
    ORDER BY ri.converted_at DESC LIMIT 20
  `).all();

  res.json({ totalImpressions, totalConverted, conversionRate, byRule, recentConversions });
});

// Dismiss a recommendation (negative feedback)
app.post("/api/reco-tracking/dismiss", (req, res) => {
  const { customer_id, product_id } = req.body;
  if (!customer_id || !product_id) return res.status(400).json({ error: "customer_id and product_id required" });
  db.prepare("INSERT INTO recommendation_dismissals (customer_id, product_id) VALUES (?,?)").run(customer_id, product_id);
  db.prepare("INSERT INTO user_events (customer_id, event_type, product_id) VALUES (?,?,?)").run(customer_id, "dismiss", product_id);
  res.json({ ok: true });
});

// Cold-start onboarding questionnaire
app.post("/api/onboarding", (req, res) => {
  const { customer_id, skin_type, concerns, budget_range, preferred_categories } = req.body;
  if (!customer_id) return res.status(400).json({ error: "customer_id required" });
  const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(customer_id);
  if (!existing) return res.status(404).json({ error: "User not found" });

  db.prepare(`
    UPDATE customers SET skin_type = ?, concerns = ?, budget_range = ?,
    preferred_categories = ?, onboarding_completed = 1 WHERE id = ?
  `).run(skin_type || null, concerns || null, budget_range || null, preferred_categories || null, customer_id);

  const user = db.prepare("SELECT id, cname, gender, pno, email, amountspent, revenue, is_admin, profile_photo, preferences, skin_type, concerns, budget_range, preferred_categories, onboarding_completed FROM customers WHERE id = ?").get(customer_id) as any;
  res.json({ id: user.id, name: user.cname, email: user.email, gender: user.gender, phone: user.pno, amountspent: user.amountspent, revenue: user.revenue, is_admin: user.is_admin, profile_photo: user.profile_photo, preferences: user.preferences, skin_type: user.skin_type, concerns: user.concerns, budget_range: user.budget_range, preferred_categories: user.preferred_categories, onboarding_completed: user.onboarding_completed });
});

// Refresh learned weights and bundles (can be called periodically or by admin)
app.post("/api/admin/refresh-model", (_req, res) => {
  updateLearnedWeights(db);
  refreshBundles(db);
  res.json({ ok: true, message: "Learned weights and bundles refreshed" });
});

// View tracking
app.post("/api/tracking/view", (req, res) => {
  const { customer_id, product_id } = req.body;
  if (!customer_id || !product_id) return res.status(400).json({ error: "customer_id and product_id required" });
  db.prepare("INSERT INTO user_events (customer_id, event_type, product_id) VALUES (?,?,?)").run(customer_id, "view", product_id);
  res.json({ ok: true });
});

app.get("/api/dashboard", (_req, res) => {
  const totalCustomers = (db.prepare("SELECT COUNT(*) as c FROM customers").get() as any).c;
  const totalProducts = (db.prepare("SELECT COUNT(*) as c FROM products").get() as any).c;
  const totalTransactions = (db.prepare("SELECT COUNT(*) as c FROM transactions").get() as any).c;
  const totalRevenue = (db.prepare("SELECT COALESCE(SUM(revenue),0) as r FROM customers").get() as any).r;
  const totalAmountSpent = (db.prepare("SELECT COALESCE(SUM(amountspent),0) as a FROM customers").get() as any).a;
  const recommendationsSent = (db.prepare("SELECT COUNT(*) as c FROM log WHERE recommendation_sent = 1").get() as any).c;
  const purchasesFromRecs = (db.prepare("SELECT COUNT(*) as c FROM log WHERE product_purchased = 1").get() as any).c;

  const topProducts = db.prepare(`
    SELECT p.id, p.pname, p.category, p.severity, p.sellingprice, p.image,
      COUNT(*) as purchase_count
    FROM transactions t, json_each(t.product) je
    JOIN products p ON p.id = json_extract(je.value, '$.id')
    GROUP BY p.id ORDER BY purchase_count DESC LIMIT 5
  `).all();

  const categoryBreakdown = db.prepare("SELECT category, COUNT(*) as count FROM products GROUP BY category ORDER BY category").all();

  const recentLogs = db.prepare(`
    SELECT l.*, c.cname as customer_name
    FROM log l
    LEFT JOIN customers c ON c.id = l.customer_id
    ORDER BY l.created_at DESC LIMIT 20
  `).all();

  res.json({
    totalCustomers,
    totalProducts,
    totalTransactions,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalAmountSpent,
    recommendationsSent,
    purchasesFromRecs,
    conversionRate: recommendationsSent > 0 ? Number(((purchasesFromRecs / recommendationsSent) * 100).toFixed(1)) : 0,
    topProducts,
    categoryBreakdown,
    recentLogs,
  });
});

// --- Admin Product Management ---
app.post("/api/admin/products", (req, res) => {
  const { pname, netprice, sellingprice, category, severity, description, image, problem_tags, brand, product_type } = req.body;
  if (!pname || !category || !severity) return res.status(400).json({ error: "pname, category, severity required" });
  const info = db.prepare("INSERT INTO products (pname, netprice, sellingprice, category, severity, description, image, problem_tags, brand, product_type) VALUES (?,?,?,?,?,?,?,?,?,?)")
    .run(pname, netprice || 0, sellingprice || 0, category, severity, description || null, image || null, problem_tags || null, brand || null, product_type || null);
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid);
  res.json(product);
});

app.put("/api/admin/products/:id", (req, res) => {
  const { pname, netprice, sellingprice, category, severity, description, image, problem_tags, brand, product_type } = req.body;
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found" });

  db.prepare(`UPDATE products SET pname=?, netprice=?, sellingprice=?, category=?, severity=?, description=?, image=?, problem_tags=?, brand=?, product_type=? WHERE id=?`)
    .run(pname, netprice || 0, sellingprice || 0, category, severity, description || null, image || null, problem_tags || null, brand || null, product_type || null, req.params.id);
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  res.json(product);
});

app.delete("/api/admin/products/:id", (req, res) => {
  const existing = db.prepare("SELECT id FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Product not found" });
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
