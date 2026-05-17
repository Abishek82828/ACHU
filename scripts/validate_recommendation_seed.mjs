import Database from "better-sqlite3";
import fs from "fs";

const db = new Database(":memory:");

db.exec(fs.readFileSync("backend/sql/recommendation_schema.sql", "utf8"));
db.exec(fs.readFileSync("backend/sql/recommendation_seed.sql", "utf8"));

function scalar(query) {
  const row = db.prepare(query).get();
  return row[Object.keys(row)[0]];
}

const counts = {
  products: scalar("SELECT COUNT(*) AS c FROM products"),
  customers: scalar("SELECT COUNT(*) AS c FROM customers"),
  transactions: scalar("SELECT COUNT(*) AS c FROM transactions"),
  transaction_items: scalar("SELECT COUNT(*) AS c FROM transaction_items"),
};

const behavior = {
  hair_oil_with_shampoo_orders: scalar(`
    SELECT COUNT(*) AS c
    FROM transactions t
    WHERE EXISTS (
      SELECT 1
      FROM transaction_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transaction_id = t.id
        AND p.category = 'Hair'
        AND lower(p.name) LIKE '%oil%'
    )
    AND EXISTS (
      SELECT 1
      FROM transaction_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transaction_id = t.id
        AND p.category = 'Hair'
        AND lower(p.name) LIKE '%shampoo%'
    )
  `),
  facewash_with_moisturizer_or_serum_orders: scalar(`
    SELECT COUNT(*) AS c
    FROM transactions t
    WHERE EXISTS (
      SELECT 1
      FROM transaction_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transaction_id = t.id
        AND p.category = 'Face'
        AND lower(p.name) LIKE '%face wash%'
    )
    AND EXISTS (
      SELECT 1
      FROM transaction_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transaction_id = t.id
        AND p.category = 'Face'
        AND (
          lower(p.name) LIKE '%moisturizer%'
          OR lower(p.name) LIKE '%serum%'
        )
    )
  `),
  oral_bundle_orders: scalar(`
    SELECT COUNT(*) AS c
    FROM transactions t
    WHERE EXISTS (
      SELECT 1
      FROM transaction_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transaction_id = t.id
        AND p.category = 'Oral'
        AND lower(p.name) LIKE '%toothpaste%'
    )
    AND EXISTS (
      SELECT 1
      FROM transaction_items ti
      JOIN products p ON p.id = ti.product_id
      WHERE ti.transaction_id = t.id
        AND p.category = 'Oral'
        AND lower(p.name) LIKE '%toothbrush%'
    )
  `),
  customers_with_3plus_orders: scalar(`
    SELECT COUNT(*) AS c
    FROM (
      SELECT customer_id, COUNT(*) AS txn_count
      FROM transactions
      GROUP BY customer_id
      HAVING COUNT(*) >= 3
    ) x
  `),
};

console.log(JSON.stringify({ counts, behavior }, null, 2));
