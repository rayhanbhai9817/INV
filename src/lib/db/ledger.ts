"use client";

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import type { LedgerEntryWithProduct, LedgerType, Paginated } from "@/types";

const LEDGER_SELECT = "*, product:products(id,name,sku,unit)";

export interface LedgerFilters extends PageParams {
  productId?: string;
  type?: LedgerType | "";
  dateFrom?: string;
  dateTo?: string;
}

/** Builds the filtered ledger query shared by the table and the CSV export. */
function ledgerQuery(filters: LedgerFilters, withCount: boolean) {
  let query = withCount
    ? supabase.from("ledger").select(LEDGER_SELECT, { count: "exact" })
    : supabase.from("ledger").select(LEDGER_SELECT);

  if (filters.productId) query = query.eq("product_id", filters.productId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.dateFrom) query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
  if (filters.dateTo) query = query.lte("created_at", `${filters.dateTo}T23:59:59.999`);

  return query.order("created_at", { ascending: false });
}

export async function listLedger(
  filters: LedgerFilters = {},
): Promise<Paginated<LedgerEntryWithProduct>> {
  const [from, to] = rangeFor(filters);
  const { data, count, error } = await ledgerQuery(filters, true).range(from, to);
  assertOk(error);
  return paginated<LedgerEntryWithProduct>(
    data as unknown as LedgerEntryWithProduct[],
    count,
    filters,
  );
}

/** Unpaginated fetch used for CSV export (capped to keep the payload sane). */
export async function exportLedger(
  filters: LedgerFilters = {},
  limit = 5000,
): Promise<LedgerEntryWithProduct[]> {
  const { data, error } = await ledgerQuery(filters, false).limit(limit);
  assertOk(error);
  return (data ?? []) as unknown as LedgerEntryWithProduct[];
}

export async function recentLedger(limit = 8): Promise<LedgerEntryWithProduct[]> {
  const { data, error } = await supabase
    .from("ledger")
    .select(LEDGER_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  assertOk(error);
  return (data ?? []) as unknown as LedgerEntryWithProduct[];
}
