import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { getRecommendations } from "./recommendationEngine";

interface SeedProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  image: string;
  tag: string;
  problem_tags: string;
}

function createTestDb() {
  const db = new Database(":memory:");

  db.exec(`
    CREATE TABLE customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      password TEXT
    );

    CREATE TABLE products (
      id INTEGER PRIMARY KEY,
      name TEXT,
      category TEXT,
      price REAL,
      description TEXT,
      image TEXT,
      tag TEXT,
      problem_tags TEXT
    );

    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      date TEXT,
      total REAL
    );

    CREATE TABLE transaction_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      price REAL
    );
  `);

  db.exec(`
    CREATE INDEX idx_transactions_customer_date ON transactions(customer_id, date DESC);
    CREATE INDEX idx_transaction_items_transaction_id ON transaction_items(transaction_id);
    CREATE INDEX idx_transaction_items_product_id ON transaction_items(product_id);
    CREATE INDEX idx_products_category ON products(category);
  `);

  db.prepare("INSERT INTO customers (id, name, email, password) VALUES (?, ?, ?, ?)").run(
    1,
    "Demo User",
    "demo@example.com",
    "password123",
  );

  const products: SeedProduct[] = [
    {
      id: 1,
      name: "Biotin Hair Growth Serum",
      category: "Hair Care",
      price: 34,
      description: "Helps with thinning and hair fall.",
      image: "img-1",
      tag: "Best Seller",
      problem_tags: "hair-fall,thinning",
    },
    {
      id: 2,
      name: "Organic Lavender Shampoo",
      category: "Hair Care",
      price: 24,
      description: "Targets dandruff and dry scalp.",
      image: "img-2",
      tag: "Popular",
      problem_tags: "dandruff,dry-scalp",
    },
    {
      id: 3,
      name: "Coconut Milk Conditioner",
      category: "Hair Care",
      price: 21,
      description: "Deeply hydrates dry and damaged hair.",
      image: "img-3",
      tag: "New",
      problem_tags: "dry-hair,frizz",
    },
    {
      id: 4,
      name: "Tea Tree Face Wash",
      category: "Skin Care",
      price: 20,
      description: "Cleans pores and supports acne-prone skin.",
      image: "img-4",
      tag: "Best Seller",
      problem_tags: "acne,oily-skin",
    },
    {
      id: 5,
      name: "Daily Moisturizer Cream",
      category: "Skin Care",
      price: 27,
      description: "Hydrating moisturizer for balanced skin.",
      image: "img-5",
      tag: "Popular",
      problem_tags: "acne,dryness",
    },
    {
      id: 6,
      name: "Eucalyptus Body Wash",
      category: "Body Care",
      price: 18,
      description: "Gentle cleansing for everyday use.",
      image: "img-6",
      tag: "Popular",
      problem_tags: "dry-skin",
    },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, price, description, image, tag, problem_tags)
    VALUES (@id, @name, @category, @price, @description, @image, @tag, @problem_tags)
  `);

  for (const product of products) {
    insertProduct.run(product);
  }

  return db;
}

function addPurchase(
  db: Database.Database,
  customerId: number,
  dateIso: string,
  items: Array<{ productId: number; quantity: number }>,
) {
  const insertTxn = db.prepare("INSERT INTO transactions (customer_id, date, total) VALUES (?, ?, ?)");
  const insertItem = db.prepare(
    "INSERT INTO transaction_items (transaction_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
  );
  const productPrice = db.prepare("SELECT price FROM products WHERE id = ?");

  const total = items.reduce((sum, item) => {
    const row = productPrice.get(item.productId) as { price: number };
    return sum + row.price * item.quantity;
  }, 0);

  const info = insertTxn.run(customerId, dateIso, total);
  const transactionId = Number(info.lastInsertRowid);

  for (const item of items) {
    const row = productPrice.get(item.productId) as { price: number };
    insertItem.run(transactionId, item.productId, item.quantity, row.price);
  }
}

test("returns popular fallback for users without purchase history", () => {
  const db = createTestDb();
  const recommendations = getRecommendations(db, {
    customerId: 0,
    limit: 4,
    now: new Date("2026-04-11T00:00:00.000Z"),
  });

  assert.equal(recommendations.length, 4);
  assert.ok(recommendations.every((item) => item.recommendation_rule === "popular"));
});

test("refill rule recommends previously purchased item after 20+ days", () => {
  const db = createTestDb();
  addPurchase(db, 1, "2026-03-15T00:00:00.000Z", [{ productId: 6, quantity: 1 }]);

  const recommendations = getRecommendations(db, {
    customerId: 1,
    limit: 5,
    now: new Date("2026-04-11T00:00:00.000Z"),
  });

  const refillItem = recommendations.find((item) => item.id === 6);
  assert.ok(refillItem);
  assert.equal(refillItem?.recommendation_rule, "refill");
});

test("cross-sell and category rules suggest companion products", () => {
  const db = createTestDb();
  addPurchase(db, 1, "2026-04-09T00:00:00.000Z", [{ productId: 1, quantity: 1 }]);

  const recommendations = getRecommendations(db, {
    customerId: 1,
    limit: 6,
    now: new Date("2026-04-11T00:00:00.000Z"),
  });

  const recommendedIds = recommendations.map((item) => item.id);
  assert.ok(recommendedIds.includes(2) || recommendedIds.includes(3));
});

test("problem-based rule uses product problem tags", () => {
  const db = createTestDb();
  addPurchase(db, 1, "2026-04-10T00:00:00.000Z", [{ productId: 4, quantity: 1 }]);

  const recommendations = getRecommendations(db, {
    customerId: 1,
    limit: 6,
    now: new Date("2026-04-11T00:00:00.000Z"),
  });

  const moisturizer = recommendations.find((item) => item.id === 5);
  assert.ok(moisturizer);
  assert.ok(moisturizer?.recommendation_rules.includes("problem"));
});

test("recommendations adapt after a new purchase is recorded", () => {
  const db = createTestDb();
  addPurchase(db, 1, "2026-04-09T00:00:00.000Z", [{ productId: 1, quantity: 1 }]);

  const before = getRecommendations(db, {
    customerId: 1,
    limit: 6,
    now: new Date("2026-04-11T00:00:00.000Z"),
  });

  const beforeHasShampoo = before.some((item) => item.id === 2);
  assert.ok(beforeHasShampoo);

  addPurchase(db, 1, "2026-04-10T00:00:00.000Z", [{ productId: 2, quantity: 1 }]);

  const after = getRecommendations(db, {
    customerId: 1,
    limit: 6,
    now: new Date("2026-04-11T00:00:00.000Z"),
  });

  const afterHasShampoo = after.some((item) => item.id === 2);
  assert.equal(afterHasShampoo, false);
});
