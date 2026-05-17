-- Demo user E2E dataset for recommendation testing (cleared - ready for fresh data)
-- Target app tables: customers, transactions, transaction_items

BEGIN;

-- Clean up prior demo runs
DELETE FROM transaction_items WHERE transaction_id IN (
  91001, 91002, 91003, 91004, 91005, 91006, 91007, 91008, 91009, 91010, 91011
);
DELETE FROM transactions WHERE id IN (
  91001, 91002, 91003, 91004, 91005, 91006, 91007, 91008, 91009, 91010, 91011
);
DELETE FROM transaction_items WHERE transaction_id IN (
  SELECT id FROM transactions WHERE customer_id = 9001
);
DELETE FROM transactions WHERE customer_id = 9001;
DELETE FROM customers WHERE id = 9001 OR email = 'ananya.iyer.demo@verdant.in';

COMMIT;
