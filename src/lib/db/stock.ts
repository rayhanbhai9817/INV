"use client";

/**
 * Stock In / Stock Out data access.
 *
 * Writes are delegated to the FIFO engine (`src/lib/fifo.ts`) so the batch
 * maths lives in exactly one place; this module owns the reads and the
 * low-stock notifications raised after a movement.
 */

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import { escapeLike } from "@/lib/utils";
import {
  processStockIn,
  processStockOut,
  type StockInInput,
  type StockOutOptions,
} from "@/lib/fifo";
import { getInventoryRow } from "@/lib/db/inventory";
import { raiseLowStockNotification } from "@/lib/db/notifications";
import type {
  Paginated,
  StockBatchWithProduct,
  StockOutResult,
  StockOutWithProduct,
} from "@/types";

const BATCH_SELECT =
  "*, product:products(id,name,sku,unit), supplier:suppliers(id,name), warehouse:warehouses(id,name)";
const OUT_SELECT = "*, product:products(id,name,sku,unit), warehouse:warehouses(id,name)";

export interface MovementFilters extends PageParams {
  search?: string;
  productId?: string;
  supplierId?: string;
  warehouseId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// ------------------------------- Stock In ----------------------------------

export async function recordStockIn(input: StockInInput) {
  const result = await processStockIn(input);
  await syncLowStockNotification(input.productId);
  return result;
}

export async function listStockIn(
  filters: MovementFilters = {},
): Promise<Paginated<StockBatchWithProduct>> {
  let query = supabase.from("stock_batches").select(BATCH_SELECT, { count: "exact" });

  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);
  if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
  if (filters.dateFrom) query = query.gte("batch_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("batch_date", filters.dateTo);
  if (filters.search?.trim()) {
    query = query.ilike("products.name", `%${escapeLike(filters.search.trim())}%`);
  }

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query
    .order("batch_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  assertOk(error);
  return paginated<StockBatchWithProduct>(
    data as unknown as StockBatchWithProduct[],
    count,
    filters,
  );
}

// ------------------------------- Stock Out ---------------------------------

export async function recordStockOut(
  productId: string,
  qty: number,
  options: StockOutOptions = {},
): Promise<StockOutResult> {
  const result = await processStockOut(productId, qty, options);
  await syncLowStockNotification(productId);
  return result;
}

export async function listStockOut(
  filters: MovementFilters = {},
): Promise<Paginated<StockOutWithProduct>> {
  let query = supabase.from("stock_out").select(OUT_SELECT, { count: "exact" });

  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
  if (filters.dateFrom) query = query.gte("out_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("out_date", filters.dateTo);
  if (filters.search?.trim()) {
    query = query.ilike("products.name", `%${escapeLike(filters.search.trim())}%`);
  }

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query
    .order("out_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  assertOk(error);
  return paginated<StockOutWithProduct>(data as unknown as StockOutWithProduct[], count, filters);
}

/** Open batches of a product, oldest first — shown as the FIFO preview. */
export async function listBatchesForProduct(
  productId: string,
  warehouseId?: string | null,
): Promise<StockBatchWithProduct[]> {
  let query = supabase.from("stock_batches").select(BATCH_SELECT).eq("product_id", productId);
  if (warehouseId) query = query.eq("warehouse_id", warehouseId);

  const { data, error } = await query
    .order("batch_date", { ascending: true })
    .order("created_at", { ascending: true });
  assertOk(error);
  return (data ?? []) as unknown as StockBatchWithProduct[];
}

/** Raises a notification when a movement leaves the product at or below min. */
async function syncLowStockNotification(productId: string): Promise<void> {
  try {
    const row = await getInventoryRow(productId);
    if (!row || row.stock_status === "ok") return;
    await raiseLowStockNotification(row);
  } catch {
    // A notification must never fail the stock movement that triggered it.
  }
}

/** A product as the movement form needs it: stock on hand plus packaging. */
export interface MovementProduct {
  id: string;
  name: string;
  sku: string | null;
  /** Units on hand — in the selected warehouse when one is given. */
  currentUnits: number;
  unitsPerBox: number;
  /** What this product cost per unit on its most recent receipt. */
  lastUnitCost: number | null;
}

/**
 * Products for the Stock IN / Stock OUT form.
 *
 * Units-per-box and last cost come from the newest batch, since the schema
 * stores packaging and cost per batch. With a warehouse selected, the stock
 * figure counts only that warehouse's batches — which is exactly what Stock
 * OUT is allowed to consume from there.
 */
export async function getMovementProducts(
  warehouseId?: string | null,
): Promise<MovementProduct[]> {
  const [inventoryRes, batchesRes] = await Promise.all([
    supabase.from("inventory").select("id,name,sku,current_stock").order("name"),
    supabase
      .from("stock_batches")
      .select("product_id,qty_per_box,remaining_qty,warehouse_id,unit_cost,batch_date,created_at")
      .order("batch_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  assertOk(inventoryRes.error);
  assertOk(batchesRes.error);

  const batches = (batchesRes.data ?? []) as Array<{
    product_id: string;
    qty_per_box: number;
    remaining_qty: number;
    warehouse_id: string | null;
    unit_cost: number | null;
  }>;

  const latestPerBox = new Map<string, number>();
  const latestCost = new Map<string, number | null>();
  const unitsHere = new Map<string, number>();

  for (const batch of batches) {
    const perBox = Number(batch.qty_per_box ?? 0);
    if (perBox > 0) latestPerBox.set(batch.product_id, perBox);
    if (batch.unit_cost !== null && batch.unit_cost !== undefined) {
      latestCost.set(batch.product_id, Number(batch.unit_cost));
    }
    if (warehouseId && batch.warehouse_id === warehouseId) {
      const remaining = Math.max(0, Number(batch.remaining_qty ?? 0));
      unitsHere.set(batch.product_id, (unitsHere.get(batch.product_id) ?? 0) + remaining);
    }
  }

  return ((inventoryRes.data ?? []) as Array<{
    id: string;
    name: string;
    sku: string | null;
    current_stock: number;
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    currentUnits: warehouseId ? (unitsHere.get(row.id) ?? 0) : Number(row.current_stock ?? 0),
    unitsPerBox: latestPerBox.get(row.id) ?? 0,
    lastUnitCost: latestCost.get(row.id) ?? null,
  }));
}
