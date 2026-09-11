"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { Category, Product, Supplier } from "@/types";
import type { ProductInput } from "@/lib/db/products";

export interface ProductFormProps {
  initial?: Product | null;
  categories: Category[];
  suppliers: Supplier[];
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (input: ProductInput) => void;
  onCancel?: () => void;
}

const UNIT_OPTIONS = ["pcs", "box", "kg", "g", "litre", "ml", "pack", "set"];

export function ProductForm({
  initial,
  categories,
  suppliers,
  submitting = false,
  submitLabel = "Save product",
  onSubmit,
  onCancel,
}: ProductFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sku, setSku] = useState(initial?.sku ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? "");
  const [supplierId, setSupplierId] = useState(initial?.supplier_id ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "pcs");
  const [minStock, setMinStock] = useState(String(initial?.min_stock ?? 0));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Product name is required.";

    const min = Number(minStock);
    if (!Number.isFinite(min) || min < 0 || !Number.isInteger(min)) {
      nextErrors.minStock = "Minimum stock must be a whole number of 0 or more.";
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    onSubmit({
      name: name.trim(),
      sku: sku.trim() || null,
      category_id: categoryId || null,
      supplier_id: supplierId || null,
      unit: unit || "pcs",
      min_stock: min,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Product name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Blue Ink Cartridge"
          error={errors.name}
          required
        />
        <Input
          label="SKU"
          value={sku}
          onChange={(event) => setSku(event.target.value)}
          placeholder="Optional, must be unique"
          hint="Leave blank if you do not use SKUs."
        />
        <Select
          label="Category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          placeholder="No category"
          options={categories.map((category) => ({
            value: category.id,
            label: category.name,
          }))}
        />
        <Select
          label="Supplier"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
          placeholder="No supplier"
          options={suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
        />
        <Select
          label="Unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          options={UNIT_OPTIONS.map((option) => ({ value: option, label: option }))}
        />
        <Input
          label="Minimum stock"
          type="number"
          min={0}
          step={1}
          value={minStock}
          onChange={(event) => setMinStock(event.target.value)}
          error={errors.minStock}
          hint="Low-stock alerts trigger at or below this level."
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
