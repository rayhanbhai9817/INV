"use client";

import { supabase } from "@/lib/supabase";
import { assertOk } from "@/lib/db/helpers";
import { todayISO } from "@/lib/utils";
import type { DashboardStats, InventoryRow, PeriodStats, StatsPeriod } from "@/types";

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  assertOk(error);
  return count ?? 0;
}

/** Inclusive day range [from, to] for the selected period, anchored on a date. */
export function periodRange(period: StatsPeriod, anchor: string): { from: string; to: string } {
  const date = new Date(`${anchor}T00:00:00`);
  const iso = (value: Date) => value.toISOString().slice(0, 10);

  if (period === "yesterday") {
    const previous = new Date(date);
    previous.setDate(previous.getDate() - 1);
    return { from: iso(previous), to: iso(previous) };
  }
  if (period === "week") {
    const start = new Date(date);
    start.setDate(start.getDate() - 6);
    return { from: iso(start), to: iso(date) };
  }
  if (period === "month") {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    return { from: iso(start), to: iso(date) };
  }
  return { from: iso(date), to: iso(date) };
}

/** Sums ledger quantities of one type inside a timestamp window. */
async function sumLedger(
  type: "IN" | "OUT",
  options: { after?: string; from?: string; to?: string },
): Promise<number> {
  let query = supabase.from("ledger").select("qty").eq("type", type);
  if (options.after) query = query.gt("created_at", `${options.after}T23:59:59.999`);
  if (options.from) query = query.gte("created_at", `${options.from}T00:00:00`);
  if (options.to) query = query.lte("created_at", `${options.to}T23:59:59.999`);

  const { data, error } = await query;
  assertOk(error);
  return (data ?? []).reduce((sum, row) => sum + Number(row.qty ?? 0), 0);
}

/**
 * Opening / net flow / closing for the period.
 *
 * Current stock is the all-time net of the ledger, so the closing balance of a
 * past period is the current total minus everything that moved after it.
 */
export async function getPeriodStats(
  period: StatsPeriod,
  anchor: string,
  currentStock: number,
): Promise<PeriodStats> {
  const { from, to } = periodRange(period, anchor);

  const [inPeriod, outPeriod, inAfter, outAfter] = await Promise.all([
    sumLedger("IN", { from, to }),
    sumLedger("OUT", { from, to }),
    sumLedger("IN", { after: to }),
    sumLedger("OUT", { after: to }),
  ]);

  const closing = currentStock - (inAfter - outAfter);
  const netFlow = inPeriod - outPeriod;

  return {
    from,
    to,
    stockIn: inPeriod,
    stockOut: outPeriod,
    netFlow,
    closing,
    opening: closing - netFlow,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayISO();

  const [products, categories, suppliers, inventoryRes, batchesRes, stockInRes, stockOutRes] =
    await Promise.all([
      countRows("products"),
      countRows("categories"),
      countRows("suppliers"),
      supabase.from("inventory").select("current_stock,stock_status"),
      supabase.from("stock_batches").select("remaining_qty,qty_per_box").gt("remaining_qty", 0),
      supabase.from("stock_batches").select("total_qty,box_count").eq("batch_date", today),
      supabase.from("stock_out").select("total_qty").eq("out_date", today),
    ]);

  assertOk(inventoryRes.error);
  assertOk(batchesRes.error);
  assertOk(stockInRes.error);
  assertOk(stockOutRes.error);

  const inventory = (inventoryRes.data ?? []) as Pick<
    InventoryRow,
    "current_stock" | "stock_status"
  >[];

  // Boxes still on hand, rounded up per open batch.
  const totalBoxes = (batchesRes.data ?? []).reduce((sum, batch) => {
    const perBox = Number(batch.qty_per_box ?? 0);
    if (perBox <= 0) return sum;
    return sum + Math.ceil(Number(batch.remaining_qty ?? 0) / perBox);
  }, 0);

  const okCount = inventory.filter((row) => row.stock_status === "ok").length;

  return {
    totalProducts: products,
    totalCategories: categories,
    totalSuppliers: suppliers,
    totalStockUnits: inventory.reduce((sum, row) => sum + Number(row.current_stock ?? 0), 0),
    totalBoxes,
    lowStockCount: inventory.filter((row) => row.stock_status === "low_stock").length,
    outOfStockCount: inventory.filter((row) => row.stock_status === "out_of_stock").length,
    healthPercent: inventory.length === 0 ? 100 : Math.round((okCount / inventory.length) * 100),
    stockInToday: (stockInRes.data ?? []).reduce((sum, row) => sum + Number(row.total_qty ?? 0), 0),
    stockInBoxesToday: (stockInRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.box_count ?? 0),
      0,
    ),
    stockOutToday: (stockOutRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.total_qty ?? 0),
      0,
    ),
    stockOutOrdersToday: (stockOutRes.data ?? []).length,
  };
}
