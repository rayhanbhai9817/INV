"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Inbox, Loader2, Search } from "lucide-react";

import { useAsync, useDebounced } from "@/lib/hooks";
import { getLedgerFeed, type LedgerFeedRow } from "@/lib/db/ledger";
import { allProducts } from "@/lib/db/products";
import { rangeFor } from "@/lib/range";
import { cn, downloadCsv, formatDateTime, formatNumber, toCsv } from "@/lib/utils";
import type { LedgerType, Product } from "@/types";

const PAGE_SIZE = 20;

const PERIODS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "this-week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "prev-month", label: "Previous Month" },
  { value: "last-30-days", label: "Last 30 Days" },
  { value: "this-year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

export default function StockLedgerPage() {
  return (
    <Suspense fallback={null}>
      <LedgerView />
    </Suspense>
  );
}

function LedgerView() {
  const searchParams = useSearchParams();

  const [type, setType] = useState<LedgerType | "all">("all");
  const [productId, setProductId] = useState(searchParams.get("product") ?? "all");
  const [preset, setPreset] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 300);
  const range = rangeFor(preset, from, to);

  const products = useAsync(() => allProducts(), []);
  const feed = useAsync(() => getLedgerFeed(), []);
  const allRows = useMemo(() => feed.data ?? [], [feed.data]);

  const fromTime = new Date(range.from).getTime();
  const toTime = new Date(range.to).getTime();

  /** Rows matching every filter except the date window. */
  const scoped = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return allRows.filter((row) => {
      if (type !== "all" && row.type !== type) return false;
      if (productId !== "all" && row.productId !== productId) return false;
      if (!term) return true;
      return (
        row.productName.toLowerCase().includes(term) ||
        (row.productSku ?? "").toLowerCase().includes(term) ||
        (row.reference ?? "").toLowerCase().includes(term)
      );
    });
  }, [allRows, type, productId, debouncedSearch]);

  const inRange = useMemo(
    () =>
      scoped.filter((row) => {
        const at = new Date(row.occurredAt).getTime();
        return at >= fromTime && at <= toTime;
      }),
    [scoped, fromTime, toTime],
  );

  /** Balances carried into the window, converted to boxes per product. */
  const opening = useMemo(() => {
    const perProduct = new Map<string, { units: number; perBox: number }>();
    scoped
      .filter((row) => new Date(row.occurredAt).getTime() < fromTime)
      .forEach((row) => {
        perProduct.set(row.productId, { units: row.newUnits, perBox: row.unitsPerBox });
      });

    let units = 0;
    let boxes = 0;
    perProduct.forEach((entry) => {
      units += entry.units;
      boxes += entry.perBox > 0 ? Math.floor(entry.units / entry.perBox) : 0;
    });
    return { units, boxes };
  }, [scoped, fromTime]);

  const summary = useMemo(
    () =>
      inRange.reduce(
        (acc, row) => {
          if (row.type === "IN") {
            acc.totalInUnits += row.unitsDelta;
            acc.totalInBoxes += Math.max(0, row.boxesDelta);
          } else {
            acc.totalOutUnits += Math.abs(row.unitsDelta);
            acc.totalOutBoxes += Math.abs(Math.min(0, row.boxesDelta));
          }
          return acc;
        },
        { totalInUnits: 0, totalOutUnits: 0, totalInBoxes: 0, totalOutBoxes: 0 },
      ),
    [inRange],
  );

  const netUnits = summary.totalInUnits - summary.totalOutUnits;
  const netBoxes = summary.totalInBoxes - summary.totalOutBoxes;
  const closingUnits = opening.units + netUnits;
  const closingBoxes = opening.boxes + netBoxes;

  const sorted = useMemo(
    () =>
      [...inRange].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      ),
    [inRange],
  );
  const pageRows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

  function exportCsv() {
    downloadCsv(
      "ozipco-stock-ledger.csv",
      toCsv(
        [
          "Date",
          "Type",
          "Product",
          "SKU",
          "Prev Bal (Boxes)",
          "Boxes +/-",
          "New Bal (Boxes)",
          "Units/Box",
          "Prev Bal (Units)",
          "Units +/-",
          "New Bal (Units)",
          "Note / Reason",
        ],
        sorted.map((row) => [
          formatDateTime(row.occurredAt),
          row.type === "IN" ? "STOCK IN" : "STOCK OUT",
          row.productName,
          row.productSku ?? "",
          row.prevBoxes,
          row.boxesDelta,
          row.newBoxes,
          row.unitsPerBox,
          row.prevUnits,
          row.unitsDelta,
          row.newUnits,
          row.reference ?? "",
        ]),
      ),
    );
  }

  const selectClass =
    "h-10 rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">
            {range.label} Ledger
          </h1>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#4318ff]">
            {range.details}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={sorted.length === 0}
            className="flex h-11 items-center rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674] shadow-sm transition hover:bg-[#f4f7fe] disabled:opacity-50"
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard
          label="Opening Stock"
          labelColor="text-[#a3aed0]"
          value={formatNumber(opening.units)}
          valueColor="text-[#2b3674]"
          sub={`${formatNumber(opening.boxes)} Boxes`}
        />
        <SummaryCard
          label="Total Stock IN (+)"
          labelColor="text-[#05cd99]"
          value={formatNumber(summary.totalInUnits)}
          valueColor="text-[#05cd99]"
          sub={`${formatNumber(summary.totalInBoxes)} Boxes`}
        />
        <SummaryCard
          label="Total Stock OUT (-)"
          labelColor="text-[#ee5d50]"
          value={formatNumber(summary.totalOutUnits)}
          valueColor="text-[#ee5d50]"
          sub={`${formatNumber(summary.totalOutBoxes)} Boxes`}
        />
        <SummaryCard
          label="Net Movement"
          labelColor="text-[#4318ff]"
          value={`${netUnits > 0 ? "+" : ""}${formatNumber(netUnits)}`}
          valueColor={netUnits >= 0 ? "text-[#05cd99]" : "text-[#ee5d50]"}
          sub={`${netBoxes > 0 ? "+" : ""}${formatNumber(netBoxes)} Boxes`}
        />
        <SummaryCard
          label="Closing Stock"
          labelColor="text-[#2b3674]"
          value={formatNumber(closingUnits)}
          valueColor="text-[#2b3674]"
          sub={`${formatNumber(closingBoxes)} Boxes`}
        />
      </div>

      <div className="mb-8 overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#f4f7fe] bg-white p-6">
          <div className="relative w-full md:w-[300px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a3aed0]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search Name, SKU, or ID..."
              className="h-10 w-full rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] pl-9 pr-3 text-xs text-[#2b3674] outline-none placeholder:text-[#a3aed0] focus:ring-2 focus:ring-[#4318ff]/20"
            />
          </div>

          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as LedgerType | "all");
              setPage(1);
            }}
            className={cn(selectClass, "w-[140px]")}
          >
            <option value="all">All Types</option>
            <option value="IN">Stock IN</option>
            <option value="OUT">Stock OUT</option>
          </select>

          <select
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setPage(1);
            }}
            className={cn(selectClass, "w-[220px]")}
          >
            <option value="all">All Products</option>
            {(products.data ?? []).map((product: Product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>

          <select
            value={preset}
            onChange={(event) => {
              setPreset(event.target.value);
              setPage(1);
            }}
            className={cn(selectClass, "w-[180px]")}
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
                className={cn(selectClass, "w-[140px]")}
              />
              <span className="text-[#a3aed0]/50">—</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className={cn(selectClass, "w-[140px]")}
              />
            </div>
          )}
        </div>

        {feed.loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : feed.error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-[#ee5d50]">
            <span>{feed.error}</span>
            <button
              type="button"
              onClick={feed.reload}
              className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
            >
              Try again
            </button>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Inbox className="h-6 w-6" />
            No transactions in this range
          </div>
        ) : (
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[1280px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f4f7fe]">
                  <Th>Date</Th>
                  <Th>Type</Th>
                  <Th>Product</Th>
                  <Th align="right">Prev Bal (Boxes)</Th>
                  <Th align="right">Boxes +/-</Th>
                  <Th align="right">New Bal (Boxes)</Th>
                  <Th align="right">Units / Box</Th>
                  <Th align="right">Prev Bal (Units)</Th>
                  <Th align="right">Units +/-</Th>
                  <Th align="right">New Bal (Units)</Th>
                  <Th>Note / Reason</Th>
                  <Th>Admin</Th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <LedgerRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e0e5f2] px-4 py-3 text-sm">
          <span className="text-[#a3aed0]">
            {formatNumber(sorted.length)} record{sorted.length === 1 ? "" : "s"} · page {page} of{" "}
            {pages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-[#e0e5f2] px-3 py-1.5 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe] disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-[#e0e5f2] px-3 py-1.5 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ row }: { row: LedgerFeedRow }) {
  const isIn = row.type === "IN";

  return (
    <tr className="border-b border-[#f4f7fe] transition-colors hover:bg-[#f4f7fe]/30">
      <td className="whitespace-nowrap px-4 py-4 text-[10px] font-bold text-[#a3aed0]">
        {formatDateTime(row.occurredAt)}
      </td>

      <td className="px-4 py-4">
        <span
          className={cn(
            "inline-flex items-center rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]",
            isIn ? "bg-[#05cd99]/10 text-[#05cd99]" : "bg-[#ffb547]/10 text-[#ffb547]",
          )}
        >
          {isIn ? "+STOCK IN" : "-STOCK OUT"}
        </span>
      </td>

      <td className="px-4 py-4">
        <div className="mb-1.5 max-w-[180px] truncate text-sm font-bold leading-none text-[#2b3674]">
          {row.productName}
        </div>
        {row.productSku && (
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
            {row.productSku}
          </div>
        )}
      </td>

      <td className="px-4 py-4 text-right text-sm font-black text-[#a3aed0]">
        {formatNumber(row.prevBoxes)}
      </td>
      <td
        className={cn(
          "px-4 py-4 text-right text-sm font-black",
          isIn ? "text-[#05cd99]" : "text-[#ee5d50]",
        )}
      >
        {row.boxesDelta > 0 ? "+" : ""}
        {formatNumber(row.boxesDelta)}
      </td>
      <td className="px-4 py-4 text-right text-sm font-black text-[#2b3674]">
        {formatNumber(row.newBoxes)}
      </td>
      <td className="px-4 py-4 text-right text-sm font-black text-[#a3aed0]">
        {formatNumber(row.unitsPerBox)}
      </td>
      <td className="px-4 py-4 text-right text-sm font-black text-[#a3aed0]">
        {formatNumber(row.prevUnits)}
      </td>
      <td
        className={cn(
          "px-4 py-4 text-right text-sm font-black",
          isIn ? "text-[#05cd99]" : "text-[#ee5d50]",
        )}
      >
        {row.unitsDelta > 0 ? "+" : ""}
        {formatNumber(row.unitsDelta)}
      </td>
      <td className="px-4 py-4 text-right text-sm font-black text-[#2b3674]">
        {formatNumber(row.newUnits)}
      </td>

      <td className="px-4 py-4">
        <div className="max-w-[200px]">
          {row.reference && (
            <p className="truncate text-[10px] font-bold leading-tight text-[#2b3674]">
              {row.reference}
            </p>
          )}
          {row.batchId && (
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.2em] text-[#4318ff]">
              FIFO Batch: {row.batchId.split("-")[0]}
            </p>
          )}
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="mb-1 text-[10px] font-black uppercase leading-none tracking-wider text-[#2b3674]">
            —
          </span>
        </div>
      </td>
    </tr>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
  );
}

function SummaryCard({
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
      <h3 className={cn("text-xl font-black", valueColor)}>
        {value} <span className="text-[10px] text-[#a3aed0]">Units</span>
      </h3>
      <p className="text-[10px] font-bold text-[#a3aed0]">{sub}</p>
    </div>
  );
}
