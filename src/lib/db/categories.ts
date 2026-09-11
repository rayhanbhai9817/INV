"use client";

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import { escapeLike } from "@/lib/utils";
import type { Category, Paginated } from "@/types";

export interface CategoryFilters extends PageParams {
  search?: string;
}

export async function listCategories(filters: CategoryFilters = {}): Promise<Paginated<Category>> {
  let query = supabase.from("categories").select("*", { count: "exact" });

  if (filters.search?.trim()) {
    query = query.ilike("name", `%${escapeLike(filters.search.trim())}%`);
  }

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query.order("name", { ascending: true }).range(from, to);
  assertOk(error);
  return paginated<Category>(data as Category[], count, filters);
}

/** Unfiltered list for dropdowns. */
export async function allCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });
  assertOk(error);
  return (data ?? []) as Category[];
}

export async function createCategory(name: string): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: name.trim() })
    .select("*")
    .single();
  assertOk(error);
  return data as Category;
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const { data, error } = await supabase
    .from("categories")
    .update({ name: name.trim() })
    .eq("id", id)
    .select("*")
    .single();
  assertOk(error);
  return data as Category;
}

export async function countProductsInCategory(id: string): Promise<number> {
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);
  assertOk(error);
  return count ?? 0;
}

/** Deletion is blocked while any product still points at the category. */
export async function deleteCategory(id: string): Promise<void> {
  const dependents = await countProductsInCategory(id);
  if (dependents > 0) {
    throw new Error(
      `This category is used by ${dependents} product${dependents === 1 ? "" : "s"}. ` +
        "Reassign or delete those products first.",
    );
  }
  const { error } = await supabase.from("categories").delete().eq("id", id);
  assertOk(error);
}
