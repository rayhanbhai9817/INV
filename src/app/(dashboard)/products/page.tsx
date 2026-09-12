"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Download,
  Eye,
  Loader2,
  Inbox,
  Package,
  Pencil,
  Plus,
  Search,
  TrendingUp,
  Weight,
} from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/lib/hooks";
import { allCategories } from "@/lib/db/categories";
import {
  allProducts,
  createProduct,
  deleteProduct,
  getPackaging,
  getProductHistory,
  getStockRollups,
  updateProduct,
  type ProductHistoryRow,
  type ProductInput,
} from "@/lib/db/products";
import { errorMessage } from "@/lib/supabase";
import { stockStatusLabel, type StockStatusLabel } from "@/lib/range";
import { MobileCard, MobileCards } from "@/components/ui/DataCards";
import { cn, downloadCsv, formatNumber, toCsv } from "@/lib/utils";
import type { Category, Product, ProductStockRollup } from "@/types";

const PAGE_SIZE = 10;

type StatusTab = "ACTIVE" | "ARCHIVED" | "TRASHED";

interface FormState {
  sku: string;
  name: string;
  category_id: string;
  low_stock_threshold_units: number;
}

const blank: FormState = {
  sku: "",
  name: "",
  category_id: "none",
  low_stock_threshold_units: 100,
};

const STATUS_CLASSES: Record<StockStatusLabel, string> = {
  "OUT OF STOCK": "bg-[#B60117]/5 text-[#B60117] border border-[#B60117]/10",
  "LOW STOCK": "bg-[#ffb547]/5 text-[#ffb547] border border-[#ffb547]/10",
  "IN STOCK": "bg-[#05cd99]/5 text-[#05cd99] border border-[#05cd99]/10",
};

