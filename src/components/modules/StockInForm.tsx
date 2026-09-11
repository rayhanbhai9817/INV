"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/Textarea";
import { formatNumber, todayISO } from "@/lib/utils";
import type { InventoryRow } from "@/types";

export interface StockInFormValues {
  productId: string;
  boxCount: number;
  qtyPerBox: number;
  batchDate: string;
  note: string;
}

export interface StockInFormProps {
  inventory: InventoryRow[];
  submitting?: boolean;
  onSubmit: (values: StockInFormValues) => void;
}

/**
 * Total is never editable: it is always box count x qty per box, so the batch
 * that lands in the database cannot disagree with what the user saw.
 */
export function StockInForm({ inventory, submitting = false, onSubmit }: StockInFormProps) {
  const [productId, setProductId] = useState("");
  const [boxCount, setBoxCount] = useState("");
  const [qtyPerBox, setQtyPerBox] = useState("");
  const [batchDate, setBatchDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const options = useMemo(
    () =>
      inventory.map((row) => ({
        value: row.id,
        label: row.sku ? `${row.name} (${row.sku})` : row.name,
        meta: `${formatNumber(row.current_stock)} ${row.unit} on hand`,
      })),
    [inventory],
  );

  const selected = inventory.find((row) => row.id === productId) ?? null;

  const boxes = Number(boxCount);
  const perBox = Number(qtyPerBox);
  const total =
    Number.isFinite(boxes) && Number.isFinite(perBox) && boxes > 0 && perBox > 0
      ? boxes * perBox
      : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!productId) nextErrors.productId = "Select a product.";
    if (!Number.isInteger(boxes) || boxes <= 0) {
      nextErrors.boxCount = "Box count must be a whole number greater than zero.";
    }
    if (!Number.isInteger(perBox) || perBox <= 0) {
      nextErrors.qtyPerBox = "Qty per box must be a whole number greater than zero.";
    }
    if (!batchDate) nextErrors.batchDate = "Pick a batch date.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({ productId, boxCount: boxes, qtyPerBox: perBox, batchDate, note: note.trim() });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SearchableSelect
        label="Product"
        value={productId}
        options={options}
        onChange={setProductId}
        placeholder="Search and select a product…"
        error={errors.productId}
        hint={
          selected
            ? `Currently ${formatNumber(selected.current_stock)} ${selected.unit} on hand.`
            : "Type to filter by name or SKU."
        }
        required
        emptyMessage="No products — add one first."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Box count"
          type="number"
          min={1}
          step={1}
          value={boxCount}
          onChange={(event) => setBoxCount(event.target.value)}
          placeholder="0"
          error={errors.boxCount}
          required
        />
        <Input
          label="Qty per box"
          type="number"
          min={1}
          step={1}
          value={qtyPerBox}
          onChange={(event) => setQtyPerBox(event.target.value)}
          placeholder="0"
          error={errors.qtyPerBox}
          required
        />
        <Input
          label="Total quantity"
          value={total ? formatNumber(total) : "0"}
          readOnly
          tabIndex={-1}
          hint="Auto-calculated: box count × qty per box"
          className="font-semibold"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Batch date"
          type="date"
          value={batchDate}
          onChange={(event) => setBatchDate(event.target.value)}
          error={errors.batchDate}
          hint="FIFO issues the oldest batch date first."
          required
        />
        <Textarea
          label="Reference / note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional — PO number, delivery note…"
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3">
        <p className="text-sm text-slate-600">
          This will add{" "}
          <span className="font-semibold text-slate-900">
            {formatNumber(total)} {selected?.unit ?? "units"}
          </span>{" "}
          as one new batch.
        </p>
        <Button type="submit" loading={submitting} disabled={total === 0}>
          Record Stock In
        </Button>
      </div>
    </form>
  );
}
