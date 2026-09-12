"use client";

/**
 * Daily Activity — a read-only feed over the existing ledger.
 *
 * No new tables: every row here is a ledger entry, joined to its product and
 * its batch so the feed can show what moved, how much, and from which batch.
 */

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import { escapeLike, todayISO } from "@/lib/utils";
import type { LedgerType, Paginated } from "@/types";

export type ActivityWindow = "today" | "yesterday" | "week" | "month" | "all";

export interface ActivityFilters extends PageParams {
  search?: string;
  type?: LedgerType | "";
  window?: ActivityWindow;
}

export interface ActivityRow {
  id: string;
  created_at: string;
  type: LedgerType;
  qty: number;
  reference: string | null;
  batch_id: string | null;
  product: { id: string; name: string; sku: string | null; unit: string } | null;
  batch: { batch_date: string } | null;
}

const ACTIVITY_SELECT =
  "id,created_at,type,qty,reference,batch_id, product:products(id,name,sku,unit), batch:stock_batches(batch_date)";

/** Inclusive [from, to] day range for the chosen window. */
export function windowRange(window: ActivityWindow): { from: string; to: string } | null {
  if (window === "all") return null;

  const today = todayISO();
  const date = new Date(`${today}T00:00:00`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);

  if (window === "yesterday") {
    const previous = new Date(date);
    previous.setDate(previous.getDate() - 1);
    return { from: iso(previous), to: iso(previous) };
  }
  if (window === "week") {
    const start = new Date(date);
    start.setDate(start.getDate() - 6);
    return { from: iso(start), to: today };
  }
  if (window === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    return { from: iso(start), to: today };
  }
  return { from: today, to: today };
}

export async function listActivity(
  filters: ActivityFilters = {},
): Promise<Paginated<ActivityRow>> {
  let query = supabase.from("ledger").select(ACTIVITY_SELECT, { count: "exact" });

  if (filters.type) query = query.eq("type", filters.type);

  const range = windowRange(filters.window ?? "today");
  if (range) {
    query = query
      .gte("created_at", `${range.from}T00:00:00`)
      .lte("created_at", `${range.to}T23:59:59.999`);
  }

  if (filters.search?.trim()) {
    const term = escapeLike(filters.search.trim());
    query = query.or(`reference.ilike.%${term}%`);
  }

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  assertOk(error);

  return paginated<ActivityRow>(data as unknown as ActivityRow[], count, filters);
}
