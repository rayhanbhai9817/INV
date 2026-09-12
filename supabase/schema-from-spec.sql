-- =====================================================================
-- Ozipco — Inventory Management System
-- DATABASE TABLES (run in Supabase SQL Editor)
--
-- This is the schema exactly as specified in the project document:
-- the nine tables and the inventory view, nothing added.
-- Run it in: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- =====================================================================

-- 1. categories
CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- 2. suppliers
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  created_at timestamptz DEFAULT now()
);

-- 3. products
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text UNIQUE,
  category_id uuid REFERENCES categories(id),
  supplier_id uuid REFERENCES suppliers(id),
  unit text DEFAULT 'pcs',
  min_stock integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 4. stock_batches (FIFO core)
CREATE TABLE stock_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  box_count integer NOT NULL,
  qty_per_box integer NOT NULL,
  total_qty integer NOT NULL,
  remaining_qty integer NOT NULL,
  batch_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

-- 5. stock_out
CREATE TABLE stock_out (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  total_qty integer NOT NULL,
  out_date date DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz DEFAULT now()
);

-- 6. ledger
CREATE TABLE ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  type text CHECK (type IN ('IN','OUT')),
  qty integer NOT NULL,
  batch_id uuid REFERENCES stock_batches(id),
  reference text,
  created_at timestamptz DEFAULT now()
);

-- 7. product_prices (independent module)
CREATE TABLE product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id),
  unit_price numeric(12,2) NOT NULL,
  unit integer NOT NULL,
  total_price numeric(12,2) GENERATED ALWAYS AS (unit_price * unit) STORED,
  date date DEFAULT CURRENT_DATE,
  note text,
  created_at timestamptz DEFAULT now()
);

-- 8. notifications
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 9. settings
CREATE TABLE settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text
);

-- 10. Inventory view (current stock per product)
CREATE VIEW inventory AS
SELECT p.id, p.name, p.sku, p.unit, p.min_stock,
       COALESCE(SUM(b.remaining_qty), 0) AS current_stock,
       CASE WHEN COALESCE(SUM(b.remaining_qty),0) = 0 THEN 'out_of_stock'
            WHEN COALESCE(SUM(b.remaining_qty),0) <= p.min_stock THEN 'low_stock'
            ELSE 'ok' END AS stock_status
FROM products p
LEFT JOIN stock_batches b ON b.product_id = p.id
GROUP BY p.id;


-- =====================================================================
-- TWO THINGS TO KNOW BEFORE YOU USE ONLY THIS FILE
-- =====================================================================
--
-- 1) The Inventory page and the Supplier report filter the view by
--    category and supplier. The view above does not select those two
--    columns, so those filters will fail with "column does not exist".
--    To fix, run this afterwards:
--
--      CREATE OR REPLACE VIEW inventory AS
--      SELECT p.id, p.name, p.sku, p.unit, p.min_stock,
--             p.category_id, p.supplier_id,
--             COALESCE(SUM(b.remaining_qty), 0) AS current_stock,
--             CASE WHEN COALESCE(SUM(b.remaining_qty),0) = 0 THEN 'out_of_stock'
--                  WHEN COALESCE(SUM(b.remaining_qty),0) <= p.min_stock THEN 'low_stock'
--                  ELSE 'ok' END AS stock_status
--      FROM products p
--      LEFT JOIN stock_batches b ON b.product_id = p.id
--      GROUP BY p.id;
--
-- 2) These tables have no Row Level Security. Supabase exposes every
--    public table through its API, and the anon key ships inside the
--    browser bundle, so without RLS anyone who opens the site can read
--    and write your data. To close that, run supabase/schema.sql, or at
--    minimum enable RLS and add a policy per table:
--
--      ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
--      CREATE POLICY categories_authenticated_all ON categories
--        FOR ALL TO authenticated USING (true) WITH CHECK (true);
--      -- ...and the same for the other eight tables.
--
-- supabase/schema.sql in this repo is this same schema plus RLS,
-- indexes, quantity constraints, an append-only ledger trigger and the
-- default settings rows.
-- =====================================================================
