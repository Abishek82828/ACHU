import Database from "better-sqlite3";
import fs from "fs";

const db = new Database("verdant.db");

const customerColumns = db.prepare("PRAGMA table_info(customers)").all();
const names = new Set(customerColumns.map((c) => c.name));

if (!names.has("gender")) {
  db.exec("ALTER TABLE customers ADD COLUMN gender TEXT");
}
if (!names.has("created_at")) {
  db.exec("ALTER TABLE customers ADD COLUMN created_at TEXT");
}

const sql = fs.readFileSync("backend/sql/demo_user_e2e.sql", "utf8");
db.exec(sql);

const user = db
  .prepare("SELECT id, name, email, gender, created_at FROM customers WHERE id = 9001")
  .get();
const tx = db.prepare("SELECT COUNT(*) AS c FROM transactions WHERE customer_id = 9001").get();
const ti = db
  .prepare("SELECT COUNT(*) AS c FROM transaction_items WHERE transaction_id IN (SELECT id FROM transactions WHERE customer_id = 9001)")
  .get();
const range = db
  .prepare("SELECT MIN(date) AS first_order, MAX(date) AS last_order FROM transactions WHERE customer_id = 9001")
  .get();

console.log(JSON.stringify({ user, transactions: tx.c, transaction_items: ti.c, range }, null, 2));
