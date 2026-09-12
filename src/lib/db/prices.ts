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
  /** A product id, or "manual" for entries typed by hand. */
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** Filter value selecting entries that carry a typed name. */
export const MANUAL_FILTER = "manual";

export interface PriceInput {
  /** Null when the entry names its product by hand. */
  product_id: string | null;
  /** Set instead of product_id for a manually typed product name. */
  product_name: string | null;
  unit_price: number;
  unit: number;
  date: string;
  note: string | null;
  /** Object path in the product-images bucket, or null for no image. */
  image_url: string | null;
}

/**
 * The manual-name column arrived after the first release, so a project
 * that has not run the migration yet gets told what to do rather than a
 * raw PostgREST message.
 */
function describeWriteError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message.includes("product_name")) {
    throw new Error(
      "This database does not have the product_name column yet. Run " +
        "supabase/migrations/20260912_product_prices_manual_name.sql in the Supabase SQL Editor.",
    );
  }
  if (message.includes("image_url")) {
    throw new Error(
      "This database does not have the product_prices.image_url column yet. Run " +
        "supabase/migrations/20260913_images_descriptions_and_view_fix.sql in the Supabase SQL Editor.",
    );
  }
  throw error instanceof Error ? error : new Error(message);
}

export async function listPrices(
  filters: PriceFilters = {},
): Promise<Paginated<ProductPriceWithProduct>> {
  let query = supabase.from("product_prices").select(PRICE_SELECT, { count: "exact" });

  if (filters.productId === MANUAL_FILTER) query = query.is("product_id", null);
  else if (filters.productId) query = query.eq("product_id", filters.productId);
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
  if (error) describeWriteError(error);
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
  if (error) describeWriteError(error);
  return data as unknown as ProductPriceWithProduct;
}

export async function deletePrice(id: string): Promise<void> {
  const { error } = await supabase.from("product_prices").delete().eq("id", id);
  assertOk(error);
}
