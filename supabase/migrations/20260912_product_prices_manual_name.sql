-- =====================================================================
-- Product Price: allow a manually typed product name
--
-- Price entries may now name a product that is not in the catalogue.
-- product_id was already nullable, so the only addition is somewhere to
-- put the typed name, plus a guard so every row still identifies
-- something.
--
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once.
-- =====================================================================

ALTER TABLE product_prices
  ADD COLUMN IF NOT EXISTS product_name text;

-- Every entry must point at a catalogue product or carry a typed name.
ALTER TABLE product_prices DROP CONSTRAINT IF EXISTS product_prices_identifies_product;
ALTER TABLE product_prices ADD CONSTRAINT product_prices_identifies_product CHECK (
  product_id IS NOT NULL OR (product_name IS NOT NULL AND length(btrim(product_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_prices_manual
  ON product_prices(product_name)
  WHERE product_id IS NULL;
