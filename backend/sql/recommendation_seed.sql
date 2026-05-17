-- Recommendation engine seed dataset (cleared - ready for fresh data)
-- Categories used: Hair, Face, Body, Oral

BEGIN;

DELETE FROM transaction_items;
DELETE FROM transactions;
DELETE FROM customers;
DELETE FROM products;

COMMIT;
