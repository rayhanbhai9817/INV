"use client";

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import { escapeLike } from "@/lib/utils";
import type { InventoryRow, Paginated, StockStatus } from "@/types";

export interface InventoryFilters extends PageParams {
  search?: string;
  status?: StockStatus | "";
  categoryId?: string;
  supplierId?: string;
}

export async function listInventory(
  filters: InventoryFilters = {},
): Promise<Paginated<InventoryRow>> {
  let query = supabase.from("inventory").select("*", { count: "exact" });

  if (filters.search?.trim()) {
    const term = escapeLike(filters.search.trim());
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }
  if (filters.status) query = query.eq("stock_status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query.order("name", { ascending: true }).range(from, to);
  assertOk(error);
  return paginated<InventoryRow>(data as InventoryRow[], count, filters);
}

/** One product's live stock row — used by the Stock Out form. */
export async function getInventoryRow(productId: string): Promise<InventoryRow | null> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  assertOk(error);
  return (data as InventoryRow) ?? null;
}

export async function listLowStock(limit = 100): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .in("stock_status", ["low_stock", "out_of_stock"])
    .order("current_stock", { ascending: true })
    .limit(limit);
  assertOk(error);
  return (data ?? []) as InventoryRow[];
}

export async function allInventory(): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("name", { ascending: true });
  assertOk(error);
  return (data ?? []) as InventoryRow[];
}

// ---------------------------------------------------------------------------
// Inventory Control Center feed
// ---------------------------------------------------------------------------

export interface ControlBatch {
  id: string;
  receivedAt: string;
  originalBoxes: number;
  remainingBoxes: number;
  unitsPerBox: number;
  remainingUnits: number;
  status: "ACTIVE" | "EMPTY";
}

export interface ControlMovement {
  id: string;
  occurredAt: string;
  type: "IN" | "OUT";
  /** Signed units: positive for IN, negative for OUT. */
  qty: number;
  balance: number;
}

export interface ControlProduct {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  categoryName: string;
  threshold: number;
  /** Packaging of the newest batch; the schema stores it per batch. */
  unitsPerBox: number;
  totalBoxes: number;
  available: number;
  totalIn: number;
  dispatched: number;
  lastMovement: string | null;
  batches: ControlBatch[];
  history: ControlMovement[];
}

/**
 * Everything the Control Center renders, fetched in one pass so expanding a
 * row costs nothing extra.
 */
export async function getInventoryControl(): Promise<ControlProduct[]> {
  const [inventoryRes, categoriesRes, batchesRes, ledgerRes] = await Promise.all([
    supabase.from("inventory").select("*").order("name", { ascending: true }),
    supabase.from("categories").select("id,name"),
    supabase
      .from("stock_batches")
      .select("id,product_id,batch_date,created_at,box_count,qty_per_box,remaining_qty")
      .order("batch_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("ledger")
      .select("id,product_id,type,qty,created_at")
      .order("created_at", { ascending: true }),
  ]);

  assertOk(inventoryRes.error);
  assertOk(categoriesRes.error);
  assertOk(batchesRes.error);
  assertOk(ledgerRes.error);

  const categoryNames = new Map(
    ((categoriesRes.data ?? []) as Array<{ id: string; name: string }>).map((row) => [
      row.id,
      row.name,
    ]),
  );

  const batchesByProduct = new Map<string, ControlBatch[]>();
  const boxesByProduct = new Map<string, number>();
  const latestPerBox = new Map<string, number>();

  for (const batch of (batchesRes.data ?? []) as Array<{
    id: string;
    product_id: string;
    batch_date: string;
    box_count: number;
    qty_per_box: number;
    remaining_qty: number;
  }>) {
    const perBox = Number(batch.qty_per_box ?? 0);
    const remaining = Number(batch.remaining_qty ?? 0);
    const remainingBoxes = perBox > 0 ? Math.floor(remaining / perBox) : 0;

    const list = batchesByProduct.get(batch.product_id) ?? [];
    list.push({
      id: batch.id,
      receivedAt: batch.batch_date,
      originalBoxes: Number(batch.box_count ?? 0),
      remainingBoxes,
      unitsPerBox: perBox,
      remainingUnits: remaining,
      status: remaining === 0 ? "EMPTY" : "ACTIVE",
    });
    batchesByProduct.set(batch.product_id, list);

    boxesByProduct.set(batch.product_id, (boxesByProduct.get(batch.product_id) ?? 0) + remainingBoxes);
    if (perBox > 0) latestPerBox.set(batch.product_id, perBox);
  }

  const historyByProduct = new Map<string, ControlMovement[]>();
  const totals = new Map<string, { in: number; out: number; last: string | null }>();
  const balances = new Map<string, number>();

  for (const entry of (ledgerRes.data ?? []) as Array<{
    id: string;
    product_id: string;
    type: "IN" | "OUT";
    qty: number;
    created_at: string;
  }>) {
    const signed = entry.type === "IN" ? Number(entry.qty) : -Math.abs(Number(entry.qty));
    const balance = (balances.get(entry.product_id) ?? 0) + signed;
    balances.set(entry.product_id, balance);

    const list = historyByProduct.get(entry.product_id) ?? [];
    list.push({
      id: entry.id,
      occurredAt: entry.created_at,
      type: entry.type,
      qty: signed,
      balance,
    });
    historyByProduct.set(entry.product_id, list);

    const running = totals.get(entry.product_id) ?? { in: 0, out: 0, last: null };
    if (entry.type === "IN") running.in += Number(entry.qty);
    else running.out += Math.abs(Number(entry.qty));
    running.last = entry.created_at;
    totals.set(entry.product_id, running);
  }

  return ((inventoryRes.data ?? []) as InventoryRow[]).map((row) => {
    const running = totals.get(row.id) ?? { in: 0, out: 0, last: null };
    return {
      id: row.id,
      name: row.name,
      sku: row.sku,
      category_id: row.category_id,
      categoryName: row.category_id
        ? (categoryNames.get(row.category_id) ?? "Uncategorized")
        : "Uncategorized",
      threshold: Number(row.min_stock ?? 0),
      unitsPerBox: latestPerBox.get(row.id) ?? 0,
      totalBoxes: boxesByProduct.get(row.id) ?? 0,
      available: Number(row.current_stock ?? 0),
      totalIn: running.in,
      dispatched: running.out,
      lastMovement: running.last,
      batches: (batchesByProduct.get(row.id) ?? []).slice().reverse(),
      history: (historyByProduct.get(row.id) ?? []).slice().reverse(),
    };
  });
}
