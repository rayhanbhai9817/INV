"use client";

/**
 * Daily Activity — a read-only feed over the existing ledger.
 *
 * No new tables: every row is a ledger entry joined to its product and batch.
 * Running inventory is accumulated forward from the first entry, which
 * reconciles with the current stock because every movement writes a ledger row.
 */

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, type PageParams } from "@/lib/db/helpers";
import { rangeFor } from "@/lib/range";
import type { LedgerType, Paginated } from "@/types";

export interface ActivityFilters extends PageParams {
  search?: string;
  type?: LedgerType | "all";
  preset?: string;
  from?: string;
  to?: string;
}

export interface ActivityRow {
  id: string;
  created_at: string;
  type: LedgerType;
  /** Units moved, signed: positive for IN, negative for OUT. */
  unitsAffected: number;
  actionLabel: string;
  reference: string | null;
  productName: string;
  productSku: string | null;
  /** Boxes and units per box, present on a Stock IN. */
  boxes: number;
  unitsPerBox: number;
  prevInventory: number;
  newInventory: number;
}

const ACTIVITY_SELECT =
  "id,product_id,type,qty,created_at,reference,batch_id," +
  "product:products(name,sku),batch:stock_batches(box_count,qty_per_box)";

interface RawLedgerRow {
  id: string;
  product_id: string;
  type: LedgerType;
  qty: number;
  created_at: string;
  reference: string | null;
  batch_id: string | null;
  product: { name: string; sku: string | null } | null;
  batch: { box_count: number; qty_per_box: number } | null;
}

/** Builds the whole feed, oldest first, carrying each product's balance. */
async function buildFeed(): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from("ledger")
    .select(ACTIVITY_SELECT)
    .order("created_at", { ascending: true });
  assertOk(error);

  const balances = new Map<string, number>();

  return ((data ?? []) as unknown as RawLedgerRow[]).map((entry) => {
    const signed = entry.type === "IN" ? Number(entry.qty) : -Math.abs(Number(entry.qty));
    const prev = balances.get(entry.product_id) ?? 0;
    const next = prev + signed;
    balances.set(entry.product_id, next);

    return {
      id: entry.id,
      created_at: entry.created_at,
      type: entry.type,
      unitsAffected: signed,
      actionLabel: entry.type === "IN" ? "Stock Received" : "Stock Issued",
      reference: entry.reference,
      productName: entry.product?.name ?? "Deleted product",
      productSku: entry.product?.sku ?? null,
      boxes: entry.type === "IN" ? Number(entry.batch?.box_count ?? 0) : 0,
      unitsPerBox: Number(entry.batch?.qty_per_box ?? 0),
      prevInventory: prev,
      newInventory: next,
    };
  });
}

export async function listActivity(
  filters: ActivityFilters = {},
): Promise<Paginated<ActivityRow>> {
  const feed = await buildFeed();
  const range = rangeFor(filters.preset ?? "today", filters.from, filters.to);
  const fromTime = new Date(range.from).getTime();
  const toTime = new Date(range.to).getTime();
  const term = filters.search?.trim().toLowerCase() ?? "";

  const matched = feed
    .filter((row) => {
      const at = new Date(row.created_at).getTime();
      if (at < fromTime || at > toTime) return false;
      if (filters.type && filters.type !== "all" && row.type !== filters.type) return false;
      if (!term) return true;
      return (
        row.productName.toLowerCase().includes(term) ||
        (row.productSku ?? "").toLowerCase().includes(term) ||
        row.actionLabel.toLowerCase().includes(term) ||
        (row.reference ?? "").toLowerCase().includes(term)
      );
    })
    .reverse();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? 25;
  const start = (page - 1) * pageSize;

  return paginated<ActivityRow>(matched.slice(start, start + pageSize), matched.length, {
    page,
    pageSize,
  });
}
