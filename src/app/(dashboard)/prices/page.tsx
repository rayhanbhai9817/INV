"use client";

import { useMemo, useState } from "react";
import { Download, Inbox, Loader2, Pencil, Plus, X } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useAsync } from "@/lib/hooks";
import { allProducts } from "@/lib/db/products";
import {
  createPrice,
  deletePrice,
  listPrices,
  updatePrice,
  type PriceInput,
} from "@/lib/db/prices";
import { errorMessage } from "@/lib/supabase";
import { cn, downloadCsv, formatMoney, formatNumber, todayISO, toCsv } from "@/lib/utils";
import type { Product, ProductPriceWithProduct } from "@/types";

const PAGE_SIZE = 20;

interface FormState {
  product_id: string;
  unit_price: string;
  unit: string;
  date: string;
  note: string;
}

const blank: FormState = {
  product_id: "",
  unit_price: "",
  unit: "",
  date: todayISO(),
  note: "",
};

export default function ProductPricePage() {
  const toast = useToast();
  const { settings } = useSettings();

  const [productId, setProductId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductPriceWithProduct | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [saving, setSaving] = useState(false);

  const [removing, setRemoving] = useState<ProductPriceWithProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const products = useAsync(() => allProducts(), []);
  const prices = useAsync(
    () =>
      listPrices({
        productId: productId === "all" ? undefined : productId,
        dateFrom: from || undefined,
        dateTo: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    [productId, from, to, page, reloadKey],
  );

  const rows = useMemo(() => prices.data?.rows ?? [], [prices.data]);
  const total = prices.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summary = useMemo(() => {
    const value = rows.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0);
    const units = rows.reduce((sum, row) => sum + Number(row.unit ?? 0), 0);
    return {
      entries: total,
      value,
      average: units > 0 ? value / units : 0,
      products: new Set(rows.map((row) => row.product_id)).size,
    };
  }, [rows, total]);

  const price = Number(form.unit_price);
  const quantity = Number(form.unit);
  const computedTotal =
    Number.isFinite(price) && Number.isFinite(quantity) && price >= 0 && quantity > 0
      ? price * quantity
      : 0;

  function openCreate() {
    setEditing(null);
    setForm(blank);
    setOpen(true);
  }

  function openEdit(row: ProductPriceWithProduct) {
    setEditing(row);
    setForm({
      product_id: row.product_id,
      unit_price: String(row.unit_price),
      unit: String(row.unit),
      date: row.date,
      note: row.note ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.product_id) {
      toast.error("Select a product");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid unit price");
      return;
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error("Unit must be a whole number greater than zero");
      return;
    }
    if (!form.date) {
      toast.error("Pick a date");
      return;
    }

    setSaving(true);
    try {
      const payload: PriceInput = {
        product_id: form.product_id,
        unit_price: price,
        unit: quantity,
        date: form.date,
        note: form.note.trim() || null,
      };

      if (editing) {
        await updatePrice(editing.id, payload);
        toast.success("Price updated");
      } else {
        await createPrice(payload);
        toast.success("Price added");
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
    if (!removing) return;
    setDeleting(true);
    try {
      await deletePrice(removing.id);
      toast.success("Price entry deleted");
      setRemoving(null);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    downloadCsv(
      "ozipco-product-prices.csv",
      toCsv(
        ["Date", "Product", "SKU", "Unit Price", "Unit", "Total Price", "Note"],
        rows.map((row) => [
          row.date,
          row.product?.name ?? "",
          row.product?.sku ?? "",
          row.unit_price,
          row.unit,
          row.total_price,
          row.note ?? "",
        ]),
      ),
    );
  }

  const fieldClass =
    "h-10 rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20";
  const dialogFieldClass =
    "h-12 w-full rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] px-4 font-bold text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20";
  const dialogLabelClass = "ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">Price Book</h1>
          <p className="text-sm font-medium text-[#a3aed0]">
            Standalone unit pricing. Independent of stock movements and the ledger.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="flex h-11 items-center rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674] shadow-sm transition hover:bg-[#f4f7fe] disabled:opacity-50"
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="flex h-11 items-center rounded-2xl bg-[#4318ff] px-6 text-sm font-bold text-white shadow-xl shadow-[#4318ff]/20 transition hover:bg-[#3311cc]"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Price
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard
          label="Entries"
          value={formatNumber(summary.entries)}
          valueColor="text-[#2b3674]"
          sub="Priced records"
        />
        <SummaryCard
          label="Total Value"
          value={formatMoney(summary.value, settings.currency)}
          valueColor="text-[#4318ff]"
          sub="This page"
        />
        <SummaryCard
          label="Avg Unit Price"
          value={formatMoney(summary.average, settings.currency)}
          valueColor="text-[#2b3674]"
          sub="Weighted by unit"
        />
        <SummaryCard
          label="Products Priced"
          value={formatNumber(summary.products)}
          valueColor="text-[#2b3674]"
          sub="Distinct on this page"
        />
      </div>

      <div className="mb-8 overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#f4f7fe] bg-white p-6">
          <select
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setPage(1);
            }}
            className={cn(fieldClass, "w-[220px]")}
          >
            <option value="all">All Products</option>
            {(products.data ?? []).map((product: Product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              aria-label="From date"
              className={cn(fieldClass, "w-[140px]")}
            />
            <span className="font-black text-[#a3aed0]">—</span>
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              aria-label="To date"
              className={cn(fieldClass, "w-[140px]")}
            />
          </div>
        </div>

        {prices.loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : prices.error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-[#ee5d50]">
            <span>{prices.error}</span>
            <button
              type="button"
              onClick={prices.reload}
              className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Inbox className="h-6 w-6" />
            No price entries yet
          </div>
        ) : (
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#f4f7fe]">
                  <Th>Date</Th>
                  <Th>Product</Th>
                  <Th align="right">Unit Price</Th>
                  <Th align="right">Unit</Th>
                  <Th align="right">Total Price</Th>
                  <Th>Note</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[#f4f7fe] transition-colors hover:bg-[#f4f7fe]/30"
                  >
                    <td className="whitespace-nowrap px-4 py-4 text-[10px] font-bold text-[#a3aed0]">
                      {row.date}
                    </td>
                    <td className="px-4 py-4">
                      <div className="mb-1 max-w-[220px] truncate text-sm font-bold leading-none text-[#2b3674]">
                        {row.product?.name ?? "Deleted product"}
                      </div>
                      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                        {row.product?.sku ?? "NO SKU"}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-black text-[#a3aed0]">
                      {formatMoney(row.unit_price, settings.currency)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-black text-[#2b3674]">
                      {formatNumber(row.unit)}
                    </td>
                    <td className="px-4 py-4 text-right text-sm font-black text-[#4318ff]">
                      {formatMoney(row.total_price, settings.currency)}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-4 text-[10px] font-medium text-[#a3aed0]">
                      {row.note ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <IconButton label="Edit price" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Delete price"
                          tone="danger"
                          onClick={() => setRemoving(row)}
                        >
                          <X className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e0e5f2] px-4 py-3 text-sm">
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

      {open && (
        <Overlay onClose={() => setOpen(false)} width="max-w-2xl">
          <h2 className="text-xl font-black text-[#2b3674]">
            {editing ? "Edit price entry" : "Add price entry"}
          </h2>

          <div className="grid gap-6 py-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <label className={dialogLabelClass}>Product</label>
              <select
                value={form.product_id}
                onChange={(event) => setForm({ ...form, product_id: event.target.value })}
                className={dialogFieldClass}
              >
                <option value="">Select a product</option>
                {(products.data ?? []).map((product: Product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {product.sku ?? "NO SKU"}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={dialogLabelClass}>Unit Price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.unit_price}
                onChange={(event) => setForm({ ...form, unit_price: event.target.value })}
                placeholder="0.00"
                className={dialogFieldClass}
              />
            </div>

            <div className="space-y-2">
              <label className={dialogLabelClass}>Unit (Qty)</label>
              <input
                type="number"
                min={1}
                step={1}
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                placeholder="0"
                className={dialogFieldClass}
              />
            </div>

            <div className="space-y-2">
              <label className={dialogLabelClass}>Total Price (AUTO)</label>
              <input
                readOnly
                tabIndex={-1}
                value={formatMoney(computedTotal, settings.currency)}
                className="h-12 w-full cursor-not-allowed rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe]/50 px-4 text-center font-black text-[#4318ff] outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className={dialogLabelClass}>Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm({ ...form, date: event.target.value })}
                className={dialogFieldClass}
              />
            </div>

            <div className="space-y-2 sm:col-span-1 lg:col-span-2">
              <label className={dialogLabelClass}>Note</label>
              <input
                value={form.note}
                onChange={(event) => setForm({ ...form, note: event.target.value })}
                maxLength={200}
                placeholder="Optional"
                className={dialogFieldClass}
              />
            </div>
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
              className="h-11 rounded-2xl bg-[#4318ff] px-6 text-sm font-black uppercase tracking-widest text-white shadow-[0_10px_20px_-5px_rgba(67,24,255,0.3)] transition hover:bg-[#3311cc] disabled:opacity-60"
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Price"}
            </button>
          </div>
        </Overlay>
      )}

      {removing && (
        <Overlay onClose={() => setRemoving(null)} width="max-w-lg">
          <h2 className="text-lg font-black text-[#2b3674]">Delete price entry</h2>
          <p className="py-4 text-sm text-[#a3aed0]">
            Delete the{" "}
            <span className="font-bold text-[#2b3674]">
              {formatMoney(removing.total_price, settings.currency)}
            </span>{" "}
            entry for{" "}
            <span className="font-bold text-[#2b3674]">{removing.product?.name ?? "—"}</span>?
            Stock and ledger data are unaffected.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setRemoving(null)}
              className="h-11 rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-11 rounded-2xl bg-[#ee5d50] px-6 text-sm font-bold text-white transition hover:bg-[#d94b3f] disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
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
  value,
  valueColor,
  sub,
}: {
  label: string;
  value: string;
  valueColor: string;
  sub: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#f4f7fe] bg-white p-5 shadow-sm">
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
        {label}
      </p>
      <h3 className={cn("text-xl font-black", valueColor)}>{value}</h3>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#a3aed0]">{sub}</p>
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
      aria-label={label}
      title={label}
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

function Overlay({
  children,
  onClose,
  width,
}: {
  children: React.ReactNode;
  onClose: () => void;
  width: string;
}) {
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
