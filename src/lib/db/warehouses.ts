"use client";

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import { escapeLike } from "@/lib/utils";
import type { Paginated, Warehouse } from "@/types";

export interface WarehouseFilters extends PageParams {
  search?: string;
}

export interface WarehouseInput {
  name: string;
  location: string | null;
  is_default: boolean;
}

/**
 * Warehouses arrived after the first release, so a project that has not run
 * the migration yet gets told what to do rather than a raw PostgREST message.
 */
function describeError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/warehouses/i.test(message) && /(does not exist|schema cache|not find)/i.test(message)) {
    throw new Error(
      "This database does not have the warehouses table yet. Run " +
        "supabase/migrations/20260914_pricing_supplier_warehouse.sql in the Supabase SQL Editor.",
    );
  }
  if (/warehouses_name_key|duplicate key/i.test(message)) {
    throw new Error("A warehouse with that name already exists.");
  }
  throw error instanceof Error ? error : new Error(message);
}

function normalize(input: WarehouseInput) {
  const location = input.location?.trim();
  return {
    name: input.name.trim(),
    location: location ? location : null,
    is_default: input.is_default,
  };
}

export async function listWarehouses(
  filters: WarehouseFilters = {},
): Promise<Paginated<Warehouse>> {
  let query = supabase.from("warehouses").select("*", { count: "exact" });

  if (filters.search?.trim()) {
    const term = escapeLike(filters.search.trim());
    query = query.or(`name.ilike.%${term}%,location.ilike.%${term}%`);
  }

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query
    .order("is_default", { ascending: false })
    .order("name", { ascending: true })
    .range(from, to);
  if (error) describeError(error);
  return paginated<Warehouse>(data as Warehouse[], count, filters);
}

/** Unfiltered list for dropdowns; the default warehouse sorts first. */
export async function allWarehouses(): Promise<Warehouse[]> {
  const { data, error } = await supabase
    .from("warehouses")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });
  if (error) describeError(error);
  return (data ?? []) as Warehouse[];
}

/** The warehouse a form should start on: the default, else the first one. */
export function defaultWarehouseId(warehouses: Warehouse[]): string {
  return warehouses.find((warehouse) => warehouse.is_default)?.id ?? warehouses[0]?.id ?? "";
}

/**
 * Only one warehouse may be the default, so promoting one demotes the rest.
 * The unique index enforces this too — clearing first avoids tripping it.
 */
async function clearOtherDefaults(exceptId?: string): Promise<void> {
  let query = supabase.from("warehouses").update({ is_default: false }).eq("is_default", true);
  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  if (error) describeError(error);
}

export async function createWarehouse(input: WarehouseInput): Promise<Warehouse> {
  const payload = normalize(input);
  if (payload.is_default) await clearOtherDefaults();

  const { data, error } = await supabase
    .from("warehouses")
    .insert(payload)
    .select("*")
    .single();
  if (error) describeError(error);
  return data as Warehouse;
}

export async function updateWarehouse(id: string, input: WarehouseInput): Promise<Warehouse> {
  const payload = normalize(input);
  if (payload.is_default) await clearOtherDefaults(id);

  const { data, error } = await supabase
    .from("warehouses")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) describeError(error);
  return data as Warehouse;
}

/** Units still sitting in a warehouse, across every open batch. */
export async function stockInWarehouse(id: string): Promise<number> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select("remaining_qty")
    .eq("warehouse_id", id)
    .gt("remaining_qty", 0);
  if (error) describeError(error);
  return (data ?? []).reduce((sum, row) => sum + Number(row.remaining_qty ?? 0), 0);
}

/**
 * Deletion is refused while the warehouse still holds stock or appears on any
 * past movement — removing it would orphan batches and break the history.
 */
export async function deleteWarehouse(id: string): Promise<void> {
  const { count: batchCount, error: batchError } = await supabase
    .from("stock_batches")
    .select("id", { count: "exact", head: true })
    .eq("warehouse_id", id);
  if (batchError) describeError(batchError);

  if ((batchCount ?? 0) > 0) {
    throw new Error(
      `This warehouse is referenced by ${batchCount} stock receipt${batchCount === 1 ? "" : "s"}. ` +
        "Move that stock to another warehouse first.",
    );
  }

  const { count: outCount, error: outError } = await supabase
    .from("stock_out")
    .select("id", { count: "exact", head: true })
    .eq("warehouse_id", id);
  if (outError) describeError(outError);

  if ((outCount ?? 0) > 0) {
    throw new Error(
      `This warehouse appears on ${outCount} past dispatch${outCount === 1 ? "" : "es"} and ` +
        "cannot be deleted without breaking that history.",
    );
  }

  const { error } = await supabase.from("warehouses").delete().eq("id", id);
  if (error) describeError(error);
}
