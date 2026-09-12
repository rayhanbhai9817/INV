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

const BATCH_SELECT = "*, product:products(id,name,sku,unit)";
const OUT_SELECT = "*, product:products(id,name,sku,unit)";

export interface MovementFilters extends PageParams {
  search?: string;
  productId?: string;
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
export async function listBatchesForProduct(productId: string): Promise<StockBatchWithProduct[]> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select(BATCH_SELECT)
    .eq("product_id", productId)
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
  currentUnits: number;
  unitsPerBox: number;
}

/**
 * Products for the Stock IN / Stock OUT form. Units-per-box comes from the
 * newest batch, since the schema stores packaging per batch.
 */
export async function getMovementProducts(): Promise<MovementProduct[]> {
  const [inventoryRes, batchesRes] = await Promise.all([
    supabase.from("inventory").select("id,name,sku,current_stock").order("name"),
    supabase
      .from("stock_batches")
      .select("product_id,qty_per_box,batch_date,created_at")
      .order("batch_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  assertOk(inventoryRes.error);
  assertOk(batchesRes.error);

  const latestPerBox = new Map<string, number>();
  for (const batch of (batchesRes.data ?? []) as Array<{
    product_id: string;
    qty_per_box: number;
  }>) {
    const perBox = Number(batch.qty_per_box ?? 0);
    if (perBox > 0) latestPerBox.set(batch.product_id, perBox);
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
    currentUnits: Number(row.current_stock ?? 0),
    unitsPerBox: latestPerBox.get(row.id) ?? 0,
  }));
}
