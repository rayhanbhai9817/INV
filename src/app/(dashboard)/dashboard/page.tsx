"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  Boxes,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Package,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { Panel, StatTile, TileLabel } from "@/components/ui/StatTile";
import { CardSkeleton, ErrorState } from "@/components/ui/States";
import { useAsync } from "@/lib/hooks";
import { getDashboardStats, getPeriodStats, periodRange } from "@/lib/db/dashboard";
import { cn, formatNumber, todayISO } from "@/lib/utils";
import type { StatsPeriod } from "@/types";

const PERIODS: Array<{ key: StatsPeriod; label: string }> = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "Week" },
  { key: "month", label: "This Month" },
];

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function longDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<StatsPeriod>("today");
  const [anchor, setAnchor] = useState(todayISO());

  const stats = useAsync(() => getDashboardStats(), []);
  const periodStats = useAsync(
    async () =>
      getPeriodStats(period, anchor, (await getDashboardStats()).totalStockUnits),
    [period, anchor],
  );

  const range = periodRange(period, anchor);
  const data = stats.data;

  return (
    <div className="space-y-5">
      {/* ----------------------------- Greeting ---------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-[34px] font-bold leading-tight tracking-tight text-navy-800">
            Welcome back, Admin! <span className="align-middle">👋</span>
          </h2>
          <p className="mt-1 text-sm text-navy-300">
            Here&apos;s what&apos;s happening with your inventory today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period segmented control */}
          <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(16,24,64,0.06)] ring-1 ring-navy-200/50">
            {PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] transition",
                  period === item.key
                    ? "bg-navy-900 text-white"
                    : "text-navy-300 hover:text-navy-700",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Date stepper */}
          <div className="flex items-center gap-1 rounded-full bg-white px-2 py-1 shadow-[0_1px_2px_rgba(16,24,64,0.06)] ring-1 ring-navy-200/50">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => setAnchor((value) => shiftDate(value, -1))}
              className="rounded-full p-1.5 text-navy-300 transition hover:bg-canvas hover:text-navy-700"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-700">
              {longDate(anchor)}
            </span>
            <button
              type="button"
              aria-label="Next day"
              onClick={() => setAnchor((value) => shiftDate(value, 1))}
              disabled={anchor >= todayISO()}
              className="rounded-full p-1.5 text-navy-300 transition hover:bg-canvas hover:text-navy-700 disabled:opacity-40"
            >
              <ChevronRight size={15} />
            </button>
            <label className="relative cursor-pointer rounded-full p-1.5 text-navy-300 transition hover:bg-canvas hover:text-navy-700">
              <Calendar size={15} />
              <input
                type="date"
                value={anchor}
                max={todayISO()}
                onChange={(event) => event.target.value && setAnchor(event.target.value)}
                aria-label="Pick a date"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>

          <Link
            href="/stock-in"
            className="rounded-full bg-navy-900 px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-white transition hover:bg-navy-800"
          >
            Stock In
          </Link>
          <Link
            href="/stock-out"
            className="rounded-full bg-white px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-navy-800 ring-1 ring-navy-200/60 transition hover:bg-canvas"
          >
            Stock Out
          </Link>
        </div>
      </div>

      {stats.error ? (
        <Panel>
          <ErrorState message={stats.error} onRetry={stats.reload} />
        </Panel>
      ) : stats.loading || !data ? (
        <div className="space-y-5">
          <CardSkeleton count={2} />
          <CardSkeleton />
        </div>
      ) : (
        <>
          {/* --------------------- Today summary strip -------------------- */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel className="flex flex-col justify-center py-6">
              <h3 className="font-serif text-xl font-bold text-navy-800">Today Summary</h3>
              <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                {longDate(todayISO())}
              </p>
            </Panel>

            <Panel className="grid grid-cols-2 gap-4 py-6">
              <div>
                <TileLabel>Stock In</TileLabel>
                <p className="mt-2 font-serif text-2xl font-bold text-success">
                  {formatNumber(data.stockInToday)}{" "}
                  <span className="text-sm font-semibold">Units</span>
                </p>
              </div>
              <div>
                <TileLabel>Stock Out</TileLabel>
                <p className="mt-2 font-serif text-2xl font-bold text-danger">
                  {formatNumber(data.stockOutToday)}{" "}
                  <span className="text-sm font-semibold">Units</span>
                </p>
              </div>
            </Panel>
          </div>

          {/* ------------------------ Period row -------------------------- */}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Panel className="relative overflow-hidden">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <ClipboardList size={15} />
                </span>
                <TileLabel>Period Stock Summary</TileLabel>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <TileLabel>Opening</TileLabel>
                  <p className="mt-1.5 font-serif text-[22px] font-bold text-navy-800">
                    {periodStats.data ? formatNumber(periodStats.data.opening) : "—"}
                  </p>
                </div>
                <div>
                  <TileLabel>Net Flow</TileLabel>
                  <p
                    className={cn(
                      "mt-1.5 font-serif text-[22px] font-bold",
                      (periodStats.data?.netFlow ?? 0) < 0 ? "text-danger" : "text-success",
                    )}
                  >
                    {periodStats.data
                      ? `${periodStats.data.netFlow > 0 ? "+" : ""}${formatNumber(periodStats.data.netFlow)}`
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-navy-200/50 pt-4">
                <TileLabel>Closing Stock</TileLabel>
                <p className="mt-1.5 font-serif text-[22px] font-bold text-navy-800">
                  {periodStats.data ? formatNumber(periodStats.data.closing) : "—"}
                </p>
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success">
                  <TrendingUp size={15} />
                </span>
                <TileLabel>Stock In (Total)</TileLabel>
              </div>
              <p className="mt-5 font-serif text-[30px] font-bold leading-none text-navy-800">
                {periodStats.data ? formatNumber(periodStats.data.stockIn) : "—"}
              </p>
              <TileLabel className="mt-2">Units Received</TileLabel>
              <div className="mt-4 border-t border-navy-200/50 pt-3">
                <TileLabel>Period</TileLabel>
                <p className="mt-1 text-[11px] font-semibold text-navy-500">
                  {range.from === range.to ? range.from : `${range.from} → ${range.to}`}
                </p>
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <TrendingDown size={15} />
                </span>
                <TileLabel>Stock Out (Total)</TileLabel>
              </div>
              <p className="mt-5 font-serif text-[30px] font-bold leading-none text-navy-800">
                {periodStats.data ? formatNumber(periodStats.data.stockOut) : "—"}
              </p>
              <TileLabel className="mt-2">Units Dispatched</TileLabel>
              <div className="mt-4 border-t border-navy-200/50 pt-3">
                <TileLabel>Issues Today</TileLabel>
                <p className="mt-1 text-[11px] font-semibold text-navy-500">
                  <span className="text-danger">{formatNumber(data.stockOutOrdersToday)}</span>{" "}
                  Transactions
                </p>
              </div>
            </Panel>

            <Panel>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/10 text-warning">
                    <AlertTriangle size={15} />
                  </span>
                  <TileLabel>Inventory Health</TileLabel>
                </div>
                <HealthDial percent={data.healthPercent} />
              </div>
              <p className="mt-5 font-serif text-[30px] font-bold leading-none text-navy-800">
                {data.healthPercent}%
              </p>
              <TileLabel className="mt-2">
                {data.healthPercent === 100 ? "Optimal" : "Needs attention"}
              </TileLabel>
              <div className="mt-4 border-t border-navy-200/50 pt-3">
                <TileLabel>Low Stock Alerts</TileLabel>
                <p className="mt-1 text-[11px] font-semibold text-navy-500">
                  <span className="text-warning">{formatNumber(data.lowStockCount)} Products</span>{" "}
                  Below Min
                </p>
              </div>
            </Panel>
          </div>

          {/* --------------------------- Totals --------------------------- */}
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <StatTile
              label="Total Products"
              value={formatNumber(data.totalProducts)}
              unit="Items"
              caption={`${formatNumber(data.totalProducts)} Active`}
              href="/products"
              icon={<Package size={16} />}
            />
            <StatTile
              label="Total Units"
              value={formatNumber(data.totalStockUnits)}
              unit="Units"
              caption="Global Stock Balance"
              href="/inventory"
              icon={<Boxes size={16} />}
            />
            <StatTile
              label="Total Boxes"
              value={formatNumber(data.totalBoxes)}
              unit="Boxes"
              caption="Approximate Box Count"
              href="/inventory"
              icon={<Package size={16} />}
            />

            <StatTile
              label="Stock In"
              value={formatNumber(data.stockInToday)}
              unit="Units"
              caption={`${formatNumber(data.stockInBoxesToday)} Boxes`}
              href="/stock-in"
              tone="green"
              icon={<TrendingUp size={16} />}
            />
            <StatTile
              label="Stock Out"
              value={formatNumber(data.stockOutToday)}
              unit="Units"
              caption="Direct Unit Deduction"
              href="/stock-out"
              tone="red"
              icon={<TrendingDown size={16} />}
            />
            <StatTile
              label="Low Stock"
              value={formatNumber(data.lowStockCount)}
              unit="Items"
              caption={`${formatNumber(data.lowStockCount)} Warning`}
              href="/inventory?status=low_stock"
              tone="amber"
              icon={<AlertTriangle size={16} />}
            />

            <StatTile
              label="Out of Stock"
              value={formatNumber(data.outOfStockCount)}
              unit="Items"
              caption="Immediate attention needed"
              href="/inventory?status=out_of_stock"
              tone="red"
              icon={<XCircle size={16} />}
            />
          </div>
        </>
      )}
    </div>
  );
}

/** Small circular gauge shown beside the inventory-health figure. */
function HealthDial({ percent }: { percent: number }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.min(100, Math.max(0, percent)) / 100) * circumference;

  return (
    <span className="relative flex h-11 w-11 items-center justify-center">
      <svg viewBox="0 0 40 40" className="h-11 w-11 -rotate-90">
        <circle cx="20" cy="20" r={radius} fill="none" stroke="#e0e5f2" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="#4318ff"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span className="absolute font-serif text-[10px] font-bold text-navy-700">{percent}</span>
    </span>
  );
}
