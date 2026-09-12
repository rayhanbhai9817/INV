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

// ---------------------------------------------------------------------------
// Stock Ledger feed
// ---------------------------------------------------------------------------

/**
 * One ledger line with its running balances.
 *
 * Box figures are derived from the running unit balance and the row's
 * units-per-box, so Prev + Delta = New always reconciles on the row, even
 * where batches were received at different pack sizes.
 */
export interface LedgerFeedRow {
  id: string;
  occurredAt: string;
  type: LedgerType;
  productId: string;
  productName: string;
  productSku: string | null;
  unitsPerBox: number;
  prevUnits: number;
  unitsDelta: number;
  newUnits: number;
  prevBoxes: number;
  boxesDelta: number;
  newBoxes: number;
  reference: string | null;
  batchId: string | null;
}

const FEED_SELECT =
  "id,product_id,type,qty,created_at,reference,batch_id," +
  "product:products(name,sku),batch:stock_batches(qty_per_box,box_count)";

interface RawFeedRow {
  id: string;
  product_id: string;
  type: LedgerType;
  qty: number;
  created_at: string;
  reference: string | null;
  batch_id: string | null;
  product: { name: string; sku: string | null } | null;
  batch: { qty_per_box: number; box_count: number } | null;
}

/** The whole ledger, oldest first, with balances carried forward. */
export async function getLedgerFeed(): Promise<LedgerFeedRow[]> {
  const { data, error } = await supabase
    .from("ledger")
    .select(FEED_SELECT)
    .order("created_at", { ascending: true });
  assertOk(error);

  const balances = new Map<string, number>();
  const packSize = new Map<string, number>();

  return ((data ?? []) as unknown as RawFeedRow[]).map((entry) => {
    const signed = entry.type === "IN" ? Number(entry.qty) : -Math.abs(Number(entry.qty));
    const prevUnits = balances.get(entry.product_id) ?? 0;
    const newUnits = prevUnits + signed;
    balances.set(entry.product_id, newUnits);

    // A receipt sets the pack size; an issue carries the last one forward.
    const batchPerBox = Number(entry.batch?.qty_per_box ?? 0);
    if (entry.type === "IN" && batchPerBox > 0) packSize.set(entry.product_id, batchPerBox);
    const perBox = packSize.get(entry.product_id) ?? 0;

    const prevBoxes = perBox > 0 ? Math.floor(prevUnits / perBox) : 0;
    const newBoxes = perBox > 0 ? Math.floor(newUnits / perBox) : 0;

    return {
      id: entry.id,
      occurredAt: entry.created_at,
      type: entry.type,
      productId: entry.product_id,
      productName: entry.product?.name ?? "—",
      productSku: entry.product?.sku ?? null,
      unitsPerBox: perBox,
      prevUnits,
      unitsDelta: signed,
      newUnits,
      prevBoxes,
      boxesDelta: newBoxes - prevBoxes,
      newBoxes,
      reference: entry.reference,
      batchId: entry.batch_id,
    };
  });
}
