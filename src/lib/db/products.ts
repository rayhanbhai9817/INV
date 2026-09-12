"use client";

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import { escapeLike } from "@/lib/utils";
import type { Paginated, Product, ProductWithRelations, ProductStockRollup } from "@/types";

const SELECT_WITH_RELATIONS =
  "*, category:categories(id,name), supplier:suppliers(id,name)";

export interface ProductFilters extends PageParams {
  search?: string;
  categoryId?: string;
  supplierId?: string;
}

export interface ProductInput {
  name: string;
  sku: string | null;
  category_id: string | null;
  supplier_id: string | null;
  unit: string;
  min_stock: number;
}

export async function listProducts(
  filters: ProductFilters = {},
): Promise<Paginated<ProductWithRelations>> {
  let query = supabase.from("products").select(SELECT_WITH_RELATIONS, { count: "exact" });

  if (filters.search?.trim()) {
    const term = escapeLike(filters.search.trim());
    query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
  }
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.supplierId) query = query.eq("supplier_id", filters.supplierId);

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query.order("name", { ascending: true }).range(from, to);
  assertOk(error);
  return paginated<ProductWithRelations>(data as unknown as ProductWithRelations[], count, filters);
}

/** Lightweight list used by every product dropdown. */
export async function allProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true });
  assertOk(error);
  return (data ?? []) as Product[];
}

export async function getProduct(id: string): Promise<ProductWithRelations> {
  const { data, error } = await supabase
    .from("products")
    .select(SELECT_WITH_RELATIONS)
    .eq("id", id)
    .single();
  assertOk(error);
  return data as unknown as ProductWithRelations;
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase.from("products").insert(input).select("*").single();
  assertOk(error);
  return data as Product;
}

export async function updateProduct(id: string, input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from("products")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  assertOk(error);
  return data as Product;
}

/**
 * Products carry ledger history, so deletion is refused once any stock has
 * moved — the audit trail must stay intact.
 */
export async function deleteProduct(id: string): Promise<void> {
  const { count, error: ledgerError } = await supabase
    .from("ledger")
    .select("id", { count: "exact", head: true })
    .eq("product_id", id);
  assertOk(ledgerError);

  if ((count ?? 0) > 0) {
    throw new Error(
      "This product already has stock movements recorded in the ledger and cannot be deleted.",
    );
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  assertOk(error);
}

/**
 * Box / loose / total breakdown per product, derived from the open batches.
 *
 * Boxes are whole cartons still on hand and loose units are the remainder, so
 * boxes x qty_per_box + loose = the units the inventory view reports. Nothing
 * here writes, and no new column is required.
 */
export async function getStockRollups(
  productIds: string[],
): Promise<Record<string, ProductStockRollup>> {
  if (productIds.length === 0) return {};

  const { data, error } = await supabase
    .from("stock_batches")
    .select("product_id,remaining_qty,qty_per_box")
    .in("product_id", productIds)
    .gt("remaining_qty", 0);
  assertOk(error);

  const rollups: Record<string, ProductStockRollup> = {};
  for (const id of productIds) {
    rollups[id] = { boxes: 0, loose: 0, total: 0 };
  }

  for (const batch of data ?? []) {
    const id = String(batch.product_id);
    const perBox = Number(batch.qty_per_box ?? 0);
    const remaining = Number(batch.remaining_qty ?? 0);
    const rollup = rollups[id] ?? { boxes: 0, loose: 0, total: 0 };

    rollup.total += remaining;
    if (perBox > 0) {
      rollup.boxes += Math.floor(remaining / perBox);
      rollup.loose += remaining % perBox;
    } else {
      rollup.loose += remaining;
    }
    rollups[id] = rollup;
  }

  // Loose units can add up to whole boxes once batches are combined.
  return rollups;
}
