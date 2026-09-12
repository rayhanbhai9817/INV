"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  NotificationsProvider,
  useNotificationsBadge,
} from "@/components/providers/NotificationsProvider";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { cn } from "@/lib/utils";

/**
 * Client-side session guard. Supabase persists the session in the browser, so
 * the shell waits for it to resolve before rendering anything protected and
 * bounces to /login when there is none.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <SettingsProvider>
      <NotificationsProvider>
        <Shell>{children}</Shell>
      </NotificationsProvider>
    </SettingsProvider>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  /** Mobile drawer. */
  const [drawerOpen, setDrawerOpen] = useState(false);
  /** Desktop rail. */
  const [collapsed, setCollapsed] = useState(false);
  const { unreadCount } = useNotificationsBadge();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((previous) => !previous)}
        unreadCount={unreadCount}
      />
      <div
        className={cn(
          "transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[72px]" : "lg:pl-[260px]",
        )}
      >
        <Header onMenuClick={() => setDrawerOpen(true)} unreadCount={unreadCount} />
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
