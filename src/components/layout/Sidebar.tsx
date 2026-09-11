"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, NAV_ITEMS } from "@/components/layout/navigation";
import { NavIcon } from "@/components/layout/NavIcon";
import { useSettings } from "@/components/providers/SettingsProvider";

export interface SidebarProps {
  open: boolean;
  onClose: () => void;
  unreadCount: number;
}

/** Fixed on desktop, slide-over on mobile. */
export function Sidebar({ open, onClose, unreadCount }: SidebarProps) {
  const pathname = usePathname();
  const { settings } = useSettings();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            FS
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{settings.company_name}</p>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">Inventory</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <div key={group} className="mb-5">
                <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {group}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition",
                            active
                              ? "bg-brand-50 text-brand-700"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                          )}
                        >
                          <NavIcon path={item.icon} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {item.href === "/notifications" && unreadCount > 0 && (
                            <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
          Fast Sold LLC © {new Date().getFullYear()}
        </div>
      </aside>
    </>
  );
}
