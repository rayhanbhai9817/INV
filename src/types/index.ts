// ---------------------------------------------------------------------------
// TypeScript interfaces mirroring the Supabase schema (supabase/schema.sql)
// ---------------------------------------------------------------------------

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string;
  min_stock: number;
  created_at: string;
}

/** Product joined with its category / supplier names (list + detail views). */
export interface ProductWithRelations extends Product {
  category: Pick<Category, "id" | "name"> | null;
  supplier: Pick<Supplier, "id" | "name"> | null;
}

export interface StockBatch {
  id: string;
  product_id: string;
  box_count: number;
  qty_per_box: number;
  total_qty: number;
  remaining_qty: number;
  batch_date: string;
  created_at: string;
}

export interface StockBatchWithProduct extends StockBatch {
  product: Pick<Product, "id" | "name" | "sku" | "unit"> | null;
}

export interface StockOut {
  id: string;
  product_id: string;
  total_qty: number;
  out_date: string;
  note: string | null;
  created_at: string;
}

export interface StockOutWithProduct extends StockOut {
  product: Pick<Product, "id" | "name" | "sku" | "unit"> | null;
}

export type LedgerType = "IN" | "OUT";

export interface LedgerEntry {
  id: string;
  product_id: string;
  type: LedgerType;
  qty: number;
  batch_id: string | null;
  reference: string | null;
  created_at: string;
}

export interface LedgerEntryWithProduct extends LedgerEntry {
  product: Pick<Product, "id" | "name" | "sku" | "unit"> | null;
}

export interface ProductPrice {
  id: string;
  product_id: string;
  unit_price: number;
  unit: number;
  /** Generated column: unit_price * unit. Never written from the client. */
  total_price: number;
  date: string;
  note: string | null;
  created_at: string;
}

export interface ProductPriceWithProduct extends ProductPrice {
  product: Pick<Product, "id" | "name" | "sku"> | null;
}

export interface Notification {
  id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string | null;
}

/** Derived box / loose / total split shown on the Products table. */
export interface ProductStockRollup {
  boxes: number;
  loose: number;
  total: number;
}

export type StockStatus = "ok" | "low_stock" | "out_of_stock";

/** Row shape of the `inventory` SQL view. */
export interface InventoryRow {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  min_stock: number;
  category_id: string | null;
  supplier_id: string | null;
  current_stock: number;
  stock_status: StockStatus;
}

// --------------------------- app-level shapes ------------------------------

export interface AppSettings {
  company_name: string;
  low_stock_threshold: number;
  currency: string;
  date_format: string;
  rows_per_page: number;
}

export interface DashboardStats {
  totalProducts: number;
  totalCategories: number;
  totalSuppliers: number;
  totalStockUnits: number;
  /** Approximate boxes still on hand, rounded up per open batch. */
  totalBoxes: number;
  lowStockCount: number;
  outOfStockCount: number;
  /** Share of products that are neither low nor out of stock. */
  healthPercent: number;
  stockInToday: number;
  stockInBoxesToday: number;
  stockOutToday: number;
  stockOutOrdersToday: number;
}

export type StatsPeriod = "today" | "yesterday" | "week" | "month";

export interface PeriodStats {
  from: string;
  to: string;
  stockIn: number;
  stockOut: number;
  netFlow: number;
  opening: number;
  closing: number;
}

export interface Paginated<T> {
  rows: T[];
  count: number;
  page: number;
  pageSize: number;
}

/** Per-batch breakdown returned by the FIFO engine. */
export interface FifoAllocation {
  batch_id: string;
  batch_date: string;
  deducted: number;
  remaining_after: number;
}

export interface StockOutResult {
  stockOutId: string;
  totalIssued: number;
  allocations: FifoAllocation[];
}
