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
