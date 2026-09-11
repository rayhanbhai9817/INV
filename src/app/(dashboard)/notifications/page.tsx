"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { useNotificationsBadge } from "@/components/providers/NotificationsProvider";
import { useAsync } from "@/lib/hooks";
import { allInventory } from "@/lib/db/inventory";
import {
  deleteNotification,
  listNotifications,
  markAllRead,
  setNotificationRead,
  syncLowStockNotifications,
} from "@/lib/db/notifications";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import { cn, formatDateTime } from "@/lib/utils";

export default function NotificationsPage() {
  const toast = useToast();
  const { refresh: refreshBadge } = useNotificationsBadge();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  const notifications = useAsync(
    () => listNotifications({ unreadOnly, search, page, pageSize: DEFAULT_PAGE_SIZE }),
    [unreadOnly, search, page],
  );

  async function withBusy(action: () => Promise<void>, successMessage?: string) {
    setBusy(true);
    try {
      await action();
      if (successMessage) toast.success(successMessage);
      notifications.reload();
      void refreshBadge();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  const rows = notifications.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Low-stock alerts raised whenever a movement leaves a product at or below its minimum."
        actions={
          <>
            <Button
              variant="secondary"
              loading={busy}
              onClick={() =>
                withBusy(async () => {
                  const count = await syncLowStockNotifications(await allInventory());
                  toast.info(
                    count === 0
                      ? "No product is low on stock."
                      : `${count} product(s) at or below minimum.`,
                  );
                })
              }
            >
              Run low-stock check
            </Button>
            <Button
              loading={busy}
              onClick={() => withBusy(() => markAllRead(), "All notifications marked as read.")}
            >
              Mark all read
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search messages…"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => {
                setUnreadOnly(event.target.checked);
                setPage(1);
              }}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Unread only
          </label>
        </div>

        {notifications.loading ? (
          <TableSkeleton cols={3} />
        ) : notifications.error ? (
          <ErrorState message={notifications.error} onRetry={notifications.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No notifications"
            message={
              unreadOnly ? "Everything has been read." : "Low-stock alerts will appear here."
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {rows.map((notification) => (
                <li
                  key={notification.id}
                  className={cn(
                    "flex flex-wrap items-start justify-between gap-3 px-4 py-4",
                    !notification.is_read && "bg-brand-50/40",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!notification.is_read && <Badge tone="info">New</Badge>}
                      <p className="text-sm text-slate-800">{notification.message}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDateTime(notification.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        withBusy(() =>
                          setNotificationRead(notification.id, !notification.is_read),
                        )
                      }
                    >
                      {notification.is_read ? "Mark unread" : "Mark read"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50"
                      disabled={busy}
                      onClick={() => withBusy(() => deleteNotification(notification.id))}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={notifications.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={notifications.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
