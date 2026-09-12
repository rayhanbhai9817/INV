-- =====================================================================
-- Backfill prices onto stock received and issued before costing existed
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Run the two migrations first (20260913_… then 20260914_…).
--
-- Work through it one STEP at a time: select the step's text and press
-- Run, rather than running the whole file at once. Every step is safe to
-- run more than once, and every step that writes has a preview above it.
--
-- Only STEP 2 needs editing. The rest run as they are.
-- =====================================================================


-- ---------------------------------------------------------------------
-- STEP 1 — What is missing? (reads only, changes nothing)
--
-- Every receipt with no cost. `remaining_qty` is what is still on hand:
-- filling those in is what corrects your stock value.
-- ---------------------------------------------------------------------
SELECT p.sku,
       p.name              AS product,
       b.batch_date        AS received,
       b.total_qty         AS received_units,
       b.remaining_qty     AS still_on_hand,
       b.unit_cost
FROM stock_batches b
JOIN products p ON p.id = b.product_id
WHERE b.unit_cost IS NULL
ORDER BY p.name, b.batch_date;


-- ---------------------------------------------------------------------
-- STEP 2 — Set the purchase cost  ✏️ EDIT THIS ONE
--
-- Put one line per product in the list below: the SKU exactly as STEP 1
-- printed it, and what ONE UNIT cost you (not the price of a whole box).
--
--   ('BEV-001', 38.00),      <- 38.00 per unit
--   ('SNK-014', 15.50),
--
-- Products you leave out keep their blank cost, which is fine — blank
-- means "not known" and the reports say so rather than guessing.
--
-- Only receipts that have NO cost yet are touched, so anything you have
-- already entered by hand in the app is left alone.
-- ---------------------------------------------------------------------
WITH cost_list (sku, unit_cost) AS (
  VALUES
    -- ✏️ replace these two example lines with your own
    ('BEV-001', 38.00),
    ('SNK-014', 15.50)
)
UPDATE stock_batches b
   SET unit_cost = c.unit_cost
  FROM products p, cost_list c
 WHERE b.product_id = p.id
   AND p.sku = c.sku
   AND b.unit_cost IS NULL;

-- Check it landed: stock_value should no longer be 0.
SELECT name, current_stock, stock_value FROM inventory ORDER BY name;


-- ---------------------------------------------------------------------
-- STEP 3 — Supplier and warehouse on old receipts (optional)
--
-- Old receipts were already put in the default warehouse by the
-- migration. This names the supplier they came from, if you want the
-- supplier purchase history to include them.
--
-- Supplier names are matched exactly. If you happen to have two
-- suppliers with the same name, rename one first — otherwise which of
-- the two gets credited here is arbitrary.
-- ---------------------------------------------------------------------
WITH supplier_list (sku, supplier_name) AS (
  VALUES
    -- ✏️ your own lines, or skip this whole step
    ('BEV-001', 'Delta Traders')
)
UPDATE stock_batches b
   SET supplier_id = s.id
  FROM products p, supplier_list sl, suppliers s
 WHERE b.product_id = p.id
   AND p.sku = sl.sku
   AND s.name = sl.supplier_name
   AND b.supplier_id IS NULL;


