"use client";

import { supabase } from "@/lib/supabase";
import { assertOk } from "@/lib/db/helpers";
import type { AppSettings, Setting } from "@/types";

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: "Ozipco",
  low_stock_threshold: 10,
  currency: "USD",
  date_format: "YYYY-MM-DD",
  rows_per_page: 25,
};

function toAppSettings(rows: Setting[]): AppSettings {
  const map = new Map(rows.map((row) => [row.key, row.value ?? ""]));
  const num = (key: keyof AppSettings, fallback: number) => {
    const parsed = Number(map.get(key));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  return {
    company_name: map.get("company_name") || DEFAULT_SETTINGS.company_name,
    low_stock_threshold: num("low_stock_threshold", DEFAULT_SETTINGS.low_stock_threshold),
    currency: map.get("currency") || DEFAULT_SETTINGS.currency,
    date_format: map.get("date_format") || DEFAULT_SETTINGS.date_format,
    rows_per_page: num("rows_per_page", DEFAULT_SETTINGS.rows_per_page),
  };
}

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from("settings").select("*");
  assertOk(error);
  return toAppSettings((data ?? []) as Setting[]);
}

/** Upserts each key individually so partial saves stay valid. */
export async function saveSettings(values: AppSettings): Promise<AppSettings> {
  const rows = Object.entries(values).map(([key, value]) => ({ key, value: String(value) }));
  const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
  assertOk(error);
  return values;
}

/**
 * Applies the global low-stock threshold to every product whose own min_stock
 * is still at the default of 0.
 */
export async function applyThresholdToProducts(threshold: number): Promise<number> {
  const { data, error } = await supabase
    .from("products")
    .update({ min_stock: threshold })
    .eq("min_stock", 0)
    .select("id");
  assertOk(error);
  return (data ?? []).length;
}
