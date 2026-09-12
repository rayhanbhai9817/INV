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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { unreadCount } = useNotificationsBadge();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        unreadCount={unreadCount}
      />
      <div className="lg:pl-72">
        <Header onMenuClick={() => setDrawerOpen(true)} unreadCount={unreadCount} />
        <main className="min-h-[calc(100vh-64px)] p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