export default function ProductsPage() {
  const toast = useToast();

  const [statusTab, setStatusTab] = useState<StatusTab>("ACTIVE");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [removing, setRemoving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const categories = useAsync(() => allCategories(), []);
  const catalogue = useAsync(async () => {
    const rows = await allProducts();
    const rollups = await getStockRollups(rows.map((row) => row.id));
    return { rows, rollups };
  }, [reloadKey]);

  const products = useMemo(() => catalogue.data?.rows ?? [], [catalogue.data]);
  const rollups = catalogue.data?.rollups ?? {};
  const emptyRollup: ProductStockRollup = { boxes: 0, loose: 0, total: 0 };
  const rollupFor = (id: string) => rollups[id] ?? emptyRollup;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (term && !`${product.name} ${product.sku ?? ""}`.toLowerCase().includes(term)) {
        return false;
      }
      if (categoryFilter !== "all" && product.category_id !== categoryFilter) return false;
      if (
        statusFilter !== "all" &&
        stockStatusLabel(rollups[product.id]?.total ?? 0, product.min_stock) !== statusFilter
      ) {
        return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, catalogue.data, search, categoryFilter, statusFilter]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const categoryName = (id: string | null) =>
    (categories.data ?? []).find((category: Category) => category.id === id)?.name ?? null;

  function openCreate() {
    setEditing(null);
    setForm(blank);
    setOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      sku: product.sku ?? "",
      name: product.name,
      category_id: product.category_id ?? "none",
      low_stock_threshold_units: product.min_stock ?? 100,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (form.low_stock_threshold_units < 0) {
      toast.error("Threshold must be non-negative");
      return;
    }

    setSaving(true);
    try {
      const payload: ProductInput = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        category_id: form.category_id === "none" ? null : form.category_id,
        supplier_id: editing?.supplier_id ?? null,
        unit: editing?.unit ?? "pcs",
        min_stock: form.low_stock_threshold_units,
      };

      if (editing) {
        await updateProduct(editing.id, payload);
        toast.success("Product updated");
      } else {
        await createProduct(payload);
        toast.success("Product created");
      }

      setOpen(false);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setRemoving(true);
    try {
      await deleteProduct(deleting.id);
      toast.success("Product permanently deleted");
      setDeleting(null);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setRemoving(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      "ozipco-products.csv",
      toCsv(
        ["SKU", "Name", "Category", "Boxes", "Units", "Total units", "Status"],
        filtered.map((product) => {
          const rollup = rollupFor(product.id);
          return [
            product.sku ?? "",
            product.name,
            categoryName(product.category_id) ?? "",
            rollup.boxes,
            rollup.loose,
            rollup.total,
            stockStatusLabel(rollup.total, product.min_stock),
          ];
        }),
      ),
    );
  }

  return (
    <div className="space-y-[30px]">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">
            Catalogue Management
          </h1>
          <p className="text-sm font-medium text-[#a3aed0]">
            Master product directory for inventory identification.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            className="flex h-11 items-center rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674] shadow-sm transition hover:bg-[#f4f7fe]"
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-11 items-center rounded-2xl bg-[#4318ff] px-6 text-sm font-bold text-white shadow-xl shadow-[#4318ff]/20 transition hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      <div className="flex w-fit gap-2 rounded-2xl bg-[#f4f7fe] p-1">
        {(["ACTIVE", "ARCHIVED", "TRASHED"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setStatusTab(tab);
              setPage(1);
            }}
            className={cn(
              "rounded-xl px-6 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
              statusTab === tab
                ? "bg-white text-[#2b3674] shadow-sm"
                : "text-[#a3aed0] hover:text-[#2b3674]",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mb-8 overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#f4f7fe] bg-white p-6">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a3aed0]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              maxLength={80}
              placeholder="Filter by name or SKU"
              className="h-10 w-full rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] pl-9 pr-3 text-xs text-[#2b3674] outline-none placeholder:text-[#a3aed0] focus:ring-2 focus:ring-[#4318ff]/20"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 w-[180px] rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
          >
            <option value="all">All categories</option>
            {(categories.data ?? []).map((category: Category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
            className="h-10 w-[180px] rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
          >
            <option value="all">All statuses</option>
            <option value="IN STOCK">In stock</option>
            <option value="LOW STOCK">Low stock</option>
            <option value="OUT OF STOCK">Out of stock</option>
          </select>
        </div>

        {statusTab !== "ACTIVE" ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-sm text-[#a3aed0]">
            <Archive className="h-6 w-6" />
            {statusTab === "ARCHIVED" ? "No archived products" : "Nothing in the trash"}
            <span className="max-w-md text-center text-xs">
              Product lifecycle needs a status column on the products table, which the schema does
              not carry yet.
            </span>
          </div>
        ) : catalogue.loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : catalogue.error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-[#ee5d50]">
            <span>{catalogue.error}</span>
            <button
              type="button"
              onClick={catalogue.reload}
              className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
            >
              Try again
            </button>
          </div>
        ) : pageRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Inbox className="h-6 w-6" />
            No products match the current filters
          </div>
        ) : (
          <>
            <MobileCards>
              {pageRows.map((product) => {
                const rollup = rollupFor(product.id);
                return (
                  <MobileCard
                    key={product.id}
                    title={product.name}
                    subtitle={`${product.sku ?? "NO SKU"} · ${categoryName(product.category_id) ?? "Uncategorised"}`}
                    fields={[
                      { label: "Total Units", value: formatNumber(rollup.total), tone: "text-[#4318ff]" },
                      { label: "Boxes", value: formatNumber(rollup.boxes) },
                      { label: "Loose Units", value: formatNumber(rollup.loose) },
                      { label: "Min Stock", value: formatNumber(product.min_stock), tone: "text-[#a3aed0]" },
                    ]}
                    actions={
                      <>
                        <IconButton
                          label="View details & History"
                          onClick={() => setViewing(product)}
                        >
                          <Eye className="h-4 w-4" />
                        </IconButton>
                        <IconButton label="Edit product" onClick={() => openEdit(product)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Delete product"
                          tone="danger"
                          onClick={() => setDeleting(product)}
                        >
                          <Plus className="h-4 w-4 rotate-45" />
                        </IconButton>
                      </>
                    }
                  />
                );
              })}
            </MobileCards>

            <div className="custom-scrollbar hidden overflow-x-auto md:block">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f4f7fe]">
                  <th className="w-16 px-4 py-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Img
                  </th>
                  <th className="w-32 px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    SKU
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Product
                  </th>
                  <th className="px-4 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Description
                  </th>
                  <th className="px-4 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Boxes
                  </th>
                  <th className="px-4 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Loose Units
                  </th>
                  <th className="px-4 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Total Units
                  </th>
                  <th className="px-4 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((product) => {
                  const rollup = rollupFor(product.id);
                  return (
                    <tr
                      key={product.id}
                      className="group border-b border-[#f4f7fe] transition-colors hover:bg-[#f4f7fe]/30"
                    >
                      <td className="px-4 py-4">
                        <div className="flex justify-center">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f7fe] text-[9px] font-black uppercase tracking-widest text-[#a3aed0] shadow-sm">
                            N/A
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-[10px] font-bold tracking-tight text-[#a3aed0]">
                        {product.sku ?? "—"}
                      </td>
                      <td className="max-w-[200px] px-4 py-4">
                        <div className="mb-1 truncate text-sm font-bold leading-none text-[#2b3674]">
                          {product.name}
                        </div>
                        {categoryName(product.category_id) && (
                          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                            {categoryName(product.category_id)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <p className="max-w-[200px] truncate text-xs text-[#a3aed0]">—</p>
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-bold text-[#2b3674]">
                        {formatNumber(rollup.boxes)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-bold text-[#2b3674]">
                        {formatNumber(rollup.loose)}
                      </td>
                      <td className="px-4 py-4 text-right text-sm font-black text-[#4318ff]">
                        {formatNumber(rollup.total)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <IconButton
                            label="View details & History"
                            onClick={() => setViewing(product)}
                          >
                            <Eye className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Edit product" onClick={() => openEdit(product)}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            label="Delete product"
                            tone="danger"
                            onClick={() => setDeleting(product)}
                          >
                            <Plus className="h-4 w-4 rotate-45" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e0e5f2] px-4 py-3 text-sm">
          <span className="text-[#a3aed0]">
            {formatNumber(filtered.length)} record{filtered.length === 1 ? "" : "s"} · page {page} of{" "}
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

      {open && (
        <Overlay onClose={() => setOpen(false)} width="max-w-2xl">
          <h2 className="text-lg font-black text-[#2b3674]">
            {editing ? "Edit product" : "Add product"}
          </h2>

          <div className="space-y-6 py-4">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="PRODUCT NAME">
                <input
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="Enter product name"
                  className="h-12 w-full rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-sm text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
                />
              </Field>
              <Field label="SKU">
                <input
                  value={form.sku}
                  onChange={(event) => setForm({ ...form, sku: event.target.value })}
                  placeholder="Enter unique SKU"
                  className="h-12 w-full rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-sm text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
                />
              </Field>
              <Field label="LOW STOCK THRESHOLD (UNITS)">
                <input
                  type="number"
                  min={0}
                  value={form.low_stock_threshold_units}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      low_stock_threshold_units: Number(event.target.value) || 0,
                    })
                  }
                  placeholder="Min. Units for Alert"
                  className="h-12 w-full rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-sm text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
                />
              </Field>
            </div>

            <Field label="CATEGORY">
              <select
                value={form.category_id}
                onChange={(event) => setForm({ ...form, category_id: event.target.value })}
                className="h-12 w-full rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-sm text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
              >
                <option value="none">No category</option>
                {(categories.data ?? []).map((category: Category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-11 rounded-2xl bg-[#4318ff] px-6 text-sm font-bold text-white shadow-xl shadow-[#4318ff]/20 transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Product"}
            </button>
          </div>
        </Overlay>
      )}

      {deleting && (
        <Overlay onClose={() => setDeleting(null)} width="max-w-lg">
          <h2 className="text-lg font-black text-[#2b3674]">Delete Product</h2>
          <div className="space-y-4 py-2">
            <div className="space-y-2 rounded-lg bg-[#f4f7fe] p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-[#a3aed0]">Product:</span>
                <span className="font-bold text-[#2b3674]">{deleting.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#a3aed0]">SKU:</span>
                <span className="font-mono font-bold text-[#2b3674]">{deleting.sku ?? "—"}</span>
              </div>
              <div className="flex justify-between border-t border-[#e0e5f2] pt-2">
                <span className="text-[#a3aed0]">Current Stock:</span>
                <span
                  className={cn(
                    "font-bold text-[#2b3674]",
                    rollupFor(deleting.id).total > 0 && "text-[#ffb547]",
                  )}
                >
                  {formatNumber(rollupFor(deleting.id).total)} units
                </span>
              </div>
            </div>

            {rollupFor(deleting.id).total > 0 ? (
              <div className="rounded-md border border-[#ee5d50]/20 bg-[#ee5d50]/10 p-3 text-xs font-medium text-[#ee5d50]">
                Cannot delete this product while inventory exists. Please adjust stock to zero
                first.
              </div>
            ) : (
              <p className="text-sm text-[#a3aed0]">
                Are you sure you want to delete this product? Products with recorded movements keep
                their ledger history and cannot be removed.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="h-11 rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={rollupFor(deleting.id).total > 0 || removing}
                onClick={confirmDelete}
                className="h-11 rounded-2xl bg-[#ee5d50] px-6 text-sm font-bold text-white transition hover:bg-[#d94b3f] disabled:opacity-50"
              >
                {removing ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {viewing && (
        <ProductDetail
          product={viewing}
          categoryName={categoryName(viewing.category_id)}
          rollup={rollupFor(viewing.id)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}

function ProductDetail({
  product,
  categoryName,
  rollup,
  onClose,
}: {
  product: Product;
  categoryName: string | null;
  rollup: ProductStockRollup;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<ProductHistoryRow[] | null>(null);
  const [packaging, setPackaging] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    Promise.all([getProductHistory(product.id), getPackaging(product.id)])
      .then(([rows, perBox]) => {
        if (!active) return;
        setHistory(rows);
        setPackaging(perBox);
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product.id]);

  const status = stockStatusLabel(rollup.total, product.min_stock);

  return (
    <Overlay onClose={onClose} width="max-w-4xl">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-2xl ring-1 ring-[#f4f7fe]">
          <div className="flex h-full w-full items-center justify-center bg-[#f4f7fe] text-[9px] font-black uppercase tracking-widest text-[#a3aed0]">
            N/A
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#2b3674]">{product.name}</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
              {product.sku ?? "NO SKU"}
            </span>
            <span className="text-[#e0e7ff]">•</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4318ff]">
              {categoryName ?? "No Category"}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-8 py-6">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                Product Description
              </h3>
              <p className="rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe]/50 p-4 text-sm leading-relaxed text-[#2b3674]">
                No description provided.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
              Inventory Status
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#f4f7fe] bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Package className="h-3 w-3 text-[#4318ff]" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#a3aed0]">
                    Total Units
                  </span>
                </div>
                <div className="text-xl font-black text-[#2b3674]">
                  {formatNumber(rollup.total)}
                </div>
              </div>
              <div className="rounded-2xl border border-[#f4f7fe] bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-[#4318ff]" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#a3aed0]">
                    Status
                  </span>
                </div>
                <div className="mt-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm",
                      STATUS_CLASSES[status],
                    )}
                  >
                    {status}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-[#f4f7fe] bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Package className="h-3 w-3 text-[#a3aed0]" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#a3aed0]">
                    SKU
                  </span>
                </div>
                <div className="text-sm font-black text-[#2b3674]">{product.sku ?? "—"}</div>
              </div>
              <div className="rounded-2xl border border-[#f4f7fe] bg-white p-4 shadow-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Weight className="h-3 w-3 text-[#a3aed0]" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-[#a3aed0]">
                    Packaging
                  </span>
                </div>
                <div className="text-[10px] font-bold text-[#2b3674]">
                  {packaging ? `${formatNumber(packaging)} Units/Box` : "—"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
              Transaction History
            </h3>
            <div className="rounded-md bg-[#f4f7fe] px-2 py-1 text-[9px] font-bold uppercase text-[#a3aed0]">
              Last 50 Records
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#f4f7fe]">
            <table className="w-full border-collapse text-left">
              <thead className="bg-[#f4f7fe]/50">
                <tr>
                  {["Date", "Type", "Qty", "From/To", "Reason"].map((head, index) => (
                    <th
                      key={head}
                      className={cn(
                        "h-10 px-4 text-[9px] font-black uppercase tracking-widest text-[#a3aed0]",
                        index === 2 && "text-right",
                      )}
                    >
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#a3aed0]">
                      Loading history...
                    </td>
                  </tr>
                ) : (history ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-[#a3aed0]">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  (history ?? []).map((entry) => (
                    <tr key={entry.id} className="border-b border-[#f4f7fe] hover:bg-[#f4f7fe]/30">
                      <td className="h-10 px-4 text-[10px] font-medium text-[#2b3674]">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(entry.occurred_at))}
                      </td>
                      <td className="h-10 px-4">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[9px] font-black uppercase",
                            entry.type === "IN"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-amber-50 text-amber-600",
                          )}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="h-10 px-4 text-right text-[10px] font-black text-[#2b3674]">
                        {entry.type === "OUT" ? "-" : "+"}
                        {formatNumber(entry.qty)}
                      </td>
                      <td className="h-10 px-4 text-[10px] text-[#a3aed0]">—</td>
                      <td
                        className="h-10 max-w-[150px] truncate px-4 text-[10px] text-[#a3aed0]"
                        title={entry.reference ?? ""}
                      >
                        {entry.reference ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border-none bg-[#f4f7fe] px-6 text-sm font-bold text-[#2b3674]"
          >
            Close Detail
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
  width,
}: {
  children: React.ReactNode;
  onClose: () => void;
  width: string;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0b1437]/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-[20px] bg-white p-6 shadow-xl",
          width,
        )}
      >
        {children}
      </div>
    </div>
  );
}

function IconButton({
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
      title={label}
      aria-label={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-xl shadow-sm transition",
        tone === "danger"
          ? "text-[#ee5d50] ring-1 ring-[#ee5d50]/10 hover:bg-[#ee5d50]/10"
          : "text-[#2b3674] ring-1 ring-[#f4f7fe] hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="px-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
        {label}
      </label>
      {children}
    </div>
  );
}
