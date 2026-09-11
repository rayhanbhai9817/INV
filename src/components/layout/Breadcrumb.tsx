"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/components/layout/navigation";

/** Dashboard › Section › Detail, derived from the pathname. */
export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const navItem = NAV_ITEMS.find((item) => item.href === href);
    const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment);
    const label = navItem?.label ?? (isId ? "Details" : segment.replace(/-/g, " "));
    return { href, label };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
      <Link href="/dashboard" className="hover:text-slate-700">
        Home
      </Link>
      {crumbs.map((crumb, index) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <span className="text-slate-300">/</span>
          {index === crumbs.length - 1 ? (
            <span className="font-medium capitalize text-slate-700">{crumb.label}</span>
          ) : (
            <Link href={crumb.href} className="capitalize hover:text-slate-700">
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
