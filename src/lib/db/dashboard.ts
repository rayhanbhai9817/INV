"use client";

import { supabase } from "@/lib/supabase";
import { assertOk } from "@/lib/db/helpers";
import { todayISO } from "@/lib/utils";
import type { DashboardStats, InventoryRow, PeriodStats, StatsPeriod } from "@/types";

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  assertOk(error);
  return count ?? 0;
}

/** Inclusive day range [from, to] for the selected period, anchored on a date. */
export function periodRange(period: StatsPeriod, anchor: string): { from: string; to: string } {
  const date = new Date(`${anchor}T00:00:00`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);

  if (period === "yesterday") {
    const previous = new Date(date);
    previous.setDate(previous.getDate() - 1);
    return { from: iso(previous), to: iso(previous) };
  }
  if (period === "week") {
    const start = new Date(date);
    start.setDate(start.getDate() - 6);
    return { from: iso(start), to: iso(date) };
  }
  if (period === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    return { from: iso(start), to: iso(date) };
  }
  return { from: iso(date), to: iso(date) };
}

/** Sums ledger quantities of one type inside a timestamp window. */
async function sumLedger(
  type: "IN" | "OUT",
  options: { after?: string; from?: string; to?: string },
): Promise<number> {
  let query = supabase.from("ledger").select("qty").eq("type", type);
  if (options.after) query = query.gt("created_at", `${options.after}T23:59:59.999`);
  if (options.from) query = query.gte("created_at", `${options.from}T00:00:00`);
  if (options.to) query = query.lte("created_at", `${options.to}T23:59:59.999`);

  const { data, error } = await query;
  assertOk(error);
  return (data ?? []).reduce((sum, row) => sum + Number(row.qty ?? 0), 0);
}

/**
 * Opening / net flow / closing for the period.
 *
 * Current stock is the all-time net of the ledger, so the closing balance of a
 * past period is the current total minus everything that moved after it.
 */
export async function getPeriodStats(
  period: StatsPeriod,
  anchor: string,
  currentStock: number,
): Promise<PeriodStats> {
  const { from, to } = periodRange(period, anchor);

  const [inPeriod, outPeriod, inAfter, outAfter] = await Promise.all([
    sumLedger("IN", { from, to }),
    sumLedger("OUT", { from, to }),
    sumLedger("IN", { after: to }),
    sumLedger("OUT", { after: to }),
  ]);

  const closing = currentStock - (inAfter - outAfter);
  const netFlow = inPeriod - outPeriod;

  return {
    from,
    to,
    stockIn: inPeriod,
    stockOut: outPeriod,
    netFlow,
    closing,
    opening: closing - netFlow,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayISO();

  const [products, categories, suppliers, inventoryRes, batchesRes, stockInRes, stockOutRes] =
    await Promise.all([
      countRows("products"),
      countRows("categories"),
      countRows("suppliers"),
      supabase.from("inventory").select("current_stock,stock_status"),
      supabase.from("stock_batches").select("remaining_qty,qty_per_box").gt("remaining_qty", 0),
      supabase.from("stock_batches").select("total_qty,box_count").eq("batch_date", today),
      supabase.from("stock_out").select("total_qty").eq("out_date", today),
    ]);

  assertOk(inventoryRes.error);
  assertOk(batchesRes.error);
  assertOk(stockInRes.error);
  assertOk(stockOutRes.error);

  const inventory = (inventoryRes.data ?? []) as Pick<
    InventoryRow,
    "current_stock" | "stock_status"
  >[];

  // Boxes still on hand, rounded up per open batch.
  const totalBoxes = (batchesRes.data ?? []).reduce((sum, batch) => {
    const perBox = Number(batch.qty_per_box ?? 0);
    if (perBox <= 0) return sum;
    return sum + Math.ceil(Number(batch.remaining_qty ?? 0) / perBox);
  }, 0);

  const okCount = inventory.filter((row) => row.stock_status === "ok").length;

  return {
    totalProducts: products,
    totalCategories: categories,
    totalSuppliers: suppliers,
    totalStockUnits: inventory.reduce((sum, row) => sum + Number(row.current_stock ?? 0), 0),
    totalBoxes,
    lowStockCount: inventory.filter((row) => row.stock_status === "low_stock").length,
    outOfStockCount: inventory.filter((row) => row.stock_status === "out_of_stock").length,
    healthPercent: inventory.length === 0 ? 100 : Math.round((okCount / inventory.length) * 100),
    stockInToday: (stockInRes.data ?? []).reduce((sum, row) => sum + Number(row.total_qty ?? 0), 0),
    stockInBoxesToday: (stockInRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.box_count ?? 0),
      0,
    ),
    stockOutToday: (stockOutRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.total_qty ?? 0),
      0,
    ),
    stockOutOrdersToday: (stockOutRes.data ?? []).length,
  };
}

