-- =====================================================================
-- Product images, descriptions, and the inventory view fix
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------
ALTER TABLE products       ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE products       ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE categories     ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE product_prices ADD COLUMN IF NOT EXISTS image_url   text;

-- ---------------------------------------------------------------------
-- 2. Inventory view
--
-- The version in the original specification selects neither category_id
-- nor supplier_id, so anything grouping by category came out empty and
-- every product read as uncategorised. Recreating the view adds them.
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS inventory;
CREATE VIEW inventory AS
SELECT p.id, p.name, p.sku, p.unit, p.min_stock,
       p.category_id, p.supplier_id,
       COALESCE(SUM(b.remaining_qty), 0)::integer AS current_stock,
       CASE WHEN COALESCE(SUM(b.remaining_qty),0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(b.remaining_qty),0) <= p.min_stock THEN 'low_stock'
            ELSE 'ok' END AS stock_status
FROM products p
LEFT JOIN stock_batches b ON b.product_id = p.id
GROUP BY p.id;

GRANT SELECT ON inventory TO authenticated;

-- ---------------------------------------------------------------------
-- 3. Storage bucket for product images
--
-- Private: the app reads images through short-lived signed URLs, so the
-- files are not served to anyone who happens to guess a path.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product images read"   ON storage.objects;
DROP POLICY IF EXISTS "product images insert" ON storage.objects;
DROP POLICY IF EXISTS "product images update" ON storage.objects;
DROP POLICY IF EXISTS "product images delete" ON storage.objects;

CREATE POLICY "product images read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "product images insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "product images update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-images');

CREATE POLICY "product images delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');
