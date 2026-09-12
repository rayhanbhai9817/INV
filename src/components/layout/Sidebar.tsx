"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { NAV_GROUPS, NAV_ITEMS, type NavItem } from "@/components/layout/navigation";
import { LogoMark } from "@/components/layout/Logo";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export interface SidebarProps {
  /** Mobile drawer visibility. */
  open: boolean;
  onClose: () => void;
  /** Desktop rail state. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
  unreadCount: number;
}

interface TooltipState {
  label: string;
  top: number;
}

export function Sidebar({
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
  unreadCount,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  /**
   * The nav scrolls, which would clip an absolutely positioned tooltip, so the
   * collapsed-rail tooltip is rendered outside the aside and positioned from
   * the hovered element's rect.
   */
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // The drawer is always expanded on mobile; only the desktop rail collapses.
  const isRail = collapsed;

  const showTooltip = useCallback(
    (label: string, element: HTMLElement) => {
      if (!isRail) return;
      const rect = element.getBoundingClientRect();
      setTooltip({ label, top: rect.top + rect.height / 2 });
    },
    [isRail],
  );

  const hideTooltip = useCallback(() => setTooltip(null), []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } catch (caught) {
      toast.error(errorMessage(caught));
      setSigningOut(false);
    }
  }

  const initials = (user?.email ?? "A").slice(0, 2).toUpperCase();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-shell-900 text-slate-300",
          "transition-[transform,width] duration-200 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          isRail ? "w-[72px]" : "w-[260px]",
        )}
      >
        {/* ----------------------------- Brand ----------------------------- */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-white/5",
            isRail ? "justify-center px-2" : "gap-3 px-4",
          )}
        >
          {isRail ? (
            <LogoMark size={34} tone="light" />
          ) : (
            <>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500">
                <LogoMark size={22} tone="onAccent" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold tracking-tight text-white">
                  {settings.company_name}
                </p>
                <p className="text-[11px] font-medium uppercase tracking-wider text-brand-400">
                  Inventory
                </p>
              </div>
            </>
          )}

          {/* Close on mobile, collapse on desktop. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-shell-800 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
          {!isRail && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-label="Collapse sidebar"
              className="hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-shell-800 hover:text-white lg:block"
            >
              <ChevronsLeft size={18} />
            </button>
          )}
        </div>

        {isRail && (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label="Expand sidebar"
            className="mx-auto mt-3 hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-shell-800 hover:text-white lg:block"
          >
            <ChevronsRight size={18} />
          </button>
        )}

        {/* --------------------------- Navigation -------------------------- */}
        <nav className={cn("flex-1 overflow-y-auto py-4", isRail ? "px-2" : "px-3")}>
          {NAV_GROUPS.map((group) => {
            const items = NAV_ITEMS.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <div key={group} className="mb-5 last:mb-0">
                {isRail ? (
                  <div className="mx-auto mb-2 h-px w-6 bg-white/10" />
                ) : (
                  <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {group}
                  </p>
                )}
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        item={item}
                        active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                        collapsed={isRail}
                        unreadCount={unreadCount}
                        onNavigate={onClose}
                        onShowTooltip={showTooltip}
                        onHideTooltip={hideTooltip}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ------------------------------ User ----------------------------- */}
        <div className={cn("shrink-0 border-t border-white/5 py-3", isRail ? "px-2" : "px-3")}>
          {isRail ? (
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                {initials}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Log out"
                onMouseEnter={(event) => showTooltip("Log out", event.currentTarget)}
                onMouseLeave={hideTooltip}
                onFocus={(event) => showTooltip("Log out", event.currentTarget)}
                onBlur={hideTooltip}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-shell-800 hover:text-red-400 disabled:opacity-50"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">Admin</p>
                <p className="truncate text-[11px] text-slate-400">{user?.email ?? "—"}</p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Log out"
                title="Log out"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-shell-800 hover:text-red-400 disabled:opacity-50"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Tooltip lives outside the aside so the scrolling nav cannot clip it. */}
      {isRail && tooltip && (
        <div
          role="tooltip"
          style={{ top: tooltip.top }}
          className="pointer-events-none fixed left-[80px] z-[60] hidden -translate-y-1/2 animate-fade-in whitespace-nowrap rounded-lg bg-shell-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg lg:block"
        >
          {tooltip.label}
        </div>
      )}
    </>
  );
}

/** One navigation row: icon + label, or icon + hover tooltip when collapsed. */
function NavLink({
  item,
  active,
  collapsed,
  unreadCount,
  onNavigate,
  onShowTooltip,
  onHideTooltip,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  unreadCount: number;
  onNavigate: () => void;
  onShowTooltip: (label: string, element: HTMLElement) => void;
  onHideTooltip: () => void;
}) {
  const Icon = item.icon;
  const showBadge = item.badge === "unread" && unreadCount > 0;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      onMouseEnter={(event) => onShowTooltip(item.label, event.currentTarget)}
      onMouseLeave={onHideTooltip}
      onFocus={(event) => onShowTooltip(item.label, event.currentTarget)}
      onBlur={onHideTooltip}
      className={cn(
        "relative flex items-center rounded-xl text-sm font-medium transition",
        collapsed ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-3 py-2.5",
        active
          ? "bg-brand-500 text-white shadow-sm shadow-brand-500/20"
          : "text-slate-300 hover:bg-shell-800 hover:text-white",
      )}
    >
      {/* 3px brighter-orange marker on the sidebar edge, beside the active row. */}
      {active && !collapsed && (
        <span
          aria-hidden
          className="absolute -left-3 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-300"
        />
      )}

      <span className="relative shrink-0">
        <Icon
          size={18}
          className={cn(
            !active && item.accent === "green" && "text-emerald-400",
            !active && item.accent === "red" && "text-red-400",
          )}
        />
        {collapsed && showBadge && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white ring-2 ring-shell-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </span>

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {showBadge && (
            <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
          {!active && item.accent && (
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                item.accent === "green" ? "bg-emerald-400" : "bg-red-400",
              )}
            />
          )}
        </>
      )}
    </Link>
  );
}
