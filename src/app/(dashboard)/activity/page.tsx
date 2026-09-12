"use client";

import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Inbox,
  Loader2,
  Search,
  User,
} from "lucide-react";

import { useAsync, useDebounced } from "@/lib/hooks";
import { listActivity, type ActivityRow } from "@/lib/db/activity";
import { rangeFor } from "@/lib/range";
import { MobileCard, MobileCards } from "@/components/ui/DataCards";
import { cn, formatNumber } from "@/lib/utils";
import type { LedgerType } from "@/types";

const PAGE_SIZE = 25;

const TYPE_OPTIONS: Array<{ value: LedgerType | "all"; label: string }> = [
  { value: "all", label: "All Activities" },
  { value: "IN", label: "Stock IN" },
  { value: "OUT", label: "Stock OUT" },
];

const PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last-7-days", label: "Last 7 Days" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
];

function clockTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function dayStamp(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export default function DailyActivityPage() {
  const [preset, setPreset] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeFilter, setTypeFilter] = useState<LedgerType | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 300);
  const range = rangeFor(preset, from, to);

  const activity = useAsync(
    () =>
      listActivity({
        search: debouncedSearch,
        type: typeFilter,
        preset,
        from,
        to,
        page,
        pageSize: PAGE_SIZE,
      }),
    [debouncedSearch, typeFilter, preset, from, to, page],
  );

  const rows = activity.data?.rows ?? [];
  const total = activity.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">
            {range.label} Activity
          </h1>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#4318ff]">
            {range.details}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#f4f7fe] bg-white p-6">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3aed0]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by Product, SKU, Action..."
              className="h-10 w-full rounded-xl border-none bg-[#f4f7fe] pl-10 pr-3 text-xs text-[#2b3674] outline-none placeholder:text-[#a3aed0] focus:ring-2 focus:ring-[#4318ff]/20"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value as LedgerType | "all");
              setPage(1);
            }}
            className="h-10 w-[180px] rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={preset}
            onChange={(event) => {
              setPreset(event.target.value);
              setPage(1);
            }}
            className="h-10 w-[180px] rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
          >
            {PRESET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {preset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="h-10 rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none"
              />
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="h-10 rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none"
              />
            </div>
          )}
        </div>

        {activity.loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : activity.error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-[#ee5d50]">
            <span>{activity.error}</span>
            <button
              type="button"
              onClick={activity.reload}
              className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Inbox className="h-6 w-6" />
            No activity recorded for this period
          </div>
        ) : (
          <>
            <MobileCards>
              {rows.map((row) => (
                <ActivityCard key={row.id} row={row} />
              ))}
            </MobileCards>

            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f4f7fe]">
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Timestamp
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Action
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Product
                  </th>
                  <th className="px-4 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Qty Change
                  </th>
                  <th className="px-4 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Inventory
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Performed By
                  </th>
                  <th className="px-4 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ActivityTableRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f4f7fe] px-4 py-3 text-sm">
          <span className="text-[#a3aed0]">
            {formatNumber(total)} record{total === 1 ? "" : "s"} · page {page} of {pages}
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

function ActivityCard({ row }: { row: ActivityRow }) {
  const isIn = row.type === "IN";

  return (
    <MobileCard
      title={row.productName}
      subtitle={row.productSku ?? "NO SKU"}
      badge={
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold",
            isIn ? "bg-[#05cd99]/10 text-[#05cd99]" : "bg-[#ee5d50]/10 text-[#ee5d50]",
          )}
        >
          {isIn ? "STOCK IN" : "STOCK OUT"}
        </span>
      }
      fields={[
        { label: "Qty Change", value: `${row.unitsAffected > 0 ? "+" : ""}${formatNumber(row.unitsAffected)} units`, tone: isIn ? "text-[#05cd99]" : "text-[#ee5d50]" },
        { label: "Inventory", value: formatNumber(row.newInventory) },
        { label: "Action", value: row.actionLabel },
        { label: "Previous", value: formatNumber(row.prevInventory), tone: "text-[#a3aed0]" },
        ...(isIn && row.boxes !== 0
          ? [
              {
                label: "Packing",
                value: `${formatNumber(row.boxes)} boxes × ${row.unitsPerBox}`,
                tone: "text-[#a3aed0]",
                wide: true,
              },
            ]
          : []),
        { label: "Timestamp", value: `${clockTime(row.created_at)} · ${dayStamp(row.created_at)}`, tone: "text-[#a3aed0]", wide: true },
      ]}
    />
  );
}

function ActivityTableRow({ row }: { row: ActivityRow }) {
  const isIn = row.type === "IN";

  return (
    <tr className="border-b border-[#f4f7fe] transition-colors hover:bg-[#f4f7fe]/30">
      <td className="px-4 py-4">
        <div className="text-[10px] font-bold text-[#2b3674]">{clockTime(row.created_at)}</div>
        <div className="text-[9px] font-medium text-[#a3aed0]">{dayStamp(row.created_at)}</div>
      </td>

      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          {isIn ? (
            <ArrowUpRight className="h-4 w-4 text-[#05cd99]" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-[#ee5d50]" />
          )}
          <span className="text-xs font-bold text-[#2b3674]">{row.actionLabel}</span>
        </div>
        <div className="mt-1">
          <span
            className={cn(
              "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold",
              isIn ? "bg-[#05cd99]/10 text-[#05cd99]" : "bg-[#ee5d50]/10 text-[#ee5d50]",
            )}
          >
            {isIn ? "STOCK IN" : "STOCK OUT"}
          </span>
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="text-xs font-bold text-[#2b3674]">{row.productName}</div>
        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
          {row.productSku ?? "NO SKU"}
        </div>
      </td>

      <td className="px-4 py-4 text-right">
        {row.unitsAffected !== 0 ? (
          <div
            className={cn("text-xs font-black", isIn ? "text-[#05cd99]" : "text-[#ee5d50]")}
          >
            {row.unitsAffected > 0 ? "+" : ""}
            {formatNumber(row.unitsAffected)} units
          </div>
        ) : (
          <span className="text-xs text-[#a3aed0]">N/A</span>
        )}
        {isIn && row.boxes !== 0 && (
          <div className="text-[9px] font-bold text-[#a3aed0]">
            {formatNumber(row.boxes)} boxes × {row.unitsPerBox}
          </div>
        )}
      </td>

      <td className="px-4 py-4 text-right">
        <div className="text-xs font-bold text-[#2b3674]">{formatNumber(row.newInventory)}</div>
        <div className="text-[9px] font-medium text-[#a3aed0]">
          Prev: {formatNumber(row.prevInventory)}
        </div>
      </td>

      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f4f7fe]">
            <User className="h-3 w-3 text-[#2b3674]" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#2b3674]">System</div>
            <div className="text-[9px] text-[#a3aed0]">{row.reference ?? "—"}</div>
          </div>
        </div>
      </td>

      <td className="px-4 py-4 text-right" />
    </tr>
  );
}
