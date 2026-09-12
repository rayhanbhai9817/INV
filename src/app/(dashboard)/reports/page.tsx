"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, LayoutGrid, Loader2, Package, XCircle } from "lucide-react";

import { useAsync } from "@/lib/hooks";
import { getLedgerFeed } from "@/lib/db/ledger";
import { allInventory } from "@/lib/db/inventory";
import { rangeFor } from "@/lib/range";
import { MobileCard, MobileCards } from "@/components/ui/DataCards";
import { cn, downloadCsv, formatNumber, toCsv } from "@/lib/utils";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this-week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "prev-month", label: "Previous Month" },
  { value: "this-year", label: "This Year" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

const DAY_MS = 86_400_000;
const MAX_DAYS = 365;

function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export default function ReportsPage() {
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const range = rangeFor(preset, from, to);
  const feed = useAsync(() => getLedgerFeed(), []);
  const inventory = useAsync(() => allInventory(), []);

  const movements = useMemo(() => feed.data ?? [], [feed.data]);
  const products = useMemo(() => inventory.data ?? [], [inventory.data]);

  const reports = useMemo(() => {
    if (!feed.data || !inventory.data) return null;

    const fromTime = new Date(range.from).getTime();
    const toTime = new Date(range.to).getTime();

    const opening = movements
      .filter((row) => new Date(row.occurredAt).getTime() < fromTime)
      .reduce((sum, row) => sum + row.unitsDelta, 0);

    const inWindow = movements.filter((row) => {
      const at = new Date(row.occurredAt).getTime();
      return at >= fromTime && at <= toTime;
    });

    const stats = inWindow.reduce(
      (acc, row) => {
        if (row.type === "IN") {
          acc.totalIn += row.unitsDelta;
          acc.countIn += 1;
        } else {
          acc.totalOut += Math.abs(row.unitsDelta);
          acc.countOut += 1;
        }
        return acc;
      },
      { totalIn: 0, totalOut: 0, countIn: 0, countOut: 0 },
    );

    const net = stats.totalIn - stats.totalOut;

    // Day-by-day, capped at a year so a wide range cannot stall the browser.
    const earliest = Date.now() - MAX_DAYS * DAY_MS;
    const start = new Date(Math.max(fromTime, earliest));
    start.setHours(0, 0, 0, 0);
    const end = new Date(Math.min(toTime, Date.now()));
    end.setHours(23, 59, 59, 999);

    const daily: Array<{
      date: string;
      in: number;
      out: number;
      net: number;
      closing: number;
    }> = [];

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);

      let dayIn = 0;
      let dayOut = 0;
      let effectToEndOfDay = 0;

      inWindow.forEach((row) => {
        const at = new Date(row.occurredAt).getTime();
        if (at >= dayStart.getTime() && at <= dayEnd.getTime()) {
          if (row.type === "IN") dayIn += row.unitsDelta;
          else dayOut += Math.abs(row.unitsDelta);
        }
        if (at <= dayEnd.getTime()) effectToEndOfDay += row.unitsDelta;
      });

      daily.push({
        date: dayLabel(dayStart),
        in: dayIn,
        out: dayOut,
        net: dayIn - dayOut,
        closing: opening + effectToEndOfDay,
      });
    }

    const issued = new Map<string, { name: string; sku: string | null; units: number }>();
    inWindow
      .filter((row) => row.type === "OUT")
      .forEach((row) => {
        const entry = issued.get(row.productId) ?? {
          name: row.productName,
          sku: row.productSku,
          units: 0,
        };
        entry.units += Math.abs(row.unitsDelta);
        issued.set(row.productId, entry);
      });

    const topMoving = Array.from(issued.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    return {
      summary: {
        opening,
        in: stats.totalIn,
        out: stats.totalOut,
        net,
        closing: opening + net,
        txnsIn: stats.countIn,
        txnsOut: stats.countOut,
        lowStock: products.filter((row) => row.stock_status === "low_stock").length,
        outOfStock: products.filter((row) => row.current_stock <= 0).length,
        categories: new Set(products.map((row) => row.category_id).filter(Boolean)).size,
        totalProducts: products.length,
      },
      daily: daily.reverse(),
      topMoving,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.data, inventory.data, movements, products, range.from, range.to]);

  function handleExport() {
    if (!reports) return;
    downloadCsv(
      `ozipco-report-${preset}.csv`,
      toCsv(
        ["Date", "Stock IN", "Stock OUT", "Net Movement", "Closing Balance"],
        [
          ["Opening Stock", reports.summary.opening, "", "", ""],
          ["Total Stock IN", reports.summary.in, "", "", ""],
          ["Total Stock OUT", reports.summary.out, "", "", ""],
          ["Net Movement", reports.summary.net, "", "", ""],
          ["Closing Stock", reports.summary.closing, "", "", ""],
          ["", "", "", "", ""],
          ...reports.daily.map((day) => [day.date, day.in, day.out, day.net, day.closing]),
        ],
      ),
    );
  }

  const loading = feed.loading || inventory.loading;
  const error = feed.error ?? inventory.error;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">
            {range.label} Report
          </h1>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#4318ff]">
            {range.details}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={!reports}
            className="flex h-11 items-center rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674] shadow-sm transition hover:bg-[#f4f7fe] disabled:opacity-50"
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#f4f7fe] bg-white p-3 shadow-sm">
        <select
          value={preset}
          onChange={(event) => setPreset(event.target.value)}
          className="h-10 w-[180px] rounded-xl border-none bg-[#f4f7fe] px-3 text-xs font-bold text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
        >
          {PERIODS.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>

        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="h-10 w-[140px] rounded-xl border-none bg-[#f4f7fe] px-3 text-xs font-bold text-[#2b3674] outline-none"
            />
            <span className="font-black text-[#a3aed0]">—</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="h-10 w-[140px] rounded-xl border-none bg-[#f4f7fe] px-3 text-xs font-bold text-[#2b3674] outline-none"
            />
          </div>
        )}

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <div className="flex items-center gap-1.5 rounded-lg bg-[#05cd99]/10 px-3 py-1.5">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#05cd99]" />
            <span className="text-[9px] font-black uppercase tracking-wider text-[#05cd99]">
              Live &amp; Automated
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-[20px] bg-white py-12 text-sm text-[#ee5d50] ring-1 ring-black/5">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              feed.reload();
              inventory.reload();
            }}
            className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
          >
            Try again
          </button>
        </div>
      ) : !reports ? (
        <div className="flex items-center justify-center py-12 text-sm text-[#a3aed0]">
          No report data available
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Kpi
              label="Opening Stock"
              labelColor="text-[#a3aed0]"
              value={formatNumber(reports.summary.opening)}
              valueColor="text-[#2b3674]"
              sub="Units"
            />
            <Kpi
              label="Stock IN (+)"
              labelColor="text-[#05cd99]"
              value={formatNumber(reports.summary.in)}
              valueColor="text-[#05cd99]"
              sub={`${reports.summary.txnsIn} Txns`}
            />
            <Kpi
              label="Stock OUT (-)"
              labelColor="text-[#ee5d50]"
              value={formatNumber(reports.summary.out)}
              valueColor="text-[#ee5d50]"
              sub={`${reports.summary.txnsOut} Txns`}
            />
            <Kpi
              label="Net Movement"
              labelColor="text-[#4318ff]"
              value={`${reports.summary.net > 0 ? "+" : ""}${formatNumber(reports.summary.net)}`}
              valueColor={reports.summary.net >= 0 ? "text-[#05cd99]" : "text-[#ee5d50]"}
              sub="Net Units"
            />
            <Kpi
              label="Closing Stock"
              labelColor="text-[#2b3674]"
              value={formatNumber(reports.summary.closing)}
              valueColor="text-[#2b3674]"
              sub="Units"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard label="Total Products" value={reports.summary.totalProducts} icon={Package} />
            <StatCard label="Categories" value={reports.summary.categories} icon={LayoutGrid} />
            <StatCard
              label="Low Stock"
              value={reports.summary.lowStock}
              icon={AlertTriangle}
              tone={reports.summary.lowStock > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Out of Stock"
              value={reports.summary.outOfStock}
              icon={XCircle}
              tone={reports.summary.outOfStock > 0 ? "danger" : "default"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5 lg:col-span-1">
              <div className="border-b border-[#f4f7fe] bg-[#f4f7fe]/50 px-4 py-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2b3674]">
                  Top Moving Products
                </h3>
              </div>
              {reports.topMoving.length === 0 ? (
                <div className="py-12 text-center text-sm text-[#a3aed0]">
                  No sales in this period
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#f4f7fe]">
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-[#a3aed0]">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-wider text-[#a3aed0]">
                        Issued
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.topMoving.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-[#f4f7fe]/50 hover:bg-[#f4f7fe]/30"
                      >
                        <td className="px-4 py-3">
                          <div className="mb-1 text-xs font-bold leading-tight text-[#2b3674]">
                            {item.name}
                          </div>
                          <div className="text-[8px] font-black uppercase tracking-widest text-[#a3aed0]">
                            {item.sku ?? "NO SKU"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-black text-[#2b3674]">
                          {formatNumber(item.units)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5 lg:col-span-2">
              <div className="border-b border-[#f4f7fe] bg-[#f4f7fe]/50 px-4 py-4">
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2b3674]">
                  Day-by-Day Activity
                </h3>
              </div>
              <MobileCards className="max-h-[500px] overflow-y-auto">
                {reports.daily.map((day, index) => (
                  <MobileCard
                    key={index}
                    title={day.date}
                    fields={[
                      { label: "Stock IN", value: `+${formatNumber(day.in)}`, tone: "text-[#05cd99]" },
                      { label: "Stock OUT", value: `-${formatNumber(day.out)}`, tone: "text-[#ee5d50]" },
                      { label: "Net", value: `${day.net > 0 ? "+" : ""}${formatNumber(day.net)}`, tone: day.net >= 0 ? "text-[#05cd99]" : "text-[#ee5d50]" },
                      { label: "Closing", value: formatNumber(day.closing), tone: "text-[#4318ff]" },
                    ]}
                  />
                ))}
              </MobileCards>

              <div className="custom-scrollbar hidden max-h-[500px] overflow-y-auto md:block">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-[#f4f7fe]">
                      <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-[#a3aed0]">
                        Date
                      </th>
                      {["Stock IN", "Stock OUT", "Net", "Closing"].map((head) => (
                        <th
                          key={head}
                          className="px-4 py-3 text-right text-[9px] font-black uppercase tracking-wider text-[#a3aed0]"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reports.daily.map((day, index) => (
                      <tr
                        key={index}
                        className="border-b border-[#f4f7fe]/50 hover:bg-[#f4f7fe]/30"
                      >
                        <td className="px-4 py-3 text-[10px] font-bold text-[#a3aed0]">
                          {day.date}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-[#05cd99]">
                          +{formatNumber(day.in)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-bold text-[#ee5d50]">
                          -{formatNumber(day.out)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-right text-xs font-black",
                            day.net >= 0 ? "text-[#05cd99]" : "text-[#ee5d50]",
                          )}
                        >
                          {day.net > 0 ? "+" : ""}
                          {formatNumber(day.net)}
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-black text-[#2b3674]">
                          {formatNumber(day.closing)}
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

function Kpi({
  label,
  labelColor,
  value,
  valueColor,
  sub,
}: {
  label: string;
  labelColor: string;
  value: string;
  valueColor: string;
  sub: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#f4f7fe] bg-white p-5 shadow-sm">
      <p className={cn("mb-1 text-[10px] font-black uppercase tracking-[0.2em]", labelColor)}>
        {label}
      </p>
      <h3 className={cn("text-xl font-black", valueColor)}>{value}</h3>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#a3aed0]">{sub}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "text-[#ee5d50]"
      : tone === "warning"
        ? "text-[#ffb547]"
        : "text-[#2b3674]";

  return (
    <div className="rounded-[20px] bg-white p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#a3aed0]">{label}</p>
          <h3 className={cn("text-2xl font-bold tracking-tight", toneClass)}>
            {formatNumber(value)}
          </h3>
        </div>
        <div className="text-[#a3aed0]/40">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
