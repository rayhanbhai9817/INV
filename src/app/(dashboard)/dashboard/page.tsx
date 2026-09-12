"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

import { ErrorState } from "@/components/ui/States";
import { useAsync } from "@/lib/hooks";
import { getDashboardFeed, type DashboardProduct } from "@/lib/db/dashboard";
import { rangeFor, rangeForMonth, stockStatusLabel } from "@/lib/range";
import { MobileCard, MobileCards } from "@/components/ui/DataCards";
import { cn, formatNumber } from "@/lib/utils";

const PIE_COLORS = ["#4318ff", "#6ad2ff", "#05cd99", "#ffb547", "#ee5d50"];

const TABS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "Week" },
  { id: "month", label: "This Month" },
];

const TOOLTIP_STYLE = {
  borderRadius: "16px",
  border: "none",
  boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
  fontSize: "10px",
  fontWeight: "bold",
  color: "#2b3674",
} as const;

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function dayLabel(value: string, grouped: boolean): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    ...(grouped ? {} : { hour: "2-digit", minute: "2-digit" }),
  }).format(date);
}

export default function DashboardPage() {
  const feed = useAsync(() => getDashboardFeed(), []);

  const [dateFilter, setDateFilter] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const filterInfo = useMemo(() => {
    const range =
      dateFilter === "custom" ? rangeFor("custom", customFrom, customTo) : rangeFor(dateFilter);
    return {
      label: dateFilter === "custom" ? range.label : `${range.label} Summary`,
      range: range.details,
      startDate: new Date(range.from),
      endDate: new Date(range.to),
    };
  }, [dateFilter, customFrom, customTo]);

  const products = feed.data?.products ?? [];
  const movements = useMemo(() => feed.data?.movements ?? [], [feed.data]);
  const batches = useMemo(() => feed.data?.batches ?? [], [feed.data]);
  const categories = useMemo(() => feed.data?.categories ?? [], [feed.data]);

  const filtered = useMemo(() => {
    const { startDate, endDate } = filterInfo;

    const data = movements.filter((movement) => {
      const at = new Date(movement.created_at);
      return at >= startDate && at <= endDate;
    });

    const stats = data.reduce(
      (acc, movement) => {
        if (movement.type === "IN") {
          acc.inUnits += movement.qty;
          acc.inBoxes += movement.boxes;
        } else {
          acc.outUnits += Math.abs(movement.qty);
          acc.orders += 1;
        }
        return acc;
      },
      { inUnits: 0, inBoxes: 0, outUnits: 0, orders: 0 },
    );

    return { data, stats };
  }, [movements, filterInfo]);

  const chartData = useMemo(() => {
    const dailyMap: Record<string, { day: string; in: number; out: number; rawDate: Date }> = {};
    const grouped = dateFilter === "month";

    filtered.data.forEach((movement) => {
      const day = dayLabel(movement.created_at, grouped);
      if (!dailyMap[day]) {
        dailyMap[day] = { day, in: 0, out: 0, rawDate: new Date(movement.created_at) };
      }
      if (movement.type === "IN") dailyMap[day].in += movement.qty;
      else dailyMap[day].out += Math.abs(movement.qty);
    });

    return Object.values(dailyMap).sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());
  }, [filtered.data, dateFilter]);

  const totalUnits = products.reduce((sum, product) => sum + product.totalUnits, 0);
  const totalBoxes = products.reduce((sum, product) => sum + product.boxes, 0);

  const lowStock = products.filter(
    (product) => stockStatusLabel(product.totalUnits, product.threshold) === "LOW STOCK",
  );
  const outOfStock = products.filter((product) => Math.max(0, product.totalUnits) === 0);
  const criticalLow = lowStock.filter(
    (product) => product.totalUnits <= product.threshold / 2,
  ).length;
  const warningLow = lowStock.length - criticalLow;
  const healthScore = Math.round(
    ((products.length - lowStock.length - outOfStock.length) / Math.max(1, products.length)) * 100,
  );

  const agingData = useMemo(() => {
    const now = new Date();
    const buckets = [
      { name: "0-30 Days", value: 0 },
      { name: "31-60 Days", value: 0 },
      { name: "61-90 Days", value: 0 },
      { name: "90+ Days", value: 0 },
    ];

    batches
      .filter((batch) => batch.remaining_qty > 0)
      .forEach((batch) => {
        const days = Math.floor(
          (now.getTime() - new Date(batch.batch_date).getTime()) / 86_400_000,
        );
        const index = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
        const bucket = buckets[index];
        if (bucket) bucket.value += batch.remaining_qty;
      });

    return buckets;
  }, [batches]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((product) => {
      map[product.categoryName] = (map[product.categoryName] ?? 0) + product.totalUnits;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.data]);

  const periodStats = useMemo(() => {
    const { inUnits, outUnits } = filtered.stats;
    const net = inUnits - outUnits;
    const { startDate } = filterInfo;

    let netEffectAfterStart = 0;
    movements.forEach((movement) => {
      if (new Date(movement.created_at) >= startDate) {
        netEffectAfterStart += movement.type === "IN" ? movement.qty : -Math.abs(movement.qty);
      }
    });

    const opening = Math.max(0, totalUnits - netEffectAfterStart);

    return { opening, in: inUnits, out: outUnits, net, closing: opening + net };
  }, [filtered.stats, totalUnits, movements, filterInfo]);

  const productHistorical = useMemo(() => {
    const { startDate, endDate } = filterInfo;

    return products
      .map((product) => {
        const inRange = movements.filter(
          (movement) =>
            movement.product_id === product.id &&
            new Date(movement.created_at) >= startDate &&
            new Date(movement.created_at) <= endDate,
        );

        const inUnits = inRange
          .filter((movement) => movement.type === "IN")
          .reduce((sum, movement) => sum + movement.qty, 0);
        const outUnits = inRange
          .filter((movement) => movement.type === "OUT")
          .reduce((sum, movement) => sum + Math.abs(movement.qty), 0);
        const net = inUnits - outUnits;

        let netAfterStart = 0;
        movements
          .filter((movement) => movement.product_id === product.id)
          .forEach((movement) => {
            if (new Date(movement.created_at) >= startDate) {
              netAfterStart += movement.type === "IN" ? movement.qty : -Math.abs(movement.qty);
            }
          });

        const opening = Math.max(0, product.totalUnits - netAfterStart);

        return {
          ...product,
          opening,
          in: inUnits,
          out: outUnits,
          net,
          closing: opening + net,
          transactions: inRange.length,
          current: product.totalUnits,
        };
      })
      .sort((a, b) => b.transactions - a.transactions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.data, movements, filterInfo]);

  const historicalMonths = useMemo(() => {
    const now = new Date();
    const months: Date[] = [];
    for (let month = 0; month <= now.getMonth(); month += 1) {
      months.push(new Date(now.getFullYear(), month, 1));
    }

    return months
      .map((monthStart) => {
        const monthEnd = new Date(
          monthStart.getFullYear(),
          monthStart.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        );

        const monthMovements = movements.filter((movement) => {
          const at = new Date(movement.created_at);
          return at >= monthStart && at <= monthEnd;
        });

        const inUnits = monthMovements
          .filter((movement) => movement.type === "IN")
          .reduce((sum, movement) => sum + movement.qty, 0);
        const outUnits = monthMovements
          .filter((movement) => movement.type === "OUT")
          .reduce((sum, movement) => sum + Math.abs(movement.qty), 0);
        const net = inUnits - outUnits;

        let netAfterMonthStart = 0;
        movements.forEach((movement) => {
          if (new Date(movement.created_at) >= monthStart) {
            netAfterMonthStart += movement.type === "IN" ? movement.qty : -Math.abs(movement.qty);
          }
        });

        const opening = Math.max(0, totalUnits - netAfterMonthStart);

        return {
          month: monthLabel(monthStart),
          opening,
          in: inUnits,
          out: outUnits,
          net,
          closing: opening + net,
          startStr: rangeForMonth(monthStart.getFullYear(), monthStart.getMonth()).from.slice(0, 10),
          endStr: rangeForMonth(monthStart.getFullYear(), monthStart.getMonth()).to.slice(0, 10),
        };
      })
      .reverse();
  }, [movements, totalUnits]);

  const categoryHistorical = useMemo(() => {
    return categories
      .map((category) => {
        const categoryProducts = productHistorical.filter(
          (product) => product.category_id === category.id,
        );
        return {
          name: category.name,
          count: categoryProducts.length,
          opening: categoryProducts.reduce((sum, product) => sum + product.opening, 0),
          in: categoryProducts.reduce((sum, product) => sum + product.in, 0),
          out: categoryProducts.reduce((sum, product) => sum + product.out, 0),
          closing: categoryProducts.reduce((sum, product) => sum + product.closing, 0),
          current: categoryProducts.reduce((sum, product) => sum + product.current, 0),
        };
      })
      .sort((a, b) => b.in + b.out - (a.in + a.out));
  }, [categories, productHistorical]);

  function stepPeriod(direction: -1 | 1) {
    const current = new Date(filterInfo.startDate);

    if (dateFilter === "today" || dateFilter === "yesterday") {
      current.setDate(current.getDate() + direction);
      const iso = current.toISOString().split("T")[0] ?? "";
      setCustomFrom(iso);
      setCustomTo(iso);
    } else if (dateFilter === "this-week") {
      current.setDate(current.getDate() + 7 * direction);
      const end = new Date(current);
      end.setDate(end.getDate() + 6);
      setCustomFrom(current.toISOString().split("T")[0] ?? "");
      setCustomTo(end.toISOString().split("T")[0] ?? "");
    } else {
      current.setMonth(current.getMonth() + direction);
      const range = rangeForMonth(current.getFullYear(), current.getMonth());
      setCustomFrom(range.from.split("T")[0] ?? "");
      setCustomTo(range.to.split("T")[0] ?? "");
    }

    setDateFilter("custom");
  }

  const kpis = [
    {
      label: "Total Products",
      value: `${products.length} Items`,
      sub: `${products.length} Active`,
      icon: Package,
      color: "text-[#4318ff]",
      bg: "bg-[#e0d9ff]",
      link: "/products",
    },
    {
      label: "Total Units",
      value: `${formatNumber(totalUnits)} Units`,
      sub: "Global Stock Balance",
      icon: Boxes,
      color: "text-[#4318ff]",
      bg: "bg-[#e0d9ff]",
      link: "/inventory",
    },
    {
      label: "Total Boxes",
      value: `${formatNumber(totalBoxes)} Boxes`,
      sub: "Approximate Box Count",
      icon: Package,
      color: "text-[#4318ff]",
      bg: "bg-[#e0d9ff]",
      link: "/inventory",
    },
    {
      label: "Stock IN",
      value: `${formatNumber(filtered.stats.inUnits)} Units`,
      sub: `${formatNumber(filtered.stats.inBoxes)} Boxes`,
      icon: TrendingUp,
      color: "text-[#05cd99]",
      bg: "bg-[#e6fff5]",
      link: "/ledger",
    },
    {
      label: "Stock OUT",
      value: `${formatNumber(filtered.stats.outUnits)} Units`,
      sub: "Direct Unit Deduction",
      icon: TrendingDown,
      color: "text-[#ee5d50]",
      bg: "bg-[#ffeded]",
      link: "/ledger",
    },
    {
      label: "Low Stock",
      value: `${lowStock.length} Items`,
      sub: `${warningLow} Warning · ${criticalLow} Critical`,
      icon: AlertTriangle,
      color: "text-[#ffb547]",
      bg: "bg-[#fff8ed]",
      link: "/inventory?status=low_stock",
    },
    {
      label: "Out of Stock",
      value: `${outOfStock.length} Items`,
      sub: "Immediate attention needed",
      icon: XCircle,
      color: "text-[#ee5d50]",
      bg: "bg-[#ffeded]",
      link: "/inventory?status=out_of_stock",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-6 py-4 md:flex-row md:items-center">
          <div className="space-y-1 text-center md:text-left">
            <h1 className="text-[22px] font-black leading-tight tracking-tight text-[#2b3674] md:text-4xl">
              Welcome back, Admin! 👋
            </h1>
            <p className="text-[12px] font-medium text-[#a3aed0] md:text-base">
              Here&apos;s what&apos;s happening with your inventory today.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-4 md:w-auto md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-4">
            <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[#f4f7fe] bg-white p-1 shadow-sm">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDateFilter(tab.id)}
                  className={cn(
                    "h-8 shrink-0 rounded-lg px-4 text-[10px] font-black uppercase tracking-widest transition-all",
                    dateFilter === tab.id
                      ? "bg-[#0b1437] text-white shadow-md hover:bg-[#0b1437]"
                      : "text-[#a3aed0] hover:bg-[#f4f7fe] hover:text-[#2b3674]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-[#f4f7fe] bg-white p-1 shadow-sm">
              <button
                type="button"
                aria-label="Previous period"
                onClick={() => stepPeriod(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a3aed0] transition hover:bg-[#f4f7fe] hover:text-[#2b3674]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <div className="min-w-[120px] px-2 text-center">
                <span className="whitespace-nowrap text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                  {filterInfo.range}
                </span>
              </div>

              <button
                type="button"
                aria-label="Next period"
                onClick={() => stepPeriod(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a3aed0] transition hover:bg-[#f4f7fe] hover:text-[#2b3674]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="mx-1 h-4 w-px bg-[#f4f7fe]" />

              <button
                type="button"
                aria-label="Custom range"
                onClick={() => {
                  if (dateFilter !== "custom") setDateFilter("custom");
                }}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                  dateFilter === "custom"
                    ? "bg-[#4318ff]/10 text-[#4318ff]"
                    : "text-[#a3aed0] hover:bg-[#f4f7fe] hover:text-[#2b3674]",
                )}
              >
                <Calendar className="h-4 w-4" />
              </button>
            </div>

            <div className="flex w-full items-center justify-center gap-3 md:w-auto md:justify-start">
              <Link
                href="/stock-in"
                className="flex h-10 flex-1 items-center justify-center rounded-lg bg-[#0b1437] px-6 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-[#0b1437]/90 md:flex-none"
              >
                Stock IN
              </Link>
              <Link
                href="/stock-out"
                className="flex h-10 flex-1 items-center justify-center rounded-lg border border-[#f4f7fe] bg-white px-6 text-[11px] font-black uppercase tracking-widest text-[#2b3674] shadow-sm transition hover:bg-slate-50 md:flex-none"
              >
                Stock OUT
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 hidden h-px w-full bg-[#f4f7fe] md:block" />

      {dateFilter === "custom" && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#f4f7fe] bg-white p-4 shadow-sm">
          <div className="space-y-1">
            <p className="ml-1 text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]">
              From Date
            </p>
            <input
              type="date"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              className="h-10 rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none"
            />
          </div>
          <div className="space-y-1">
            <p className="ml-1 text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]">
              To Date
            </p>
            <input
              type="date"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              className="h-10 rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none"
            />
          </div>
        </div>
      )}

      {feed.error ? (
        <ErrorState message={feed.error} onRetry={feed.reload} />
      ) : feed.loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#4318ff] border-t-transparent" />
          Loading…
        </div>
      ) : (
        <>
          {/* ---------------------- Period summary strip --------------------- */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            <div className="space-y-1 rounded-2xl border border-[#f4f7fe] bg-white p-6 shadow-sm">
              <h2 className="text-lg font-black tracking-tight text-[#2b3674]">
                {filterInfo.label}
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#4318ff]">
                {filterInfo.range}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-2xl border border-[#f4f7fe] bg-white p-6 shadow-sm">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]">
                  Stock IN
                </p>
                <p className="text-lg font-black text-[#05cd99]">
                  {formatNumber(filtered.stats.inUnits)} Units
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]">
                  Stock OUT
                </p>
                <p className="text-lg font-black text-[#ee5d50]">
                  {formatNumber(filtered.stats.outUnits)} Units
                </p>
              </div>
            </div>
          </div>

          {/* ------------------------- Four summaries ------------------------ */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white p-6 shadow-sm">
              <div className="absolute right-0 top-0 p-4 opacity-5">
                <ClipboardList className="h-16 w-16 text-[#4318ff]" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#4318ff]/10 p-2">
                    <ClipboardList className="h-4 w-4 text-[#4318ff]" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                    Period Stock Summary
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-y-4">
                  <div>
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#a3aed0]">
                      Opening
                    </p>
                    <p className="text-lg font-black text-[#2b3674]">
                      {formatNumber(periodStats.opening)}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#a3aed0]">
                      Net Flow
                    </p>
                    <p
                      className={cn(
                        "text-lg font-black",
                        periodStats.net >= 0 ? "text-[#05cd99]" : "text-[#ee5d50]",
                      )}
                    >
                      {periodStats.net > 0 ? "+" : ""}
                      {formatNumber(periodStats.net)}
                    </p>
                  </div>
                  <div className="col-span-2 border-t border-[#f4f7fe] pt-2">
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-[#a3aed0]">
                      Closing Stock
                    </p>
                    <p className="text-xl font-black text-[#4318ff]">
                      {formatNumber(periodStats.closing)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#05cd99]/10 p-2">
                    <TrendingUp className="h-4 w-4 text-[#05cd99]" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                    Stock IN (Total)
                  </h3>
                </div>
                <div>
                  <h3 className="text-3xl font-black text-[#2b3674]">
                    {formatNumber(periodStats.in)}
                  </h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#05cd99]">
                    Units Received
                  </p>
                </div>
                <div className="border-t border-[#f4f7fe] pt-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#a3aed0]">
                    Boxes Received
                  </p>
                  <p className="text-xs font-black text-[#05cd99]">
                    {formatNumber(filtered.stats.inBoxes)}{" "}
                    <span className="text-[10px] font-medium tracking-normal text-[#a3aed0]">
                      Boxes
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#ee5d50]/10 p-2">
                    <TrendingDown className="h-4 w-4 text-[#ee5d50]" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                    Stock OUT (Total)
                  </h3>
                </div>
                <div>
                  <h3 className="text-3xl font-black text-[#2b3674]">
                    {formatNumber(periodStats.out)}
                  </h3>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#ee5d50]">
                    Units Dispatched
                  </p>
                </div>
                <div className="border-t border-[#f4f7fe] pt-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#a3aed0]">
                    Active Orders
                  </p>
                  <p className="text-xs font-black text-[#2b3674]">
                    {filtered.stats.orders}{" "}
                    <span className="text-[10px] font-medium tracking-normal text-[#a3aed0]">
                      Transactions
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white p-6 shadow-sm">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#ffb547]/10 p-2">
                    <AlertTriangle className="h-4 w-4 text-[#ffb547]" />
                  </div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                    Inventory Health
                  </h3>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-3xl font-black text-[#2b3674]">{healthScore}%</h3>
                    <p
                      className={cn(
                        "mt-1 text-[10px] font-bold uppercase tracking-widest",
                        healthScore > 80
                          ? "text-[#05cd99]"
                          : healthScore > 50
                            ? "text-[#ffb547]"
                            : "text-[#ee5d50]",
                      )}
                    >
                      {healthScore > 80 ? "Optimal" : healthScore > 50 ? "Stable" : "Risk"}
                    </p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[#f4f7fe] border-t-[#4318ff]">
                    <span className="text-[10px] font-black text-[#2b3674]">{healthScore}</span>
                  </div>
                </div>
                <div className="border-t border-[#f4f7fe] pt-2">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-[#a3aed0]">
                    Low Stock Alerts
                  </p>
                  <p className="text-xs font-black text-[#ffb547]">
                    {lowStock.length} Products{" "}
                    <span className="text-[10px] font-medium tracking-normal text-[#a3aed0]">
                      Below Min
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------------ KPIs ----------------------------- */}
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {kpis.map((kpi, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-2xl border border-[#f4f7fe] bg-white p-6 shadow-sm transition-all duration-300"
              >
                <div className="flex-1 space-y-2">
                  <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]">
                    {kpi.label}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-[#2b3674]">
                      {String(kpi.value).split(" ")[0]}{" "}
                      <span className="text-sm font-bold text-[#4318ff]">
                        {String(kpi.value).split(" ")[1] ?? ""}
                      </span>
                    </h3>
                  </div>
                  <p className="truncate text-[10px] font-medium text-[#a3aed0]">
                    {kpi.sub.split("·")[0]}
                  </p>
                  <Link
                    href={kpi.link}
                    className="mt-2 block text-[10px] font-bold text-[#a3aed0] transition-colors hover:text-[#4318ff]"
                  >
                    View all →
                  </Link>
                </div>
                <div className={cn("flex shrink-0 rounded-full p-3", kpi.bg)}>
                  <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                </div>
              </div>
            ))}
          </div>

          {/* -------------------- Movement + category charts ------------------ */}
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white shadow-sm">
              <div className="flex flex-row items-center justify-between border-b border-[#f4f7fe] px-6 pb-4 pt-6">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                    Inventory Movement
                  </h3>
                  <p className="text-[10px] font-bold text-[#a3aed0]">
                    Operational flow (Stock IN vs OUT)
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#05cd99]">
                      Total IN
                    </p>
                    <p className="text-xs font-black text-[#2b3674]">
                      {formatNumber(filtered.stats.inUnits)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#ee5d50]">
                      Total OUT
                    </p>
                    <p className="text-xs font-black text-[#2b3674]">
                      {formatNumber(filtered.stats.outUnits)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-6 pt-10">
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#05cd99" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#05cd99" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ee5d50" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#ee5d50" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f7fe" />
                      <XAxis
                        dataKey="day"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#a3aed0", fontSize: 10, fontWeight: 700 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#a3aed0", fontSize: 10, fontWeight: 700 }}
                      />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Area
                        type="monotone"
                        dataKey="in"
                        stroke="#05cd99"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorIn)"
                        name="Stock IN"
                      />
                      <Area
                        type="monotone"
                        dataKey="out"
                        stroke="#ee5d50"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorOut)"
                        name="Stock OUT"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white shadow-sm">
              <div className="border-b border-[#f4f7fe] px-6 pb-4 pt-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                  Inventory by Category
                </h3>
                <p className="text-[10px] font-bold text-[#a3aed0]">
                  Stock distribution across categories
                </p>
              </div>
              <div className="flex items-center justify-center p-6">
                <div className="h-[300px] w-full max-w-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length] ?? "#4318ff"}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="ml-6 space-y-2">
                  {categoryBreakdown.map((category, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="text-[10px] font-bold text-[#2b3674]">{category.name}</span>
                      <span className="text-[10px] text-[#a3aed0]">
                        {formatNumber(category.value)} Units
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ----------------------- Aging + health dial --------------------- */}
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white shadow-sm">
              <div className="border-b border-[#f4f7fe] px-6 pb-4 pt-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                  FIFO Stock Aging
                </h3>
                <p className="text-[10px] font-bold text-[#a3aed0]">
                  Units grouped by storage duration
                </p>
              </div>
              <div className="p-6 pt-10">
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingData} layout="vertical">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        horizontal
                        vertical={false}
                        stroke="#f4f7fe"
                      />
                      <XAxis type="number" axisLine={false} tickLine={false} hide />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#a3aed0", fontSize: 10, fontWeight: 700 }}
                        width={80}
                      />
                      <Tooltip cursor={{ fill: "transparent" }} contentStyle={TOOLTIP_STYLE} />
                      <Bar
                        dataKey="value"
                        fill="#4318ff"
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        name="Units"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white shadow-sm">
              <div className="border-b border-[#f4f7fe] px-6 pb-4 pt-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                  Inventory Health
                </h3>
                <p className="text-[10px] font-bold text-[#a3aed0]">
                  Real-time stock status overview
                </p>
              </div>
              <div className="p-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="relative h-40 w-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[{ value: healthScore }, { value: 100 - healthScore }]}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={70}
                          startAngle={90}
                          endAngle={450}
                          stroke="none"
                          dataKey="value"
                        >
                          <Cell fill="#4318ff" />
                          <Cell fill="#f4f7fe" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-black text-[#2b3674]">{healthScore}%</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]">
                        Score
                      </span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]">
                      Overall Status
                    </p>
                    <p
                      className={cn(
                        "text-xs font-black uppercase tracking-widest",
                        healthScore > 80
                          ? "text-[#05cd99]"
                          : healthScore > 50
                            ? "text-[#ffb547]"
                            : "text-[#ee5d50]",
                      )}
                    >
                      {healthScore > 80 ? "Excellent" : healthScore > 50 ? "Stable" : "Critical"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ------------------------ Critical alerts ------------------------ */}
          <div className="mt-8 overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white shadow-sm">
            <div className="border-b border-[#f4f7fe] px-6 pb-4 pt-6">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                Critical Stock Alerts
              </h3>
              <p className="text-[10px] font-bold text-[#a3aed0]">
                Immediate attention required (Out of stock or Low stock)
              </p>
            </div>
            <MobileCards>
              {[...outOfStock, ...lowStock].slice(0, 10).map((product, index) => (
                <MobileCard
                  key={index}
                  title={product.name}
                  subtitle={product.sku ?? "NO SKU"}
                  badge={
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest",
                        product.totalUnits <= 0
                          ? "bg-[#ee5d50]/10 text-[#ee5d50]"
                          : "bg-[#ffb547]/10 text-[#ffb547]",
                      )}
                    >
                      {product.totalUnits <= 0 ? "Out of Stock" : "Low Stock"}
                    </span>
                  }
                  fields={[
                    { label: "Units", value: formatNumber(product.totalUnits) },
                    { label: "Min. Threshold", value: formatNumber(product.threshold), tone: "text-[#a3aed0]" },
                  ]}
                  footer={
                    <Link
                      href="/stock-in"
                      className="text-[9px] font-black uppercase tracking-widest text-[#4318ff]"
                    >
                      Reorder →
                    </Link>
                  }
                />
              ))}
              {outOfStock.length === 0 && lowStock.length === 0 && (
                <p className="px-6 py-12 text-center text-[11px] font-black uppercase tracking-widest text-[#05cd99]">
                  Inventory health is optimal. No alerts.
                </p>
              )}
            </MobileCards>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#f4f7fe]">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                      Product
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                      Units
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                      Min. Threshold
                    </th>
                    <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f7fe]">
                  {[...outOfStock, ...lowStock].slice(0, 10).map((product, index) => (
                    <AlertRow key={index} product={product} />
                  ))}
                  {outOfStock.length === 0 && lowStock.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-[11px] font-black uppercase tracking-widest text-[#05cd99]"
                      >
                        Inventory health is optimal. No alerts.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* --------------------- Historical analytics ---------------------- */}
          <div className="mt-8 space-y-8">
            <div className="overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white shadow-sm">
              <div className="flex flex-row items-center justify-between border-b border-[#f4f7fe] px-6 pb-4 pt-6">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                    Product Performance Analytics
                  </h3>
                  <p className="text-[10px] font-bold text-[#a3aed0]">
                    Detailed historical data for the selected period
                  </p>
                </div>
                <Link
                  href="/reports"
                  className="h-8 px-4 text-[10px] font-black uppercase tracking-widest text-[#a3aed0] transition hover:text-[#4318ff]"
                >
                  Detailed Reports
                </Link>
              </div>
              <MobileCards>
                {productHistorical.slice(0, 10).map((product) => (
                  <MobileCard
                    key={product.id}
                    title={product.name}
                    subtitle={product.sku || "NO SKU"}
                    fields={[
                      { label: "Opening", value: formatNumber(product.opening) },
                      { label: "Closing", value: formatNumber(product.closing), tone: "text-[#4318ff]" },
                      { label: "IN", value: product.in > 0 ? `+${formatNumber(product.in)}` : "0", tone: "text-[#05cd99]" },
                      { label: "OUT", value: product.out > 0 ? `-${formatNumber(product.out)}` : "0", tone: "text-[#ee5d50]" },
                      { label: "Net Flow", value: `${product.net > 0 ? "+" : ""}${formatNumber(product.net)}`, tone: product.net >= 0 ? "text-[#05cd99]" : "text-[#ee5d50]" },
                      { label: "Current Total", value: formatNumber(product.current) },
                    ]}
                  />
                ))}
                {productHistorical.length === 0 && (
                  <p className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]">
                    No transaction data for this period
                  </p>
                )}
              </MobileCards>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-[#f4f7fe]">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                        Product / SKU
                      </th>
                      {["Opening", "IN", "OUT", "Net Flow", "Closing", "Current Total"].map(
                        (head) => (
                          <th
                            key={head}
                            className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#a3aed0]"
                          >
                            {head}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {productHistorical.slice(0, 10).map((product) => (
                      <tr key={product.id} className="border-b border-[#f4f7fe] hover:bg-[#f4f7fe]/50">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black text-[#2b3674]">
                              {product.name}
                            </span>
                            <span className="text-[9px] font-bold text-[#a3aed0]">
                              {product.sku || "NO SKU"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#2b3674]">
                          {formatNumber(product.opening)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#05cd99]">
                          {product.in > 0 ? `+${formatNumber(product.in)}` : "0"}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#ee5d50]">
                          {product.out > 0 ? `-${formatNumber(product.out)}` : "0"}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-4 text-right text-[11px] font-black",
                            product.net >= 0 ? "text-[#05cd99]" : "text-[#ee5d50]",
                          )}
                        >
                          {product.net > 0 ? "+" : ""}
                          {formatNumber(product.net)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-black text-[#4318ff]">
                          {formatNumber(product.closing)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#2b3674]">
                          {formatNumber(product.current)}
                        </td>
                      </tr>
                    ))}
                    {productHistorical.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="h-24 text-center text-[10px] font-bold uppercase tracking-widest text-[#a3aed0]"
                        >
                          No transaction data for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white shadow-sm">
              <div className="border-b border-[#f4f7fe] px-6 pb-4 pt-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                  Monthly Historical Browsing
                </h3>
                <p className="text-[10px] font-bold text-[#a3aed0]">
                  Performance metrics for recent months
                </p>
              </div>
              <MobileCards>
                {historicalMonths.map((month, index) => (
                  <MobileCard
                    key={index}
                    title={month.month}
                    fields={[
                      { label: "Opening", value: formatNumber(month.opening) },
                      { label: "Closing", value: formatNumber(month.closing), tone: "text-[#4318ff]" },
                      { label: "IN", value: formatNumber(month.in), tone: "text-[#05cd99]" },
                      { label: "OUT", value: formatNumber(month.out), tone: "text-[#ee5d50]" },
                    ]}
                    footer={
                      <button
                        type="button"
                        onClick={() => {
                          setCustomFrom(month.startStr);
                          setCustomTo(month.endStr);
                          setDateFilter("custom");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="text-[9px] font-black uppercase tracking-widest text-[#4318ff]"
                      >
                        Analyze Month
                      </button>
                    }
                  />
                ))}
              </MobileCards>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-[#f4f7fe]">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                        Month Period
                      </th>
                      {["Opening", "IN", "OUT", "Closing"].map((head) => (
                        <th
                          key={head}
                          className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#a3aed0]"
                        >
                          {head}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicalMonths.map((month, index) => (
                      <tr key={index} className="border-b border-[#f4f7fe] hover:bg-[#f4f7fe]/50">
                        <td className="px-6 py-4 text-[11px] font-black text-[#2b3674]">
                          {month.month}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#2b3674]">
                          {formatNumber(month.opening)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#05cd99]">
                          {formatNumber(month.in)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#ee5d50]">
                          {formatNumber(month.out)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-black text-[#4318ff]">
                          {formatNumber(month.closing)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setCustomFrom(month.startStr);
                              setCustomTo(month.endStr);
                              setDateFilter("custom");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="h-7 rounded-md px-2 text-[9px] font-black uppercase tracking-widest text-[#4318ff] transition hover:bg-[#4318ff]/10"
                          >
                            Analyze Month
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#f4f7fe] bg-white shadow-sm">
              <div className="border-b border-[#f4f7fe] px-6 pb-4 pt-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#2b3674]">
                  Category Historical Performance
                </h3>
                <p className="text-[10px] font-bold text-[#a3aed0]">
                  Volume distribution by category in selected period
                </p>
              </div>
              <MobileCards>
                {categoryHistorical.map((category, index) => (
                  <MobileCard
                    key={index}
                    title={category.name}
                    fields={[
                      { label: "Opening", value: formatNumber(category.opening) },
                      { label: "Closing", value: formatNumber(category.closing), tone: "text-[#4318ff]" },
                      { label: "IN", value: formatNumber(category.in), tone: "text-[#05cd99]" },
                      { label: "OUT", value: formatNumber(category.out), tone: "text-[#ee5d50]" },
                      { label: "Current Total", value: formatNumber(category.current), wide: true },
                    ]}
                  />
                ))}
              </MobileCards>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead className="bg-[#f4f7fe]">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                        Category Name
                      </th>
                      {["Opening", "IN", "OUT", "Closing"].map((head) => (
                        <th
                          key={head}
                          className="px-4 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#a3aed0]"
                        >
                          {head}
                        </th>
                      ))}
                      <th className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-[#a3aed0]">
                        Current Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryHistorical.map((category, index) => (
                      <tr key={index} className="border-b border-[#f4f7fe] hover:bg-[#f4f7fe]/50">
                        <td className="px-6 py-4 text-[11px] font-black text-[#2b3674]">
                          {category.name}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#2b3674]">
                          {formatNumber(category.opening)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#05cd99]">
                          {formatNumber(category.in)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-bold text-[#ee5d50]">
                          {formatNumber(category.out)}
                        </td>
                        <td className="px-4 py-4 text-right text-[11px] font-black text-[#4318ff]">
                          {formatNumber(category.closing)}
                        </td>
                        <td className="px-6 py-4 text-right text-[11px] font-bold text-[#2b3674]">
                          {formatNumber(category.current)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function AlertRow({ product }: { product: DashboardProduct }) {
  const isOut = product.totalUnits <= 0;

  return (
    <tr className="group transition-colors hover:bg-slate-50/50">
      <td className="px-6 py-4">
        <div className="space-y-1">
          <p className="text-[11px] font-black text-[#2b3674]">{product.name}</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#a3aed0]">
            {product.sku}
          </p>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <p className="text-[11px] font-black text-[#2b3674]">{formatNumber(product.totalUnits)}</p>
      </td>
      <td className="px-6 py-4 text-right">
        <p className="text-[11px] font-bold text-[#a3aed0]">{formatNumber(product.threshold)}</p>
      </td>
      <td className="px-6 py-4 text-center">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest",
            isOut ? "bg-[#ee5d50]/10 text-[#ee5d50]" : "bg-[#ffb547]/10 text-[#ffb547]",
          )}
        >
          {isOut ? "Out of Stock" : "Low Stock"}
        </span>
      </td>
      <td className="px-6 py-4 text-right">
        <Link
          href="/stock-in"
          className="text-[9px] font-black uppercase tracking-widest text-[#4318ff] hover:underline"
        >
          Reorder →
        </Link>
      </td>
    </tr>
  );
}
