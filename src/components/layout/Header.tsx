"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { labelForPath } from "@/components/layout/navigation";

export interface HeaderProps {
  onMenuClick: () => void;
  unreadCount: number;
}

/**
 * Slim top bar. Account actions live in the sidebar footer, so this stays
 * minimal: menu trigger on mobile, page title, notifications.
 */
export function Header({ onMenuClick, unreadCount }: HeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold tracking-tight text-slate-900">
            {labelForPath(pathname)}
          </h1>
          <div className="hidden sm:block">
            <Breadcrumb />
          </div>
        </div>

        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
