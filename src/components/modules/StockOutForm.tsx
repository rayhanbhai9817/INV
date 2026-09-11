"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/Textarea";
import { planFifoAllocations } from "@/lib/fifo-plan";
import { formatNumber, todayISO } from "@/lib/utils";
import type { InventoryRow, StockBatch } from "@/types";

export interface StockOutFormValues {
  productId: string;
  qty: number;
  outDate: string;
  note: string;
}

export interface StockOutFormProps {
  inventory: InventoryRow[];
  /** Open batches of the selected product, oldest first. */
  batches: StockBatch[];
  batchesLoading?: boolean;
  submitting?: boolean;
  onProductChange: (productId: string) => void;
  onSubmit: (values: StockOutFormValues) => void;
}

/**
 * Issues stock. The submit button stays disabled whenever the requested
 * quantity exceeds what is on hand, and the FIFO preview shows exactly which
 * batches will be consumed before the user confirms.
 */
export function StockOutForm({
  inventory,
  batches,
  batchesLoading = false,
  submitting = false,
  onProductChange,
  onSubmit,
}: StockOutFormProps) {
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [outDate, setOutDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const options = useMemo(
    () =>
      inventory.map((row) => ({
        value: row.id,
        label: row.sku ? `${row.name} (${row.sku})` : row.name,
        meta: `${formatNumber(row.current_stock)} ${row.unit}`,
      })),
    [inventory],
  );

  const selected = inventory.find((row) => row.id === productId) ?? null;
  const available = selected?.current_stock ?? 0;
  const requested = Number(qty);
  const validQty = Number.isInteger(requested) && requested > 0;
  const exceedsStock = validQty && requested > available;

  /** Dry run using the same planner the engine walks. */
  const preview = useMemo(
    () => (validQty ? planFifoAllocations(batches, requested).allocations : []),
    [batches, requested, validQty],
  );

  function handleProductChange(nextId: string) {
    setProductId(nextId);
    setErrors({});
    onProductChange(nextId);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!productId) nextErrors.productId = "Select a product.";
    if (!validQty) nextErrors.qty = "Quantity must be a whole number greater than zero.";
    else if (requested > available) {
      nextErrors.qty = `Only ${formatNumber(available)} ${selected?.unit ?? "units"} available.`;
    }
    if (!outDate) nextErrors.outDate = "Pick an issue date.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({ productId, qty: requested, outDate, note: note.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SearchableSelect
        label="Product"
        value={productId}
        options={options}
        onChange={handleProductChange}
        placeholder="Search and select a product…"
        error={errors.productId}
        required
        emptyMessage="No products — add one first."
      />

      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <span className="text-slate-600">Current stock</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {formatNumber(available)} {selected.unit}
          </span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Total quantity to issue"
          type="number"
          min={1}
          step={1}
          value={qty}
          onChange={(event) => setQty(event.target.value)}
          placeholder="0"
          error={errors.qty ?? (exceedsStock ? `Exceeds available stock (${available}).` : null)}
          required
        />
        <Input
          label="Issue date"
          type="date"
          value={outDate}
          onChange={(event) => setOutDate(event.target.value)}
          error={errors.outDate}
          required
        />
      </div>

      <Textarea
        label="Note"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional — order reference, customer, destination…"
        rows={2}
      />

      {/* ------------------------- FIFO preview ------------------------- */}
      {productId && validQty && !exceedsStock && (
        <div className="rounded-lg border border-slate-200">
          <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            FIFO allocation preview
          </p>
          {batchesLoading ? (
            <p className="px-4 py-3 text-sm text-slate-500">Loading batches…</p>
          ) : preview.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">No open batches for this product.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {preview.map(({ batch, deduct }) => (
                <li key={batch.id} className="flex items-center justify-between gap-3 px-4 py-2">
                  <span className="text-slate-600">
                    Batch {batch.batch_date}
                    <span className="ml-2 text-xs text-slate-400">
                      {formatNumber(batch.remaining_qty)} remaining
                    </span>
                  </span>
                  <span className="font-medium tabular-nums text-slate-900">
                    −{formatNumber(deduct)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">
          {exceedsStock
            ? "Requested quantity is larger than the stock on hand."
            : `Issuing ${formatNumber(validQty ? requested : 0)} ${selected?.unit ?? "units"}.`}
        </p>
        <Button type="submit" loading={submitting} disabled={!validQty || exceedsStock}>
          Review &amp; issue
        </Button>
      </div>
    </form>
  );
}
