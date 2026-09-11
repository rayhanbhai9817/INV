"use client";

/**
 * Product Price module — deliberately independent of the stock flow.
 * Nothing here reads or writes stock_batches, stock_out or ledger.
 */

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import type { Paginated, ProductPriceWithProduct } from "@/types";

const PRICE_SELECT = "*, product:products(id,name,sku)";

export interface PriceFilters extends PageParams {
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PriceInput {
  product_id: string;
  unit_price: number;
  unit: number;
  date: string;
  note: string | null;
}

export async function listPrices(
  filters: PriceFilters = {},
): Promise<Paginated<ProductPriceWithProduct>> {
  let query = supabase.from("product_prices").select(PRICE_SELECT, { count: "exact" });

  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("date", filters.dateTo);

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  assertOk(error);
  return paginated<ProductPriceWithProduct>(
    data as unknown as ProductPriceWithProduct[],
    count,
    filters,
  );
}

/** total_price is a generated column — it is never sent from the client. */
export async function createPrice(input: PriceInput): Promise<ProductPriceWithProduct> {
  const { data, error } = await supabase
    .from("product_prices")
    .insert(input)
    .select(PRICE_SELECT)
    .single();
  assertOk(error);
  return data as unknown as ProductPriceWithProduct;
}

export async function updatePrice(
  id: string,
  input: PriceInput,
): Promise<ProductPriceWithProduct> {
  const { data, error } = await supabase
    .from("product_prices")
    .update(input)
    .eq("id", id)
    .select(PRICE_SELECT)
    .single();
  assertOk(error);
  return data as unknown as ProductPriceWithProduct;
}

export async function deletePrice(id: string): Promise<void> {
  const { error } = await supabase.from("product_prices").delete().eq("id", id);
  assertOk(error);
}
