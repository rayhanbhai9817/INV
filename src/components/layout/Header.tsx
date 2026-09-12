"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { labelForPath } from "@/components/layout/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSettings } from "@/components/providers/SettingsProvider";

export interface HeaderProps {
  onMenuClick: () => void;
  unreadCount: number;
}

export function Header({ onMenuClick, unreadCount }: HeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings } = useSettings();

  const initial = (settings.company_name || user?.email || "O").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-background bg-white px-4 shadow-sm lg:px-8">
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-lg p-2 text-foreground transition hover:bg-background lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h2 className="text-sm font-bold text-foreground">{labelForPath(pathname)}</h2>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-foreground transition hover:bg-background"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-3 px-3 py-1.5">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-black text-foreground">{settings.company_name}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mutedfg">Admin</p>
          </div>
          <div
            title={user?.email ?? undefined}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-white shadow-lg"
          >
            {initial}
          </div>
        </div>
      </div>
    </header>
  );
}
