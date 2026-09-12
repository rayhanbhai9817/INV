"use client";

import { useState } from "react";
import { CheckCheck, Inbox, Loader2 } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { useNotificationsBadge } from "@/components/providers/NotificationsProvider";
import { useAsync } from "@/lib/hooks";
import { listNotifications, markAllRead } from "@/lib/db/notifications";
import { errorMessage } from "@/lib/supabase";
import { cn, formatDateTime } from "@/lib/utils";

export default function NotificationsPage() {
  const toast = useToast();
  const { refresh: refreshBadge } = useNotificationsBadge();
  const [reloadKey, setReloadKey] = useState(0);
  const [marking, setMarking] = useState(false);

  const notifications = useAsync(
    () => listNotifications({ page: 1, pageSize: 100 }),
    [reloadKey],
  );

  const rows = notifications.data?.rows ?? [];

  async function handleMarkAllRead() {
    setMarking(true);
    try {
      await markAllRead();
      toast.success("All notifications marked as read");
      setReloadKey((key) => key + 1);
      void refreshBadge();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">Activity Alerts</h1>
          <p className="text-sm font-medium text-[#a3aed0]">
            Automatic alerts raised when stock falls low or runs out.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={marking}
            className="flex h-11 items-center rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674] shadow-sm transition hover:bg-[#f4f7fe] disabled:opacity-60"
          >
            <CheckCheck className="mr-2 h-4 w-4" />
            {marking ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
        {notifications.loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : notifications.error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-[#ee5d50]">
            <span>{notifications.error}</span>
            <button
              type="button"
              onClick={notifications.reload}
              className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Inbox className="h-6 w-6" />
            No notifications yet
          </div>
        ) : (
          <ul className="divide-y divide-[#f4f7fe]">
            {rows.map((notification) => (
              <li
                key={notification.id}
                className={cn("px-6 py-4", !notification.is_read && "bg-[#f4f7fe]/40")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="mb-1.5 text-sm font-bold leading-none text-[#2b3674]">
                      {notification.message}
                    </p>
                  </div>
                  <span className="whitespace-nowrap font-mono text-[10px] font-bold text-[#a3aed0]">
                    {formatDateTime(notification.created_at)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
