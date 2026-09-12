import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  DollarSign,
  LayoutDashboard,
  Package,
  Settings,
  Tags,
  TrendingDown,
  TrendingUp,
  Truck,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Renders the unread notification count. */
  badge?: "unread";
}

/** Single flat list, in the order the shell presents it. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/activity", label: "Daily Activity", icon: Activity },
  { href: "/products", label: "Products", icon: Package },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/stock-in", label: "Stock IN", icon: TrendingUp },
  { href: "/stock-out", label: "Stock OUT", icon: TrendingDown },
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/warehouses", label: "Warehouses", icon: Warehouse },
  { href: "/ledger", label: "Stock Ledger", icon: BookOpen },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/prices", label: "Product Price", icon: DollarSign },
  { href: "/notifications", label: "Notifications", icon: Bell, badge: "unread" },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Human label for a pathname, used by the breadcrumb and page title. */
export function labelForPath(pathname: string): string {
  const match = NAV_ITEMS.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Dashboard";
}