// ---------------------------------------------------------------------------
// Raw feed for the analytics dashboard
// ---------------------------------------------------------------------------

/** Everything the dashboard aggregates, fetched once and reduced client-side. */
export interface DashboardFeed {
  products: DashboardProduct[];
  movements: DashboardMovement[];
  batches: DashboardBatch[];
  categories: Array<{ id: string; name: string }>;
}

export interface DashboardProduct {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  category_id: string | null;
  categoryName: string;
  totalUnits: number;
  threshold: number;
  boxes: number;
}

export interface DashboardMovement {
  id: string;
  product_id: string;
  type: "IN" | "OUT";
  qty: number;
  created_at: string;
  boxes: number;
}

export interface DashboardBatch {
  batch_date: string;
  remaining_qty: number;
  box_count: number;
  qty_per_box: number;
  product_id: string;
}

export async function getDashboardFeed(): Promise<DashboardFeed> {
  const [inventoryRes, productsRes, ledgerRes, batchesRes, categoriesRes] = await Promise.all([
    supabase.from("inventory").select("*"),
    // Category and supplier come from products, not the view: an install that
    // ran the schema from the original specification has a view without them.
    supabase.from("products").select("id,category_id,supplier_id,image_url,description"),
    supabase.from("ledger").select("id,product_id,type,qty,created_at,batch_id"),
    supabase
      .from("stock_batches")
      .select("id,product_id,batch_date,remaining_qty,box_count,qty_per_box"),
    supabase.from("categories").select("id,name"),
  ]);

  assertOk(inventoryRes.error);
  assertOk(productsRes.error);
  assertOk(ledgerRes.error);
  assertOk(batchesRes.error);
  assertOk(categoriesRes.error);

  const categories = (categoriesRes.data ?? []) as Array<{ id: string; name: string }>;
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const categoryByProduct = new Map(
    ((productsRes.data ?? []) as Array<{ id: string; category_id: string | null }>).map((row) => [
      row.id,
      row.category_id,
    ]),
  );
  const batches = (batchesRes.data ?? []) as Array<DashboardBatch & { id: string }>;

  // Whole cartons still on hand, per product.
  const boxesByProduct = new Map<string, number>();
  for (const batch of batches) {
    const perBox = Number(batch.qty_per_box ?? 0);
    if (perBox <= 0) continue;
    const boxes = Math.floor(Number(batch.remaining_qty ?? 0) / perBox);
    boxesByProduct.set(batch.product_id, (boxesByProduct.get(batch.product_id) ?? 0) + boxes);
  }

  // A Stock IN ledger row carries its batch, so its box count comes from there.
  const batchById = new Map(batches.map((batch) => [batch.id, batch]));

  const products: DashboardProduct[] = ((inventoryRes.data ?? []) as InventoryRow[]).map(
    (row) => {
      const categoryId = categoryByProduct.get(row.id) ?? row.category_id ?? null;
      return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      category_id: categoryId,
      categoryName: categoryId
        ? (categoryNames.get(categoryId) ?? "Uncategorized")
        : "Uncategorized",
      totalUnits: Number(row.current_stock ?? 0),
      threshold: Number(row.min_stock ?? 0),
      boxes: boxesByProduct.get(row.id) ?? 0,
      };
    },
  );

  const movements: DashboardMovement[] = (
    (ledgerRes.data ?? []) as Array<{
      id: string;
      product_id: string;
      type: "IN" | "OUT";
      qty: number;
      created_at: string;
      batch_id: string | null;
    }>
  ).map((entry) => ({
    id: entry.id,
    product_id: entry.product_id,
    type: entry.type,
    qty: Number(entry.qty ?? 0),
    created_at: entry.created_at,
    boxes:
      entry.type === "IN" && entry.batch_id
        ? Number(batchById.get(entry.batch_id)?.box_count ?? 0)
        : 0,
  }));

  return {
    products,
    movements,
    batches: batches.map(({ batch_date, remaining_qty, box_count, qty_per_box, product_id }) => ({
      batch_date,
      remaining_qty: Number(remaining_qty ?? 0),
      box_count: Number(box_count ?? 0),
      qty_per_box: Number(qty_per_box ?? 0),
      product_id,
    })),
    categories,
  };
}
