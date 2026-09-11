export interface NavItem {
  href: string;
  label: string;
  /** Heroicons-style path data rendered by <NavIcon>. */
  icon: string;
  group: "Overview" | "Catalog" | "Stock" | "Insights" | "System";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", group: "Overview", icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/products", label: "Products", group: "Catalog", icon: "M3 7l9-4 9 4-9 4-9-4Zm0 5l9 4 9-4M3 17l9 4 9-4" },
  { href: "/categories", label: "Categories", group: "Catalog", icon: "M4 5h16M4 12h16M4 19h16" },
  { href: "/suppliers", label: "Suppliers", group: "Catalog", icon: "M3 13h13V6H3v7Zm13 0h3l2 3v4h-5v-7ZM7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" },
  { href: "/inventory", label: "Inventory", group: "Stock", icon: "M4 4h16v6H4V4Zm0 10h16v6H4v-6Z" },
  { href: "/stock-in", label: "Stock In", group: "Stock", icon: "M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" },
  { href: "/stock-out", label: "Stock Out", group: "Stock", icon: "M12 20V8m0 0l-4 4m4-4l4 4M4 4h16" },
  { href: "/ledger", label: "Ledger Account", group: "Insights", icon: "M6 3h12a1 1 0 0 1 1 1v16l-3-2-2 2-2-2-2 2-3-2V4a1 1 0 0 1 1-1Zm3 5h6M9 12h6" },
  { href: "/reports", label: "Reports", group: "Insights", icon: "M5 20V10m7 10V4m7 16v-6" },
  { href: "/prices", label: "Product Price", group: "Insights", icon: "M12 3v18m4-14H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H8" },
  { href: "/notifications", label: "Notifications", group: "System", icon: "M15 17h5l-1.5-2V10a6.5 6.5 0 1 0-13 0v5L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9" },
  { href: "/settings", label: "Settings", group: "System", icon: "M10.3 3.8a1 1 0 0 1 1-.8h1.4a1 1 0 0 1 1 .8l.3 1.6 1.5.9 1.5-.6a1 1 0 0 1 1.2.4l.7 1.2a1 1 0 0 1-.2 1.3l-1.2 1v1.8l1.2 1a1 1 0 0 1 .2 1.3l-.7 1.2a1 1 0 0 1-1.2.4l-1.5-.6-1.5.9-.3 1.6a1 1 0 0 1-1 .8h-1.4a1 1 0 0 1-1-.8l-.3-1.6-1.5-.9-1.5.6a1 1 0 0 1-1.2-.4l-.7-1.2a1 1 0 0 1 .2-1.3l1.2-1v-1.8l-1.2-1a1 1 0 0 1-.2-1.3l.7-1.2a1 1 0 0 1 1.2-.4l1.5.6 1.5-.9.3-1.6ZM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" },
];

export const NAV_GROUPS = ["Overview", "Catalog", "Stock", "Insights", "System"] as const;

/** Human label for a pathname, used by the breadcrumb and page title. */
export function labelForPath(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Dashboard";
}
