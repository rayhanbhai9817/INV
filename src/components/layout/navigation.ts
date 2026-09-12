import {
  BarChart2,
  Bell,
  BookOpen,
  DollarSign,
  LayoutDashboard,
  Package,
  PackageMinus,
  PackagePlus,
  Settings,
  Tag,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "Overview" | "Inventory" | "Finance" | "Reports & Logs" | "System";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Small colour cue on the icon, for the two movement actions. */
  accent?: "green" | "red";
  /** Renders the unread notification count. */
  badge?: "unread";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", group: "Overview", icon: LayoutDashboard },

  { href: "/products", label: "Products", group: "Inventory", icon: Package },
  { href: "/categories", label: "Category", group: "Inventory", icon: Tag },
  { href: "/suppliers", label: "Supplier", group: "Inventory", icon: Truck },
  { href: "/inventory", label: "Inventory", group: "Inventory", icon: Warehouse },
  { href: "/stock-in", label: "Stock In", group: "Inventory", icon: PackagePlus, accent: "green" },
  { href: "/stock-out", label: "Stock Out", group: "Inventory", icon: PackageMinus, accent: "red" },

  { href: "/prices", label: "Product Price", group: "Finance", icon: DollarSign },

  { href: "/reports", label: "Report", group: "Reports & Logs", icon: BarChart2 },
  { href: "/ledger", label: "Ledger Account", group: "Reports & Logs", icon: BookOpen },

  { href: "/notifications", label: "Notification", group: "System", icon: Bell, badge: "unread" },
  { href: "/settings", label: "Settings", group: "System", icon: Settings },
];

export const NAV_GROUPS: NavGroup[] = [
  "Overview",
  "Inventory",
  "Finance",
  "Reports & Logs",
  "System",
];

/** Human label for a pathname, used by the breadcrumb and page title. */
export function labelForPath(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Dashboard";
}
