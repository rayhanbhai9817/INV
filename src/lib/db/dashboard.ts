"use client";

import { supabase } from "@/lib/supabase";
import { assertOk } from "@/lib/db/helpers";
import { todayISO } from "@/lib/utils";
import type { DashboardStats, InventoryRow } from "@/types";

async function countRows(table: string): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  assertOk(error);
  return count ?? 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = todayISO();

  const [products, categories, suppliers, inventoryRes, stockInRes, stockOutRes] =
    await Promise.all([
      countRows("products"),
      countRows("categories"),
      countRows("suppliers"),
      supabase.from("inventory").select("current_stock,stock_status"),
      supabase.from("stock_batches").select("total_qty").eq("batch_date", today),
      supabase.from("stock_out").select("total_qty").eq("out_date", today),
    ]);

  assertOk(inventoryRes.error);
  assertOk(stockInRes.error);
  assertOk(stockOutRes.error);

  const inventory = (inventoryRes.data ?? []) as Pick<
    InventoryRow,
    "current_stock" | "stock_status"
  >[];

  return {
    totalProducts: products,
    totalCategories: categories,
    totalSuppliers: suppliers,
    totalStockUnits: inventory.reduce((sum, row) => sum + Number(row.current_stock ?? 0), 0),
    lowStockCount: inventory.filter((row) => row.stock_status === "low_stock").length,
    outOfStockCount: inventory.filter((row) => row.stock_status === "out_of_stock").length,
    stockInToday: (stockInRes.data ?? []).reduce((sum, row) => sum + Number(row.total_qty ?? 0), 0),
    stockOutToday: (stockOutRes.data ?? []).reduce(
      (sum, row) => sum + Number(row.total_qty ?? 0),
      0,
    ),
  };
}
