"use client";

import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { useNotificationsBadge } from "@/components/providers/NotificationsProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useAsync } from "@/lib/hooks";
import { getMovementProducts, recordStockIn, recordStockOut } from "@/lib/db/stock";
import { allSuppliers } from "@/lib/db/suppliers";
import { allWarehouses, defaultWarehouseId } from "@/lib/db/warehouses";
import { errorMessage } from "@/lib/supabase";
import { cn, formatMoney, formatNumber } from "@/lib/utils";

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
  const { settings } = useSettings();

  const [reloadKey, setReloadKey] = useState(0);
  const [warehouseId, setWarehouseId] = useState("");

  const warehouses = useAsync(() => allWarehouses(), []);
  const suppliers = useAsync(
    () => (mode === "STOCK_IN" ? allSuppliers() : Promise.resolve([])),
    [mode],
  );

  // Stock on hand is per warehouse, so the catalogue reloads when it changes.
  const catalogue = useAsync(
    () => getMovementProducts(warehouseId || null),
    [reloadKey, warehouseId],
  );
  const products = useMemo(() => catalogue.data ?? [], [catalogue.data]);

  // Start on the default warehouse once the list arrives.
  useEffect(() => {
    if (warehouseId || !warehouses.data?.length) return;
    setWarehouseId(defaultWarehouseId(warehouses.data));
  }, [warehouses.data, warehouseId]);

  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [boxes, setBoxes] = useState("");
  const [outUnits, setOutUnits] = useState("");
  const [reason, setReason] = useState(REASONS[mode][0] ?? "");
  const [destination, setDestination] = useState("");
  const [manualUnitsPerBox, setManualUnitsPerBox] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  /**
   * Issuing stock is irreversible, so Stock OUT keeps its confirmation step
   * even though the reference form submits straight away.
   */
  const [confirming, setConfirming] = useState(false);

  // Clearing on product change keeps one product's figures out of another's.
  useEffect(() => {
    setBoxes("");
    setOutUnits("");
    setNotes("");
    setDestination("");
    setUnitPrice("");

    if (!productId) {
      setManualUnitsPerBox("");
      setUnitCost("");
      return;
    }

    const selected = products.find((item) => item.id === productId);
    setManualUnitsPerBox(selected ? String(selected.unitsPerBox ?? 0) : "0");
    // Last purchase cost is a starting point, not a commitment — it stays editable.
    setUnitCost(selected?.lastUnitCost != null ? String(selected.lastUnitCost) : "");
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

  const costPerUnit = Number(unitCost);
  const pricePerUnit = Number(unitPrice);
  const hasCost = unitCost.trim() !== "" && Number.isFinite(costPerUnit) && costPerUnit >= 0;
  const hasPrice = unitPrice.trim() !== "" && Number.isFinite(pricePerUnit) && pricePerUnit >= 0;

  const totalCost = hasCost ? costPerUnit * movementUnits : null;
  const saleValue = hasPrice ? pricePerUnit * movementUnits : null;

  const warehouseName =
    (warehouses.data ?? []).find((item) => item.id === warehouseId)?.name ?? null;

  function handleSave() {
    if (!validate()) return;
    if (mode === "STOCK_OUT") {
      setConfirming(true);
      return;
    }
    void submit();
  }

  function validate(): boolean {
    if (!product) {
      toast.error("Select a product");
      return false;
    }
    if (movementUnits <= 0) {
      toast.error("Enter a quantity greater than zero");
      return false;
    }
    if (mode === "STOCK_OUT" && movementUnits > currentUnits) {
      toast.error(
        warehouseName
          ? `Not enough stock in ${warehouseName} for this movement`
          : "Not enough stock available for this movement",
      );
      return false;
    }
    if (!warehouseId) {
      toast.error(
        (warehouses.data ?? []).length === 0
          ? "Add a warehouse first — stock has to be held somewhere"
          : "Select a warehouse",
      );
      return false;
    }
    if (unitCost.trim() !== "" && !hasCost) {
      toast.error("Unit cost must be zero or more");
      return false;
    }
    if (unitPrice.trim() !== "" && !hasPrice) {
      toast.error("Unit price must be zero or more");
      return false;
    }
    if (!reason.trim()) {
      toast.error("A reason is required");
      return false;
    }
    return true;
  }

  async function submit() {
    if (!product) return;

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
          unitCost: hasCost ? costPerUnit : null,
          supplierId: supplierId || null,
          warehouseId,
        });
      } else {
        await recordStockOut(product.id, movementUnits, {
          outDate: movementDate,
          note: reference,
          reference,
          unitPrice: hasPrice ? pricePerUnit : null,
          warehouseId,
        });
      }

      toast.success("Stock movement recorded");

      setProductId("");
      setBoxes("");
      setOutUnits("");
      setManualUnitsPerBox("");
      setNotes("");
      setDestination("");
      setUnitCost("");
      setUnitPrice("");
      setSupplierId("");
      setReason(REASONS[mode][0] ?? "");
      setConfirming(false);
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
            <label className={labelClass}>Warehouse</label>
            <select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              className={fieldClass}
            >
              {(warehouses.data ?? []).length === 0 && (
                <option value="">No warehouses yet — add one first</option>
              )}
              {(warehouses.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.location ? ` · ${item.location}` : ""}
                </option>
              ))}
            </select>
            <p className="ml-1 mt-1 text-[10px] font-bold text-[#a3aed0]">
              {mode === "STOCK_IN"
                ? "The received stock is held here."
                : "Only this warehouse's stock can be issued."}
            </p>
          </div>

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

              <div className="space-y-2">
                <label className={labelClass}>Supplier</label>
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Not recorded</option>
                  {(suppliers.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Unit Cost</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitCost}
                  onChange={(event) => setUnitCost(event.target.value)}
                  placeholder="0.00"
                  className={fieldClass}
                />
                <p className="ml-1 mt-1 text-[10px] font-bold text-[#a3aed0]">
                  Leave blank if the cost is not known.
                </p>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Total Cost (AUTO)</label>
                <input
                  readOnly
                  tabIndex={-1}
                  value={totalCost === null ? "—" : formatMoney(totalCost, settings.currency)}
                  className="h-12 w-full cursor-not-allowed rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe]/50 px-4 text-center font-black text-[#05cd99] outline-none"
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

          {mode === "STOCK_OUT" && (
            <>
              <div className="space-y-2">
                <label className={labelClass}>Unit Price</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={unitPrice}
                  onChange={(event) => setUnitPrice(event.target.value)}
                  placeholder="0.00"
                  className={fieldClass}
                />
                <p className="ml-1 mt-1 text-[10px] font-bold text-[#a3aed0]">
                  Leave blank when this is not a sale.
                </p>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Sale Value (AUTO)</label>
                <input
                  readOnly
                  tabIndex={-1}
                  value={saleValue === null ? "—" : formatMoney(saleValue, settings.currency)}
                  className="h-12 w-full cursor-not-allowed rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe]/50 px-4 text-center font-black text-[#05cd99] outline-none"
                />
              </div>
            </>
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
              onClick={handleSave}
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

              {warehouseName && (
                <div className="flex items-end justify-between border-b border-[#f4f7fe] pb-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Warehouse
                  </span>
                  <span className="text-sm font-bold text-[#2b3674]">{warehouseName}</span>
                </div>
              )}

              {mode === "STOCK_IN" && totalCost !== null && (
                <div className="flex items-end justify-between border-b border-[#f4f7fe] pb-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Purchase Cost
                  </span>
                  <span className="text-sm font-black text-[#05cd99]">
                    {formatMoney(totalCost, settings.currency)}
                  </span>
                </div>
              )}

              {mode === "STOCK_OUT" && saleValue !== null && (
                <div className="flex items-end justify-between border-b border-[#f4f7fe] pb-4">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                    Sale Value
                  </span>
                  <span className="text-sm font-black text-[#05cd99]">
                    {formatMoney(saleValue, settings.currency)}
                  </span>
                </div>
              )}

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

      {confirming && product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#0b1437]/40"
            onClick={() => !saving && setConfirming(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-10 w-full max-w-md rounded-[30px] bg-white p-8 shadow-xl"
          >
            <h3 className="text-lg font-black text-[#2b3674]">Confirm Stock OUT</h3>
            <p className="mt-3 text-sm text-[#a3aed0]">
              Issue{" "}
              <span className="font-black text-[#ee5d50]">
                {formatNumber(movementUnits)} units
              </span>{" "}
              of <span className="font-bold text-[#2b3674]">{product.name}</span>
              {warehouseName ? (
                <>
                  {" "}from <span className="font-bold text-[#2b3674]">{warehouseName}</span>
                </>
              ) : null}
              {saleValue !== null ? (
                <>
                  {" "}for{" "}
                  <span className="font-black text-[#05cd99]">
                    {formatMoney(saleValue, settings.currency)}
                  </span>
                </>
              ) : null}
              ? The oldest batches in this warehouse are deducted first and a ledger entry is
              written for each batch touched. This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={saving}
                className="h-11 rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving}
                className="h-11 rounded-2xl bg-[#4318ff] px-6 text-sm font-black uppercase tracking-widest text-white transition hover:bg-[#3311cc] disabled:opacity-60"
              >
                {saving ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
