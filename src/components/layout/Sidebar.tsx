"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, LogOut, X } from "lucide-react";
import { NAV_ITEMS } from "@/components/layout/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  /** Mobile drawer visibility. */
  open: boolean;
  onClose: () => void;
  unreadCount: number;
}

export function Sidebar({ open, onClose, unreadCount }: SidebarProps) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { settings } = useSettings();
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

  const nav = (
    <nav className="flex h-full flex-col border-r border-sidebar-accent bg-sidebar text-white">
      <div className="flex flex-col items-start gap-4 px-8 py-10">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <Boxes className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white">
              {settings.company_name}
            </span>
            <span className="-mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-white/50">
              Inventory
            </span>
          </div>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const showBadge = item.badge === "unread" && unreadCount > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-4 py-2 text-xs transition-all duration-200",
                active
                  ? "bg-white/10 font-bold text-white"
                  : "font-medium text-white/60 hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  active ? "text-white" : "text-white/40 group-hover:text-white",
                )}
              />
              <span className="tracking-wide">{item.label}</span>

              {showBadge ? (
                <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : (
                active && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,1)]" />
                )
              )}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-white/5 p-4">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="group flex w-full items-center gap-3 rounded-lg px-4 py-2 text-xs font-bold text-white/60 transition-all hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span className="tracking-wide">{signingOut ? "Logging out…" : "Logout"}</span>
        </button>
      </div>
    </nav>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 lg:block">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close menu"
              className="absolute right-2 top-3 z-10 text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
