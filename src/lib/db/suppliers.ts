"use client";

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import { escapeLike } from "@/lib/utils";
import type { Paginated, Supplier } from "@/types";

export interface SupplierFilters extends PageParams {
  search?: string;
}

export type SupplierInput = Omit<Supplier, "id" | "created_at">;

export async function listSuppliers(filters: SupplierFilters = {}): Promise<Paginated<Supplier>> {
  let query = supabase.from("suppliers").select("*", { count: "exact" });

  if (filters.search?.trim()) {
    const term = escapeLike(filters.search.trim());
    query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query.order("name", { ascending: true }).range(from, to);
  assertOk(error);
  return paginated<Supplier>(data as Supplier[], count, filters);
}

export async function allSuppliers(): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("name", { ascending: true });
  assertOk(error);
  return (data ?? []) as Supplier[];
}

export async function getSupplier(id: string): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).single();
  assertOk(error);
  return data as Supplier;
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase.from("suppliers").insert(input).select("*").single();
  assertOk(error);
  return data as Supplier;
}

export async function updateSupplier(id: string, input: SupplierInput): Promise<Supplier> {
  const { data, error } = await supabase
    .from("suppliers")
    .update(input)
    .eq("id", id)
    .select("*")
    .single();
  assertOk(error);
  return data as Supplier;
}

export async function countProductsForSupplier(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id);
  assertOk(error);
  return count ?? 0;
}

export async function deleteSupplier(id: string): Promise<void> {
  const dependents = await countProductsForSupplier(id);
  if (dependents > 0) {
    throw new Error(
      `This supplier is linked to ${dependents} product${dependents === 1 ? "" : "s"}. ` +
        "Reassign or delete those products first.",
    );
  }
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  assertOk(error);
}
