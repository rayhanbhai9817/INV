-- =====================================================================
-- Fast Sold LLC — Inventory Management System
-- Supabase / PostgreSQL schema
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. categories
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. suppliers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  phone      text,
  email      text,
  address    text,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. products
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  sku         text UNIQUE,
  category_id uuid REFERENCES categories(id),
  supplier_id uuid REFERENCES suppliers(id),
  unit        text DEFAULT 'pcs',
  min_stock   integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. stock_batches  (FIFO core)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_batches (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid REFERENCES products(id),
  box_count     integer NOT NULL,
  qty_per_box   integer NOT NULL,
  total_qty     integer NOT NULL,
  remaining_qty integer NOT NULL,
  batch_date    date DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 5. stock_out
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_out (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  total_qty  integer NOT NULL,
  out_date   date DEFAULT CURRENT_DATE,
  note       text,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. ledger  (immutable audit log)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ledger (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  type       text CHECK (type IN ('IN','OUT')),
  qty        integer NOT NULL,
  batch_id   uuid REFERENCES stock_batches(id),
  reference  text,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 7. product_prices  (independent module — no link to stock flow)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_prices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid REFERENCES products(id),
  unit_price  numeric(12,2) NOT NULL,
  unit        integer NOT NULL,
  total_price numeric(12,2) GENERATED ALWAYS AS (unit_price * unit) STORED,
  date        date DEFAULT CURRENT_DATE,
  note        text,
  created_at  timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message    text NOT NULL,
  is_read    boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 9. settings
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key   text UNIQUE NOT NULL,
  value text
);

-- ---------------------------------------------------------------------
-- 10. inventory view (current stock per product)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW inventory AS
SELECT p.id, p.name, p.sku, p.unit, p.min_stock,
       p.category_id, p.supplier_id,
       COALESCE(SUM(b.remaining_qty), 0)::integer AS current_stock,
       CASE WHEN COALESCE(SUM(b.remaining_qty),0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(b.remaining_qty),0) <= p.min_stock THEN 'low_stock'
            ELSE 'ok' END AS stock_status
FROM products p
LEFT JOIN stock_batches b ON b.product_id = p.id
GROUP BY p.id;

-- =====================================================================
-- Indexes — keep FIFO reads and report filters fast
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_products_category      ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier      ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_batches_product        ON stock_batches(product_id);
-- the FIFO pick list: open batches for a product, oldest first
CREATE INDEX IF NOT EXISTS idx_batches_fifo           ON stock_batches(product_id, batch_date, created_at)
  WHERE remaining_qty > 0;
CREATE INDEX IF NOT EXISTS idx_ledger_product         ON ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created         ON ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_batch           ON ledger(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_product      ON stock_out(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_out_date         ON stock_out(out_date DESC);
CREATE INDEX IF NOT EXISTS idx_prices_product         ON product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON notifications(is_read, created_at DESC);

-- =====================================================================
-- Data integrity — never allow negative or nonsensical stock
-- =====================================================================
ALTER TABLE stock_batches DROP CONSTRAINT IF EXISTS stock_batches_qty_sane;
ALTER TABLE stock_batches ADD CONSTRAINT stock_batches_qty_sane CHECK (
  box_count     > 0 AND
  qty_per_box   > 0 AND
  total_qty     > 0 AND
  remaining_qty >= 0 AND
  remaining_qty <= total_qty
);

ALTER TABLE stock_out DROP CONSTRAINT IF EXISTS stock_out_qty_positive;
ALTER TABLE stock_out ADD CONSTRAINT stock_out_qty_positive CHECK (total_qty > 0);

ALTER TABLE ledger DROP CONSTRAINT IF EXISTS ledger_qty_positive;
ALTER TABLE ledger ADD CONSTRAINT ledger_qty_positive CHECK (qty > 0);

ALTER TABLE product_prices DROP CONSTRAINT IF EXISTS product_prices_sane;
ALTER TABLE product_prices ADD CONSTRAINT product_prices_sane CHECK (unit_price >= 0 AND unit > 0);

-- The ledger is an append-only audit log: no updates, no deletes.
CREATE OR REPLACE FUNCTION ledger_is_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger entries are immutable (attempted %)', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS ledger_no_update ON ledger;
CREATE TRIGGER ledger_no_update BEFORE UPDATE OR DELETE ON ledger
  FOR EACH ROW EXECUTE FUNCTION ledger_is_immutable();

-- =====================================================================
-- Row Level Security — single signed-in operator has full access
-- =====================================================================
ALTER TABLE categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_out      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger         ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings       ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','suppliers','products','stock_batches',
                           'stock_out','ledger','product_prices','notifications','settings']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_authenticated_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      t || '_authenticated_all', t);
  END LOOP;
END $$;

GRANT SELECT ON inventory TO authenticated;

-- =====================================================================
-- Default settings rows
-- =====================================================================
INSERT INTO settings (key, value) VALUES
  ('company_name',        'Fast Sold LLC'),
  ('low_stock_threshold', '10'),
  ('currency',            'USD'),
  ('date_format',         'YYYY-MM-DD'),
  ('rows_per_page',       '25')
ON CONFLICT (key) DO NOTHING;
