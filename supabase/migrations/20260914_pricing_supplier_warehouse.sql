-- =====================================================================
-- Purchase cost, supplier on receipts, and warehouses
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Run 20260913_images_descriptions_and_view_fix.sql first.
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Warehouses
--
-- Stock now lives somewhere. Exactly one warehouse is the default, used
-- for the forms' initial selection and for stock received before this
-- migration existed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS warehouses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  location   text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- At most one default.
CREATE UNIQUE INDEX IF NOT EXISTS warehouses_single_default
  ON warehouses (is_default) WHERE is_default;

INSERT INTO warehouses (name, location, is_default)
SELECT 'Main Warehouse', NULL, true
WHERE NOT EXISTS (SELECT 1 FROM warehouses);

-- ---------------------------------------------------------------------
-- 2. Stock IN: what it cost, who supplied it, where it went
-- ---------------------------------------------------------------------
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS unit_cost    numeric(12,2);
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS supplier_id  uuid REFERENCES suppliers(id);
ALTER TABLE stock_batches ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);

-- Cost is per unit, never negative. Left NULL for stock received before
-- this migration, so "unknown cost" stays distinguishable from "free".
ALTER TABLE stock_batches DROP CONSTRAINT IF EXISTS stock_batches_unit_cost_check;
ALTER TABLE stock_batches ADD CONSTRAINT stock_batches_unit_cost_check
  CHECK (unit_cost IS NULL OR unit_cost >= 0);

-- ---------------------------------------------------------------------
-- 3. Stock OUT: what it sold for, what it cost us, where it left from
--
-- cogs is the cost of the exact batches FIFO consumed, worked out at the
-- moment of issue. Storing it keeps historic profit correct even if a
-- batch is later corrected.
-- ---------------------------------------------------------------------
ALTER TABLE stock_out ADD COLUMN IF NOT EXISTS unit_price   numeric(12,2);
ALTER TABLE stock_out ADD COLUMN IF NOT EXISTS cogs         numeric(14,2);
ALTER TABLE stock_out ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id);

ALTER TABLE stock_out DROP CONSTRAINT IF EXISTS stock_out_unit_price_check;
ALTER TABLE stock_out ADD CONSTRAINT stock_out_unit_price_check
  CHECK (unit_price IS NULL OR unit_price >= 0);

-- ---------------------------------------------------------------------
-- 4. Put existing stock somewhere
--
-- Without this, stock received before today belongs to no warehouse and
-- disappears from every warehouse-filtered view.
-- ---------------------------------------------------------------------
UPDATE stock_batches
   SET warehouse_id = (SELECT id FROM warehouses WHERE is_default LIMIT 1)
 WHERE warehouse_id IS NULL;

UPDATE stock_out
   SET warehouse_id = (SELECT id FROM warehouses WHERE is_default LIMIT 1)
 WHERE warehouse_id IS NULL;

-- ---------------------------------------------------------------------
-- 5. Indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS stock_batches_supplier_idx  ON stock_batches (supplier_id);
CREATE INDEX IF NOT EXISTS stock_batches_warehouse_idx ON stock_batches (warehouse_id);
CREATE INDEX IF NOT EXISTS stock_out_warehouse_idx     ON stock_out (warehouse_id);

-- The FIFO pick list, now scoped per warehouse.
CREATE INDEX IF NOT EXISTS stock_batches_fifo_warehouse_idx
  ON stock_batches (product_id, warehouse_id, batch_date, created_at)
  WHERE remaining_qty > 0;

-- ---------------------------------------------------------------------
-- 6. Inventory view: unchanged totals, plus what the stock is worth
--
-- stock_value prices every open batch at what that batch actually cost,
-- which is the same FIFO basis the profit figures use.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS inventory;
CREATE VIEW inventory AS
SELECT p.id, p.name, p.sku, p.unit, p.min_stock,
       p.category_id, p.supplier_id,
       COALESCE(SUM(b.remaining_qty), 0)::integer AS current_stock,
       COALESCE(SUM(b.remaining_qty * b.unit_cost), 0)::numeric(14,2) AS stock_value,
       CASE WHEN COALESCE(SUM(b.remaining_qty),0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(b.remaining_qty),0) <= p.min_stock THEN 'low_stock'
            ELSE 'ok' END AS stock_status
FROM products p
LEFT JOIN stock_batches b ON b.product_id = p.id
GROUP BY p.id;

GRANT SELECT ON inventory TO authenticated;

-- ---------------------------------------------------------------------
-- 7. Per-warehouse breakdown
--
-- One row per product per warehouse holding stock. The product-level
-- `inventory` view above still totals every warehouse together, so the
-- existing screens keep working unchanged.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS inventory_by_warehouse;
CREATE VIEW inventory_by_warehouse AS
SELECT b.product_id,
       b.warehouse_id,
       p.name  AS product_name,
       p.sku,
       p.unit,
       p.min_stock,
       w.name  AS warehouse_name,
       COALESCE(SUM(b.remaining_qty), 0)::integer AS current_stock,
       COALESCE(SUM(b.remaining_qty * b.unit_cost), 0)::numeric(14,2) AS stock_value
FROM stock_batches b
JOIN products   p ON p.id = b.product_id
JOIN warehouses w ON w.id = b.warehouse_id
WHERE b.remaining_qty > 0
GROUP BY b.product_id, b.warehouse_id, p.name, p.sku, p.unit, p.min_stock, w.name;

GRANT SELECT ON inventory_by_warehouse TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Access control for the new table
--
-- Matched to how the other tables in this project are protected. If your
-- database was created from the specification SQL (which has no RLS),
-- these two statements are the only protection warehouses will have —
-- the other tables stay open until RLS is enabled on them too.
-- ---------------------------------------------------------------------
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warehouses_authenticated_all ON warehouses;
CREATE POLICY warehouses_authenticated_all ON warehouses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
