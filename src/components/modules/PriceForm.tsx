"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/Textarea";
import { formatMoney, todayISO } from "@/lib/utils";
import type { Product, ProductPriceWithProduct } from "@/types";
import type { PriceInput } from "@/lib/db/prices";

export interface PriceFormProps {
  products: Product[];
  initial?: ProductPriceWithProduct | null;
  currency?: string;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (input: PriceInput) => void;
  onCancel?: () => void;
}

/**
 * Price entry is independent of stock: `unit` here is the quantity the price
 * covers, not a stock movement. Nothing on this form touches batches.
 */
export function PriceForm({
  products,
  initial,
  currency = "USD",
  submitting = false,
  submitLabel = "Save price",
  onSubmit,
  onCancel,
}: PriceFormProps) {
  const [productId, setProductId] = useState(initial?.product_id ?? "");
  const [unitPrice, setUnitPrice] = useState(initial ? String(initial.unit_price) : "");
  const [unit, setUnit] = useState(initial ? String(initial.unit) : "");
  const [date, setDate] = useState(initial?.date ?? todayISO());
  const [note, setNote] = useState(initial?.note ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const price = Number(unitPrice);
  const quantity = Number(unit);
  const total =
    Number.isFinite(price) && Number.isFinite(quantity) && price >= 0 && quantity > 0
      ? price * quantity
      : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!productId) nextErrors.productId = "Select a product.";
    if (!Number.isFinite(price) || price < 0) nextErrors.unitPrice = "Enter a valid unit price.";
    if (!Number.isInteger(quantity) || quantity <= 0) {
      nextErrors.unit = "Unit must be a whole number greater than zero.";
    }
    if (!date) nextErrors.date = "Pick a date.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      product_id: productId,
      unit_price: price,
      unit: quantity,
      date,
      note: note.trim() || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <SearchableSelect
        label="Product"
        value={productId}
        options={products.map((product) => ({
          value: product.id,
          label: product.sku ? `${product.name} (${product.sku})` : product.name,
        }))}
        onChange={setProductId}
        placeholder="Search and select a product…"
        error={errors.productId}
        required
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label="Unit price"
          type="number"
          min={0}
          step="0.01"
          value={unitPrice}
          onChange={(event) => setUnitPrice(event.target.value)}
          placeholder="0.00"
          error={errors.unitPrice}
          required
        />
        <Input
          label="Unit (qty)"
          type="number"
          min={1}
          step={1}
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          placeholder="0"
          error={errors.unit}
          required
        />
        <Input
          label="Total price"
          value={formatMoney(total, currency)}
          readOnly
          tabIndex={-1}
          className="font-semibold"
          hint="Auto-calculated: unit price × unit"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          error={errors.date}
          required
        />
        <Textarea
          label="Note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional"
          rows={2}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
