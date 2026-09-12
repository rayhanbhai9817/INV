"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronsLeft, ChevronsRight, LogOut, X } from "lucide-react";
import { NAV_ITEMS, type NavItem } from "@/components/layout/navigation";
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
  const { signOut } = useAuth();
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

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/50 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-navy-900 text-navy-200",
          "transition-[transform,width] duration-200 ease-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
          isRail ? "w-[76px]" : "w-[230px]",
        )}
      >
        {/* ----------------------------- Brand ----------------------------- */}
        <div
          className={cn(
            "flex h-[88px] shrink-0 items-center",
            isRail ? "justify-center px-2" : "gap-3 px-6",
          )}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
            <LogoMark size={24} tone="light" />
          </span>
          {!isRail && (
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-[15px] font-bold uppercase tracking-[0.2em] text-white">
                {settings.company_name}
              </p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-navy-300">
                Inventory
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-1.5 text-navy-300 transition hover:bg-white/5 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* --------------------------- Navigation -------------------------- */}
        <nav className={cn("flex-1 overflow-y-auto pb-4", isRail ? "px-2" : "px-4")}>
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => (
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
        </nav>

        {/* ----------------------------- Footer ---------------------------- */}
        <div
          className={cn(
            "shrink-0 border-t border-white/5 py-4",
            isRail ? "flex flex-col items-center gap-2 px-2" : "px-4",
          )}
        >
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Logout"
            onMouseEnter={(event) => showTooltip("Logout", event.currentTarget)}
            onMouseLeave={hideTooltip}
            onFocus={(event) => showTooltip("Logout", event.currentTarget)}
            onBlur={hideTooltip}
            className={cn(
              "flex items-center rounded-xl text-sm font-semibold text-navy-200 transition hover:bg-white/5 hover:text-white disabled:opacity-50",
              isRail ? "h-11 w-11 justify-center" : "w-full gap-3 px-3 py-2.5",
            )}
          >
            <LogOut size={18} className="shrink-0" />
            {!isRail && <span className="font-serif">{signingOut ? "Logging out…" : "Logout"}</span>}
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={isRail ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "hidden items-center rounded-xl text-xs font-medium text-navy-300 transition hover:bg-white/5 hover:text-white lg:flex",
              isRail ? "h-9 w-11 justify-center" : "mt-1 w-full gap-3 px-3 py-2",
            )}
          >
            {isRail ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            {!isRail && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Tooltip lives outside the aside so the scrolling nav cannot clip it. */}
      {isRail && tooltip && (
        <div
          role="tooltip"
          style={{ top: tooltip.top }}
          className="pointer-events-none fixed left-[84px] z-[60] hidden -translate-y-1/2 animate-fade-in whitespace-nowrap rounded-lg bg-navy-800 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg lg:block"
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
        "relative flex items-center rounded-xl font-serif text-[13.5px] transition",
        collapsed ? "mx-auto h-11 w-11 justify-center" : "gap-3 px-3 py-2.5",
        active
          ? "bg-navy-700/70 font-bold text-white shadow-sm"
          : "font-normal text-navy-200 hover:bg-white/5 hover:text-white",
      )}
    >
      <span className="relative shrink-0">
        <Icon size={17} strokeWidth={active ? 2 : 1.6} />
        {collapsed && showBadge && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white ring-2 ring-navy-900">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </span>

      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {showBadge ? (
            <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : (
            active && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white" />
          )}
        </>
      )}
    </Link>
  );
}
