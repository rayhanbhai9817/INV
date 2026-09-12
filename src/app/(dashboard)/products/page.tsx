"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, Eye, Pencil, Plus, Search, X } from "lucide-react";
import { Panel } from "@/components/ui/StatTile";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { useAsync, useDebounced } from "@/lib/hooks";
import { allCategories } from "@/lib/db/categories";
import { deleteProduct, getStockRollups, listProducts } from "@/lib/db/products";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import { cn, downloadCsv, formatNumber, toCsv } from "@/lib/utils";
import type { ProductStockRollup, ProductWithRelations } from "@/types";

type Tab = "active" | "archived" | "trashed";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "active", label: "Active" },
  { key: "archived", label: "Archived" },
  { key: "trashed", label: "Trashed" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "ok", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

export default function ProductsPage() {
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>("active");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<ProductWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);

  const debouncedSearch = useDebounced(search, 300);
  const categories = useAsync(() => allCategories(), []);

  const products = useAsync(async () => {
    const result = await listProducts({
      search: debouncedSearch,
      categoryId,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    });
    const rollups = await getStockRollups(result.rows.map((row) => row.id));
    return { ...result, rollups };
  }, [debouncedSearch, categoryId, page]);

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteProduct(pendingDelete.id);
      toast.success(`“${pendingDelete.name}” deleted.`);
      setPendingDelete(null);
      products.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  const emptyRollup: ProductStockRollup = { boxes: 0, loose: 0, total: 0 };
  const rollupFor = (id: string) => products.data?.rollups[id] ?? emptyRollup;

  const rows = (products.data?.rows ?? []).filter((product) => {
    if (!status) return true;
    const total = rollupFor(product.id).total;
    if (status === "out_of_stock") return total === 0;
    if (status === "low_stock") return total > 0 && total <= product.min_stock;
    return total > product.min_stock;
  });

  const total = products.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  function handleExport() {
    downloadCsv(
      "products.csv",
      toCsv(
        ["SKU", "Product", "Category", "Supplier", "Unit", "Min stock", "Boxes", "Loose", "Total"],
        rows.map((product) => {
          const rollup = rollupFor(product.id);
          return [
            product.sku ?? "",
            product.name,
            product.category?.name ?? "",
            product.supplier?.name ?? "",
            product.unit,
            product.min_stock,
            rollup.boxes,
            rollup.loose,
            rollup.total,
          ];
        }),
      ),
    );
    toast.success("Products exported.");
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------ Header ----------------------------- */}
      <Panel className="flex flex-wrap items-center justify-between gap-4 py-6">
        <div>
          <h2 className="font-serif text-[30px] font-bold leading-tight tracking-tight text-navy-800">
            Catalogue Management
          </h2>
          <p className="mt-1.5 text-[13px] text-navy-300">
            Master product directory for inventory identification.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={rows.length === 0}
            className="flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-[13px] font-semibold text-navy-800 ring-1 ring-navy-200/60 transition hover:bg-canvas disabled:opacity-50"
          >
            <Download size={15} />
            Export CSV
          </button>
          <Link
            href="/products/new"
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-[13px] font-bold text-white shadow-sm shadow-indigo-600/25 transition hover:bg-indigo-700"
          >
            <Plus size={15} />
            Add Product
          </Link>
        </div>
      </Panel>

      {/* ------------------------------- Tabs ------------------------------ */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-xl px-6 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition",
              tab === item.key
                ? "bg-white text-navy-800 shadow-[0_1px_2px_rgba(16,24,64,0.06)] ring-1 ring-navy-200/50"
                : "text-navy-300 hover:text-navy-700",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ------------------------------ Table ------------------------------ */}
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
              placeholder="Filter by name or SKU"
              className="w-full rounded-xl bg-canvas py-3 pl-10 pr-3 text-sm text-navy-800 outline-none transition placeholder:text-navy-300 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <SelectPill
            value={categoryId}
            onChange={(value) => {
              setCategoryId(value);
              setPage(1);
            }}
            options={[
              { value: "", label: "All categories" },
              ...(categories.data ?? []).map((category) => ({
                value: category.id,
                label: category.name,
              })),
            ]}
          />
          <SelectPill value={status} onChange={setStatus} options={STATUSES} />
        </div>

        {tab !== "active" ? (
          <div className="px-6 py-20 text-center">
            <p className="font-serif text-sm font-bold text-navy-800">
              {tab === "archived" ? "No archived products" : "Nothing in the trash"}
            </p>
            <p className="mx-auto mt-2 max-w-md text-[12px] text-navy-300">
              Archiving needs a status column on the products table, which the schema does not have
              yet. Say the word and I will add it.
            </p>
          </div>
        ) : products.loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : products.error ? (
          <ErrorState message={products.error} onRetry={products.reload} />
        ) : rows.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <p className="font-serif text-sm font-bold text-navy-800">No products found</p>
            <p className="mt-2 text-[12px] text-navy-300">
              {search || categoryId || status
                ? "No product matches the current filters."
                : "Add your first product to start tracking stock."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse">
              <thead>
                <tr className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-300">
                  <th className="px-5 py-3 text-left font-semibold">Img</th>
                  <th className="px-2 py-3 text-left font-semibold">SKU</th>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Boxes</th>
                  <th className="px-4 py-3 text-right font-semibold">Loose Units</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Units</th>
                  <th className="px-5 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-200/40">
                {rows.map((product) => {
                  const rollup = rollupFor(product.id);
                  return (
                    <tr key={product.id} className="transition hover:bg-canvas/60">
                      <td className="px-5 py-4">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-canvas text-[9px] font-semibold uppercase tracking-wider text-navy-300">
                          N/A
                        </span>
                      </td>
                      <td className="px-2 py-4 text-[11px] font-medium text-navy-500">
                        {product.sku ?? "—"}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/products/${product.id}`}
                          className="font-serif text-[13.5px] font-bold text-navy-800 transition hover:text-indigo-600"
                        >
                          {product.name}
                        </Link>
                        <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-navy-300">
                          {product.category?.name ?? "Uncategorised"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-[12px] text-navy-300">—</td>
                      <td className="px-4 py-4 text-right font-serif text-[13px] font-bold tabular-nums text-navy-800">
                        {formatNumber(rollup.boxes)}
                      </td>
                      <td className="px-4 py-4 text-right font-serif text-[13px] font-bold tabular-nums text-navy-500">
                        {formatNumber(rollup.loose)}
                      </td>
                      <td className="px-4 py-4 text-right font-serif text-[13px] font-bold tabular-nums text-indigo-600">
                        {formatNumber(rollup.total)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <RowAction
                            label="View"
                            onClick={() => router.push(`/products/${product.id}`)}
                          >
                            <Eye size={15} />
                          </RowAction>
                          <RowAction
                            label="Edit"
                            onClick={() => router.push(`/products/${product.id}`)}
                          >
                            <Pencil size={15} />
                          </RowAction>
                          <RowAction
                            label="Delete"
                            tone="danger"
                            onClick={() => setPendingDelete(product)}
                          >
                            <X size={15} />
                          </RowAction>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete product"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Delete <strong>{pendingDelete?.name}</strong>? Products with recorded stock movements
            cannot be deleted — their ledger history must stay intact.
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

function RowAction({
  label,
  onClick,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-lg p-2 transition",
        tone === "danger"
          ? "text-rose-400 hover:bg-rose-50 hover:text-rose-600"
          : "text-navy-300 hover:bg-canvas hover:text-navy-700",
      )}
    >
      {children}
    </button>
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
