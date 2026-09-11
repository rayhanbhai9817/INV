"use client";

import { supabase } from "@/lib/supabase";
import { assertOk, paginated, rangeFor, type PageParams } from "@/lib/db/helpers";
import type { InventoryRow, Notification, Paginated } from "@/types";

export interface NotificationFilters extends PageParams {
  unreadOnly?: boolean;
  search?: string;
}

export async function listNotifications(
  filters: NotificationFilters = {},
): Promise<Paginated<Notification>> {
  let query = supabase.from("notifications").select("*", { count: "exact" });
  if (filters.unreadOnly) query = query.eq("is_read", false);
  if (filters.search?.trim()) query = query.ilike("message", `%${filters.search.trim()}%`);

  const [from, to] = rangeFor(filters);
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);
  assertOk(error);
  return paginated<Notification>(data as Notification[], count, filters);
}

export async function countUnread(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("is_read", false);
  assertOk(error);
  return count ?? 0;
}

export async function createNotification(message: string): Promise<Notification> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({ message })
    .select("*")
    .single();
  assertOk(error);
  return data as Notification;
}

export async function setNotificationRead(id: string, isRead: boolean): Promise<void> {
  const { error } = await supabase.from("notifications").update({ is_read: isRead }).eq("id", id);
  assertOk(error);
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);
  assertOk(error);
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  assertOk(error);
}

/**
 * Writes a low/out-of-stock alert, skipping the write when an identical alert
 * is already sitting unread so the list does not fill with duplicates.
 */
export async function raiseLowStockNotification(row: InventoryRow): Promise<void> {
  const message =
    row.stock_status === "out_of_stock"
      ? `${row.name} is out of stock.`
      : `${row.name} is low on stock: ${row.current_stock} ${row.unit} left (minimum ${row.min_stock}).`;

  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("message", message)
    .eq("is_read", false)
    .limit(1);
  assertOk(error);
  if (data && data.length > 0) return;

  await createNotification(message);
}

/** Sweeps current inventory and raises an alert for every product at risk. */
export async function syncLowStockNotifications(rows: InventoryRow[]): Promise<number> {
  const atRisk = rows.filter((row) => row.stock_status !== "ok");
  for (const row of atRisk) {
    await raiseLowStockNotification(row);
  }
  return atRisk.length;
}
