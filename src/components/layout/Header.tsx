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

/** Slim top bar: page label on the left, alerts and the account on the right. */
export function Header({ onMenuClick, unreadCount }: HeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings } = useSettings();

  const initial = (settings.company_name || "O").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-navy-200/40 bg-white">
      <div className="flex h-[52px] items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-navy-700 transition hover:bg-canvas lg:hidden"
        >
          <Menu size={18} />
        </button>

        <p className="min-w-0 flex-1 truncate font-serif text-[13px] font-bold text-navy-800">
          {labelForPath(pathname)}
        </p>

        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-navy-700 transition hover:bg-canvas"
        >
          <Bell size={17} strokeWidth={1.6} />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="flex items-center gap-2.5 pl-1">
          <div className="hidden text-right leading-tight sm:block">
            <p className="font-serif text-[12px] font-bold text-navy-800">
              {settings.company_name}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-300">
              Admin
            </p>
          </div>
          <span
            title={user?.email ?? undefined}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-900 text-[11px] font-bold text-white"
          >
            {initial}
          </span>
        </div>
      </div>
    </header>
  );
}
