"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { useNotificationsBadge } from "@/components/providers/NotificationsProvider";
import { useAsync } from "@/lib/hooks";
import { getMovementProducts, recordStockIn, recordStockOut } from "@/lib/db/stock";
import { errorMessage } from "@/lib/supabase";
import { cn, formatNumber } from "@/lib/utils";

type Mode = "STOCK_IN" | "STOCK_OUT";

const REASONS: Record<Mode, string[]> = {
  STOCK_IN: ["Purchase", "Return", "Correction", "Transfer in"],
  STOCK_OUT: ["Sale", "Damage", "Loss", "Sample", "Transfer out"],
};

/** Composes the free-text fields into the single reference the ledger stores. */
function composeReference(reason: string, origin: string, notes: string): string {
  return [reason, origin.trim(), notes.trim()].filter(Boolean).join(" · ").slice(0, 300);
}

export function StockMovementForm({ mode }: { mode: Mode }) {
  const toast = useToast();
  const { refresh: refreshBadge } = useNotificationsBadge();

  const [reloadKey, setReloadKey] = useState(0);
  const catalogue = useAsync(() => getMovementProducts(), [reloadKey]);
  const products = useMemo(() => catalogue.data ?? [], [catalogue.data]);

  const [productId, setProductId] = useState("");
  const [boxes, setBoxes] = useState("");
  const [outUnits, setOutUnits] = useState("");
  const [reason, setReason] = useState(REASONS[mode][0] ?? "");
  const [destination, setDestination] = useState("");
  const [manualUnitsPerBox, setManualUnitsPerBox] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Clearing on product change keeps one product's figures out of another's.
  useEffect(() => {
    setBoxes("");
    setOutUnits("");
    setNotes("");
    setDestination("");

    if (!productId) {
      setManualUnitsPerBox("");
    } else {
      const selected = products.find((item) => item.id === productId);
      setManualUnitsPerBox(selected ? String(selected.unitsPerBox ?? 0) : "0");
    }
  }, [productId, products]);

  const product = useMemo(
    () => products.find((item) => item.id === productId) ?? null,
    [products, productId],
  );

  const unitsPerBox = useMemo(() => {
    const manual = Number(manualUnitsPerBox);
    if (!Number.isNaN(manual) && manual > 0) return manual;
    return product?.unitsPerBox ?? 0;
  }, [manualUnitsPerBox, product]);

  const movementUnits =
    mode === "STOCK_IN"
      ? Math.floor(Math.max(0, Number(boxes) || 0) * Math.max(0, unitsPerBox))
      : Number(outUnits) || 0;

  const currentUnits = product?.currentUnits ?? 0;
  const resulting = mode === "STOCK_IN" ? currentUnits + movementUnits : currentUnits - movementUnits;

  async function submit() {
    if (!product) {
      toast.error("Select a product");
      return;
    }
    if (movementUnits <= 0) {
      toast.error("Enter a quantity greater than zero");
      return;
    }
    if (mode === "STOCK_OUT" && movementUnits > currentUnits) {
      toast.error("Not enough stock available for this movement");
      return;
    }
    if (!reason.trim()) {
      toast.error("A reason is required");
      return;
    }

    setSaving(true);
    try {
      const reference = composeReference(reason, destination, notes);
      const movementDate = occurredAt.slice(0, 10);

      if (mode === "STOCK_IN") {
        await recordStockIn({
          productId: product.id,
          boxCount: Number(boxes) || 0,
          qtyPerBox: unitsPerBox,
          batchDate: movementDate,
          reference,
        });
      } else {
        await recordStockOut(product.id, movementUnits, {
          outDate: movementDate,
          note: reference,
          reference,
        });
      }

      toast.success("Stock movement recorded");

      setProductId("");
      setBoxes("");
      setOutUnits("");
      setManualUnitsPerBox("");
      setNotes("");
      setDestination("");
      setReason(REASONS[mode][0] ?? "");
      setReloadKey((key) => key + 1);
      void refreshBadge();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  const labelClass = "ml-1 text-xs font-black uppercase tracking-[0.2em] text-[#a3aed0]";
  const fieldClass =
    "h-12 w-full rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] px-4 font-bold text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="overflow-hidden rounded-[30px] bg-white shadow-sm ring-1 ring-black/5 lg:col-span-2">
        <div className="border-b border-[#f4f7fe] px-8 pb-6 pt-8">
          <h2 className="text-xl font-black text-[#2b3674]">
            {mode === "STOCK_IN" ? "Record Stock IN" : "Record Stock OUT"}
          </h2>
        </div>

        <div className="grid gap-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <label className={labelClass}>Product</label>
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className={fieldClass}
            >
              <option value="">Select a product</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.sku ?? "NO SKU"}
                </option>
              ))}
            </select>
          </div>

          {mode === "STOCK_IN" ? (
            <>
              <div className="space-y-2">
                <label className={labelClass}>Total Boxes</label>
                <input
                  type="number"
                  min={0}
                  value={boxes}
                  onChange={(event) => setBoxes(event.target.value)}
                  placeholder="0"
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Units Per Box</label>
                <input
                  type="number"
                  min={1}
                  value={manualUnitsPerBox}
                  onChange={(event) => setManualUnitsPerBox(event.target.value)}
                  placeholder={String(product?.unitsPerBox ?? 0)}
                  className={fieldClass}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Total Units (AUTO)</label>
                <input
                  type="number"
                  readOnly
                  value={movementUnits}
                  tabIndex={-1}
                  className="h-12 w-full cursor-not-allowed rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe]/50 px-4 text-center font-black text-[#4318ff] outline-none"
                />
              </div>
            </>
          ) : (
            <div className="space-y-2 sm:col-span-3">
              <label className={labelClass}>Total Units to Remove</label>
              <input
                type="number"
                min={1}
                value={outUnits}
                onChange={(event) => setOutUnits(event.target.value)}
                placeholder="Enter exact unit quantity"
                className="h-12 w-full rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] px-4 text-lg font-black text-[#ee5d50] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
              />
              <p className="ml-1 mt-1 text-[10px] font-bold text-[#a3aed0]">
                Units will be deducted from your oldest stock batches first (FIFO).
              </p>
            </div>
          )}

          <div className="space-y-2 sm:col-span-1">
            <label className={labelClass}>Reason</label>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={fieldClass}
            >
              {REASONS[mode].map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className={labelClass}>
              {mode === "STOCK_OUT" ? "Destination / Channel" : "Reference / Origin"}
            </label>
            <input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              maxLength={200}
              placeholder={
                mode === "STOCK_OUT" ? "e.g. Retail Store, Warehouse B" : "e.g. PO #123, Vendor X"
              }
              className={fieldClass}
            />
          </div>

          <div className="space-y-2">
            <label className={labelClass}>Date</label>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(event) => setOccurredAt(event.target.value)}
              className={fieldClass}
            />
          </div>

          <div className="space-y-2 sm:col-span-2 lg:col-span-3">
            <label className={labelClass}>Notes</label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] p-4 font-bold text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              onClick={submit}
              disabled={saving || !product}
              className={cn(
                "h-12 rounded-2xl bg-[#4318ff] px-8 font-black uppercase tracking-widest text-white transition-all",
                "shadow-[0_10px_20px_-5px_rgba(67,24,255,0.3)] hover:bg-[#3311cc]",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {saving ? "Saving…" : "Save movement"}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-[30px] bg-white shadow-sm ring-1 ring-black/5">
        <div className="border-b border-[#f4f7fe] px-8 pb-6 pt-8">
          <h2 className="text-lg font-black text-[#2b3674]">Live preview</h2>
        </div>
        <div className="space-y-4 p-8">
          {!product ? (
            <p className="text-[#a3aed0]">Select a product to see its current stock.</p>
          ) : (
            <>
              <div className="flex items-end justify-between border-b border-[#f4f7fe] pb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                  Current Inventory
                </span>
                <span className="text-sm font-bold text-[#2b3674]">
                  {formatNumber(currentUnits)} units
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] p-6">
                <div className="mb-4 flex items-end justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Expected Results
                  </span>
                  <span className="text-sm font-black text-[#4318ff]">
                    {formatNumber(resulting)} units
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
