"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { labelForPath } from "@/components/layout/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/supabase";

export interface HeaderProps {
  onMenuClick: () => void;
  unreadCount: number;
}

export function Header({ onMenuClick, unreadCount }: HeaderProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch (caught) {
      toast.error(errorMessage(caught));
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-slate-900">
            {labelForPath(pathname)}
          </h1>
          <div className="hidden sm:block">
            <Breadcrumb />
          </div>
        </div>

        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-5 w-5">
            <path
              d="M15 17h5l-1.5-2V10a6.5 6.5 0 1 0-13 0v5L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold uppercase text-slate-600">
            {(user?.email ?? "?").slice(0, 2)}
          </span>
          <span className="max-w-[160px] truncate text-xs text-slate-600">{user?.email}</span>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </header>
  );
}