-- ---------------------------------------------------------------------
-- STEP 4a — Preview: what did past dispatches cost? (reads only)
--
-- The ledger records which batch every dispatch came out of, so once
-- STEP 2 has given those batches a cost, the cost of each past dispatch
-- can be worked out again.
--
-- `matched_units` must equal `dispatched_units` for a row to be written
-- in STEP 4b. If it does not, the ledger does not fully explain that
-- dispatch and it is left alone rather than half-costed.
-- ---------------------------------------------------------------------
WITH out_lines AS (
  SELECT l.qty,
         b.unit_cost,
         s.id AS stock_out_id
    FROM ledger l
    JOIN stock_batches b ON b.id = l.batch_id
    JOIN LATERAL (
      -- The dispatch row and its ledger lines are written seconds apart
      -- in one operation, so the nearest one for that product is its own.
      SELECT so.id
        FROM stock_out so
       WHERE so.product_id = l.product_id
         AND abs(extract(epoch FROM (so.created_at - l.created_at))) <= 300
       ORDER BY abs(extract(epoch FROM (so.created_at - l.created_at)))
       LIMIT 1
    ) s ON true
   WHERE l.type = 'OUT'
     AND l.batch_id IS NOT NULL
)
SELECT so.out_date,
       p.name                         AS product,
       so.total_qty                   AS dispatched_units,
       sum(o.qty)                     AS matched_units,
       CASE WHEN bool_or(o.unit_cost IS NULL) THEN NULL
            ELSE sum(o.qty * o.unit_cost) END AS cost_to_write,
       so.cogs                        AS cost_now
  FROM out_lines o
  JOIN stock_out so ON so.id = o.stock_out_id
  JOIN products  p  ON p.id = so.product_id
 GROUP BY so.id, so.out_date, p.name, so.total_qty, so.cogs
 ORDER BY so.out_date;


-- ---------------------------------------------------------------------
-- STEP 4b — Write those costs onto the past dispatches
--
-- Run this once STEP 4a looks right.
-- ---------------------------------------------------------------------
WITH out_lines AS (
  SELECT l.qty,
         b.unit_cost,
         s.id AS stock_out_id
    FROM ledger l
    JOIN stock_batches b ON b.id = l.batch_id
    JOIN LATERAL (
      SELECT so.id
        FROM stock_out so
       WHERE so.product_id = l.product_id
         AND abs(extract(epoch FROM (so.created_at - l.created_at))) <= 300
       ORDER BY abs(extract(epoch FROM (so.created_at - l.created_at)))
       LIMIT 1
    ) s ON true
   WHERE l.type = 'OUT'
     AND l.batch_id IS NOT NULL
),
totals AS (
  SELECT stock_out_id,
         sum(qty) AS matched_units,
         CASE WHEN bool_or(unit_cost IS NULL) THEN NULL
              ELSE sum(qty * unit_cost) END AS cogs
    FROM out_lines
   GROUP BY stock_out_id
)
UPDATE stock_out so
   SET cogs = t.cogs
  FROM totals t
 WHERE so.id = t.stock_out_id
   AND t.cogs IS NOT NULL
   AND t.matched_units = so.total_qty   -- fully explained by the ledger
   AND so.cogs IS NULL;                 -- never overwrite a real figure


-- ---------------------------------------------------------------------
-- STEP 5 — Selling price on past dispatches (optional)
--
-- What you SOLD for was never recorded anywhere, so nothing can work it
-- out — only your own records know. Fill these in to get profit on past
-- sales; skip the step to leave them blank.
--
-- Each line is: the dispatch date, the SKU, and the price per unit.
-- ---------------------------------------------------------------------
WITH price_list (out_date, sku, unit_price) AS (
  VALUES
    -- ✏️ your own lines, or skip this whole step
    (DATE '2026-08-20', 'BEV-001', 55.00)
)
UPDATE stock_out so
   SET unit_price = pl.unit_price
  FROM products p, price_list pl
 WHERE so.product_id = p.id
   AND p.sku = pl.sku
   AND so.out_date = pl.out_date
   AND so.unit_price IS NULL;


-- ---------------------------------------------------------------------
-- STEP 6 — Check the result (reads only)
--
-- Stock still to sell, and what each past dispatch now shows.
-- ---------------------------------------------------------------------
SELECT name, current_stock, stock_value FROM inventory ORDER BY name;

SELECT so.out_date,
       p.name                                  AS product,
       so.total_qty                            AS units,
       so.unit_price,
       so.total_qty * so.unit_price            AS sold_for,
       so.cogs                                 AS cost,
       so.total_qty * so.unit_price - so.cogs  AS profit
  FROM stock_out so
  JOIN products p ON p.id = so.product_id
 ORDER BY so.out_date;

-- Anything still missing a cost:
SELECT p.sku, p.name, b.batch_date, b.remaining_qty
  FROM stock_batches b
  JOIN products p ON p.id = b.product_id
 WHERE b.unit_cost IS NULL
 ORDER BY p.name, b.batch_date;
