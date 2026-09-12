"use client";

import { useState } from "react";
import { ChevronDown, Inbox, Search } from "lucide-react";
import { Panel } from "@/components/ui/StatTile";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAsync, useDebounced } from "@/lib/hooks";
import { listActivity, type ActivityWindow } from "@/lib/db/activity";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { cn, formatNumber } from "@/lib/utils";
import type { LedgerType } from "@/types";

const WINDOWS: Array<{ value: ActivityWindow; label: string }> = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

const ACTIVITIES: Array<{ value: LedgerType | ""; label: string }> = [
  { value: "", label: "All Activities" },
  { value: "IN", label: "Stock In" },
  { value: "OUT", label: "Stock Out" },
];

function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00`)
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();
}

function clockTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DailyActivityPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<LedgerType | "">("");
  const [window, setWindow] = useState<ActivityWindow>("today");
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebounced(search, 300);

  const activity = useAsync(
    () =>
      listActivity({
        search: debouncedSearch,
        type,
        window,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      }),
    [debouncedSearch, type, window, page],
  );

  const rows = activity.data?.rows ?? [];
  const total = activity.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));
  const heading = WINDOWS.find((item) => item.value === window)?.label ?? "Today";

  return (
    <div className="space-y-5">
      {/* ------------------------------ Header ----------------------------- */}
      <Panel className="py-7">
        <h2 className="font-serif text-[30px] font-bold leading-tight tracking-tight text-navy-800">
          {window === "today" ? "Today Activity" : `${heading} Activity`}
        </h2>
        <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">
          {longDate(new Date().toISOString().slice(0, 10))}
        </p>
      </Panel>

      {/* ------------------------------- Feed ------------------------------ */}
      <Panel className="p-0">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-300"
            />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by Product, SKU, Action…"
              className="w-full rounded-xl bg-canvas py-3 pl-10 pr-3 text-sm text-navy-800 outline-none transition placeholder:text-navy-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <SelectPill
            value={type}
            onChange={(value) => {
              setType(value as LedgerType | "");
              setPage(1);
            }}
            options={ACTIVITIES}
          />
          <SelectPill
            value={window}
            onChange={(value) => {
              setWindow(value as ActivityWindow);
              setPage(1);
            }}
            options={WINDOWS}
          />
        </div>

        {activity.loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : activity.error ? (
          <ErrorState message={activity.error} onRetry={activity.reload} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <Inbox size={26} className="text-navy-200" strokeWidth={1.5} />
            <p className="mt-3 text-sm text-navy-300">No activity recorded for this period</p>
          </div>
        ) : (
          <ul className="divide-y divide-navy-200/40">
            {rows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span
                  className={cn(
                    "w-[74px] shrink-0 rounded-full px-2.5 py-1 text-center text-[10px] font-bold uppercase tracking-[0.1em]",
                    row.type === "IN"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-rose-50 text-rose-600",
                  )}
                >
                  {row.type === "IN" ? "Stock In" : "Stock Out"}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-sm font-bold text-navy-800">
                    {row.product?.name ?? "Deleted product"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-navy-300">
                    {row.product?.sku ? `SKU ${row.product.sku}` : "No SKU"}
                    {row.batch?.batch_date && ` · Batch ${row.batch.batch_date}`}
                    {row.reference && ` · ${row.reference}`}
                  </p>
                </div>

                <p
                  className={cn(
                    "shrink-0 font-serif text-sm font-bold tabular-nums",
                    row.type === "IN" ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {row.type === "IN" ? "+" : "−"}
                  {formatNumber(row.qty)}{" "}
                  <span className="text-[11px] font-semibold text-navy-300">
                    {row.product?.unit ?? "units"}
                  </span>
                </p>

                <p className="w-16 shrink-0 text-right text-[11px] text-navy-300">
                  {clockTime(row.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-navy-200/40 px-5 py-3.5">
          <p className="text-[11px] text-navy-300">
            {formatNumber(total)} records · page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
              className="rounded-xl bg-canvas px-4 py-2 text-[11px] font-semibold text-navy-500 transition hover:text-navy-800 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
              className="rounded-xl bg-canvas px-4 py-2 text-[11px] font-semibold text-navy-500 transition hover:text-navy-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/** Pill-shaped native select used by the filter row. */
function SelectPill({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="appearance-none rounded-xl bg-canvas py-3 pl-4 pr-10 text-xs font-medium text-navy-700 outline-none transition focus:ring-2 focus:ring-indigo-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-navy-300"
      />
    </div>
  );
}
