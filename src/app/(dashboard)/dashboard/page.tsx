"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { CardSkeleton, EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { StockStatusBadge } from "@/components/ui/Badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAsync } from "@/lib/hooks";
import { getDashboardStats } from "@/lib/db/dashboard";
import { listLowStock } from "@/lib/db/inventory";
import { recentLedger } from "@/lib/db/ledger";
import { formatDateTime, formatNumber } from "@/lib/utils";

const QUICK_ACTIONS = [
  { href: "/stock-in", label: "Record Stock In", tone: "bg-emerald-50 text-emerald-700" },
  { href: "/stock-out", label: "Record Stock Out", tone: "bg-amber-50 text-amber-700" },
  { href: "/products/new", label: "Add Product", tone: "bg-brand-50 text-brand-700" },
  { href: "/reports", label: "Open Reports", tone: "bg-slate-100 text-slate-700" },
];

export default function DashboardPage() {
  const stats = useAsync(() => getDashboardStats(), []);
  const activity = useAsync(() => recentLedger(8), []);
  const lowStock = useAsync(() => listLowStock(6), []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Live stock position, today's movements and anything that needs attention."
      />

      {/* ------------------------------- KPIs ------------------------------ */}
      {stats.loading ? (
        <CardSkeleton />
      ) : stats.error ? (
        <Card>
          <ErrorState message={stats.error} onRetry={stats.reload} />
        </Card>
      ) : stats.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total products"
              value={formatNumber(stats.data.totalProducts)}
              hint={`${stats.data.totalCategories} categories · ${stats.data.totalSuppliers} suppliers`}
            />
            <StatCard
              label="Units in stock"
              value={formatNumber(stats.data.totalStockUnits)}
              hint="Sum of all open batches"
            />
            <StatCard
              label="Low stock"
              value={formatNumber(stats.data.lowStockCount)}
              tone={stats.data.lowStockCount > 0 ? "warning" : "default"}
              hint="At or below minimum"
            />
            <StatCard
              label="Out of stock"
              value={formatNumber(stats.data.outOfStockCount)}
              tone={stats.data.outOfStockCount > 0 ? "danger" : "default"}
              hint="Nothing left to issue"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Stock in today"
              value={formatNumber(stats.data.stockInToday)}
              tone="success"
              hint="Units received"
            />
            <StatCard
              label="Stock out today"
              value={formatNumber(stats.data.stockOutToday)}
              hint="Units issued"
            />
          </div>
        </>
      ) : null}

      {/* --------------------------- Quick actions ------------------------- */}
      <Card>
        <CardHeader title="Quick actions" />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={`rounded-lg px-4 py-3 text-sm font-medium transition hover:opacity-80 ${action.tone}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ------------------------ Recent transactions -------------------- */}
        <Card>
          <CardHeader
            title="Recent transactions"
            subtitle="Latest ledger entries"
            action={
              <Link href="/ledger" className="text-xs font-medium text-brand-600 hover:underline">
                View ledger
              </Link>
            }
          />
          {activity.loading ? (
            <TableSkeleton rows={5} cols={4} />
          ) : activity.error ? (
            <ErrorState message={activity.error} onRetry={activity.reload} />
          ) : (activity.data ?? []).length === 0 ? (
            <EmptyState
              title="No movements yet"
              message="Record a Stock In to start building the ledger."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Type</TH>
                  <TH align="right">Qty</TH>
                  <TH>When</TH>
                </TR>
              </THead>
              <TBody>
                {(activity.data ?? []).map((entry) => (
                  <TR key={entry.id}>
                    <TD className="font-medium text-slate-900">
                      {entry.product?.name ?? "Deleted product"}
                    </TD>
                    <TD>
                      <Badge tone={entry.type === "IN" ? "success" : "warning"}>{entry.type}</Badge>
                    </TD>
                    <TD align="right" className="tabular-nums">
                      {formatNumber(entry.qty)}
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-slate-500">
                      {formatDateTime(entry.created_at)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        {/* -------------------------- Low stock alerts --------------------- */}
        <Card>
          <CardHeader
            title="Low stock alerts"
            subtitle="Products at or below their minimum"
            action={
              <Link
                href="/inventory?status=low_stock"
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                View inventory
              </Link>
            }
          />
          {lowStock.loading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : lowStock.error ? (
            <ErrorState message={lowStock.error} onRetry={lowStock.reload} />
          ) : (lowStock.data ?? []).length === 0 ? (
            <EmptyState
              title="Everything is stocked"
              message="No product has dropped to its minimum level."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH align="right">On hand</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {(lowStock.data ?? []).map((row) => (
                  <TR key={row.id}>
                    <TD className="font-medium text-slate-900">
                      {row.name}
                      <span className="ml-2 text-xs text-slate-400">{row.sku ?? "—"}</span>
                    </TD>
                    <TD align="right" className="tabular-nums">
                      {formatNumber(row.current_stock)} {row.unit}
                    </TD>
                    <TD>
                      <StockStatusBadge status={row.stock_status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
