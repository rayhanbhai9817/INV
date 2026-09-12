"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Download, History, Inbox, Loader2, Package, Search } from "lucide-react";

import { useAsync } from "@/lib/hooks";
import { useSettings } from "@/components/providers/SettingsProvider";
import { allCategories } from "@/lib/db/categories";
import { allWarehouses } from "@/lib/db/warehouses";
import { getInventoryControl, type ControlProduct } from "@/lib/db/inventory";
import { stockStatusLabel, type StockStatusLabel } from "@/lib/range";
import { MobileCard, MobileCards } from "@/components/ui/DataCards";
import { cn, downloadCsv, formatMoney, formatNumber, toCsv } from "@/lib/utils";
import type { Category, Warehouse } from "@/types";

const STATUS_CLASSES: Record<StockStatusLabel, string> = {
  "OUT OF STOCK": "bg-[#B60117]/5 text-[#B60117] border border-[#B60117]/10",
  "LOW STOCK": "bg-[#ffb547]/5 text-[#ffb547] border border-[#ffb547]/10",
  "IN STOCK": "bg-[#05cd99]/5 text-[#05cd99] border border-[#05cd99]/10",
};

const STATUS_FROM_QUERY: Record<string, StockStatusLabel> = {
  low_stock: "LOW STOCK",
  out_of_stock: "OUT OF STOCK",
  ok: "IN STOCK",
};

export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryControlCenter />
    </Suspense>
  );
}

function InventoryControlCenter() {
  const searchParams = useSearchParams();
  const { settings } = useSettings();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [warehouse, setWarehouse] = useState("all");
  const [status, setStatus] = useState<string>(
    STATUS_FROM_QUERY[searchParams.get("status") ?? ""] ?? "all",
  );

  const categories = useAsync(() => allCategories(), []);
  const warehouses = useAsync(() => allWarehouses().catch(() => [] as Warehouse[]), []);
  const control = useAsync(() => getInventoryControl(), []);
  const products = useMemo(() => control.data ?? [], [control.data]);

  /** Units of a product held in the selected warehouse, or everywhere. */
  const unitsIn = (product: ControlProduct) =>
    warehouse === "all"
      ? product.available
      : (product.byWarehouse.find((entry) => entry.id === warehouse)?.units ?? 0);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      if (term && !`${product.name} ${product.sku ?? ""}`.toLowerCase().includes(term)) return false;
      if (category !== "all" && product.category_id !== category) return false;
      // A warehouse filter hides products that hold nothing there at all.
      if (warehouse !== "all" && !product.byWarehouse.some((entry) => entry.id === warehouse)) {
        return false;
      }
      if (status !== "all" && stockStatusLabel(product.available, product.threshold) !== status) {
        return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, search, category, warehouse, status]);

  const stats = useMemo(
    () => ({
      products: rows.length,
      boxes: rows.reduce((sum, product) => sum + product.totalBoxes, 0),
      units: rows.reduce((sum, product) => sum + unitsIn(product), 0),
      value: rows.reduce((sum, product) => sum + product.stockValue, 0),
      low: rows.filter(
        (product) => stockStatusLabel(product.available, product.threshold) === "LOW STOCK",
      ).length,
      out: rows.filter((product) => product.available <= 0).length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, warehouse],
  );

  function exportCsv() {
    downloadCsv(
      "ozipco-inventory-full.csv",
      toCsv(
        [
          "SKU",
          "Product",
          "Category",
          "Warehouses",
          "Boxes",
          "Units/Box",
          "Total Units",
          "Stock Value",
          "Status",
        ],
        rows.map((product) => [
          product.sku ?? "",
          product.name,
          product.categoryName,
          product.byWarehouse.map((entry) => `${entry.name} (${entry.units})`).join("; "),
          product.totalBoxes,
          product.unitsPerBox,
          product.available,
          product.stockValue,
          stockStatusLabel(product.available, product.threshold),
        ]),
      ),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">
            Inventory Control Center
          </h1>
          <p className="text-sm font-medium text-[#a3aed0]">
            Real-time enterprise stock management and movement analytics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={exportCsv}
            className="flex h-11 items-center rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674] shadow-sm transition hover:bg-[#f4f7fe]"
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-6">
        <StatItem label="Total Products" value={formatNumber(stats.products)} />
        <StatItem label="Warehouse Boxes" value={formatNumber(stats.boxes)} />
        <StatItem label="Available Units" value={formatNumber(stats.units)} color="text-[#4318ff]" />
        <StatItem
          label="Stock Value"
          value={formatMoney(stats.value, settings.currency)}
          color="text-[#05cd99]"
        />
        <StatItem label="Low Stock" value={formatNumber(stats.low)} color="text-[#ffb547]" />
        <StatItem label="Out of Stock" value={formatNumber(stats.out)} color="text-[#ee5d50]" />
      </div>

      <div className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
        <div className="flex flex-wrap items-center gap-4 border-b border-[#f4f7fe] p-6">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a3aed0]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search SKU or Name..."
              className="h-10 w-full rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] pl-9 pr-3 text-xs text-[#2b3674] outline-none placeholder:text-[#a3aed0] focus:ring-2 focus:ring-[#4318ff]/20"
            />
          </div>
          <select
            value={warehouse}
            onChange={(event) => setWarehouse(event.target.value)}
            className="h-10 w-[160px] rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
          >
            <option value="all">All Warehouses</option>
            {(warehouses.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-10 w-[160px] rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
          >
            <option value="all">All Categories</option>
            {(categories.data ?? []).map((item: Category) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 w-[160px] rounded-xl border-none bg-[#f4f7fe] px-3 text-xs text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
          >
            <option value="all">All Status</option>
            <option value="IN STOCK">In Stock</option>
            <option value="LOW STOCK">Low Stock</option>
            <option value="OUT OF STOCK">Out of Stock</option>
          </select>
        </div>

        {control.loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : control.error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-[#ee5d50]">
            <span>{control.error}</span>
            <button
              type="button"
              onClick={control.reload}
              className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Inbox className="h-6 w-6" />
            No inventory found
          </div>
        ) : (
          <>
          <MobileCards>
            {rows.map((product) => (
              <MobileProductRow key={product.id} product={product} />
            ))}
          </MobileCards>

          <div className="hidden overflow-x-auto p-6 pt-0 md:block">
            <div className="min-w-[1200px]">
              <div className="mb-4 flex border-b border-[#f4f7fe] px-4">
                <div className="flex min-w-[250px] flex-1 items-center py-5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Product
                </div>
                <div className="flex w-[140px] items-center py-5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Category
                </div>
                <div className="flex w-[100px] items-center justify-center py-5 text-center text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Boxes
                </div>
                <div className="flex w-[100px] items-center justify-center whitespace-nowrap py-5 text-center text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Units / Box
                </div>
                <div className="flex w-[120px] items-center justify-center whitespace-nowrap py-5 text-center text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Total Units
                </div>
                <div className="flex w-[100px] items-center justify-center py-5 text-center text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Stock IN
                </div>
                <div className="flex w-[100px] items-center justify-center py-5 text-center text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Stock OUT
                </div>
                <div className="flex w-[120px] items-center py-5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Status
                </div>
                <div className="flex w-[60px] items-center justify-end py-5 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-[#2b3674]">
                  Details
                </div>
              </div>
              <div className="space-y-3">
                {rows.map((product) => (
                  <ProductRow key={product.id} product={product} />
                ))}
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  color = "text-[#2b3674]",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm">
      <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
        {label}
      </p>
      <h3 className={cn("text-2xl font-black", color)}>{value}</h3>
    </div>
  );
}

function MobileProductRow({ product }: { product: ControlProduct }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const status = stockStatusLabel(product.available, product.threshold);

  return (
    <div>
      <MobileCard
        onClick={() => setOpen(!open)}
        title={product.name}
        subtitle={product.categoryName}
        badge={
          <span
            className={cn(
              "inline-flex items-center rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]",
              STATUS_CLASSES[status],
            )}
          >
            {status}
          </span>
        }
        fields={[
          { label: "Total Units", value: formatNumber(product.available) },
          { label: "Boxes", value: formatNumber(product.totalBoxes) },
          { label: "Stock IN", value: `+${formatNumber(product.totalIn)}`, tone: "text-[#05cd99]" },
          { label: "Stock OUT", value: `-${formatNumber(product.dispatched)}`, tone: "text-[#ee5d50]" },
        ]}
        footer={
          <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#4318ff]">
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {open ? "Hide details" : "View details"}
          </p>
        }
      />

      {open && (
        <div className="space-y-4 bg-[#f8faff] px-4 pb-5">
          <Panel title="Product Information">
            <InfoItem label="SKU" value={product.sku ?? "—"} isMono />
            <InfoItem
              label="Units per Box"
              value={product.unitsPerBox ? formatNumber(product.unitsPerBox) : "—"}
            />
            <InfoItem
              label="Last Updated"
              value={
                product.lastMovement
                  ? new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }).format(new Date(product.lastMovement))
                  : "—"
              }
            />
          </Panel>

          <Panel title="FIFO Batch Inventory">
            {product.batches.length === 0 ? (
              <p className="rounded-xl bg-[#f4f7fe] p-3 text-center text-xs italic text-[#a3aed0]">
                No active batches
              </p>
            ) : (
              <div className="space-y-2">
                {product.batches.map((batch) => (
                  <div
                    key={batch.id}
                    className="rounded-xl border border-[#f4f7fe] bg-white p-3 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-[#2b3674]">
                        BATCH #{batch.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[9px] font-black uppercase",
                          batch.remainingUnits === 0
                            ? "bg-gray-100 text-gray-400"
                            : "bg-[#05cd99]/10 text-[#05cd99]",
                        )}
                      >
                        {batch.status}
                      </span>
                    </div>
                    <p className="mt-1 text-[9px] font-bold uppercase text-[#a3aed0]">
                      {batch.warehouseName ?? "No warehouse"}
                      {batch.supplierName ? ` · ${batch.supplierName}` : ""}
                      {batch.unitCost !== null
                        ? ` · ${formatMoney(batch.unitCost, settings.currency)}/unit`
                        : ""}
                    </p>
                    <p className="mt-1 text-[9px] font-bold uppercase text-[#a3aed0]">
                      {batch.receivedAt} · {formatNumber(batch.remainingBoxes)}/
                      {formatNumber(batch.originalBoxes)} boxes ·{" "}
                      {formatNumber(batch.unitsPerBox)}/box
                    </p>
                    <p className="mt-1 font-black text-[#4318ff]">
                      {formatNumber(batch.remainingUnits)} units
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent Movement History">
            {product.history.length === 0 ? (
              <p className="rounded-xl bg-[#f4f7fe] p-3 text-center text-xs italic text-[#a3aed0]">
                No movement recorded
              </p>
            ) : (
              <div className="space-y-2">
                {product.history.slice(0, 5).map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between rounded-xl border border-[#f4f7fe] bg-white p-3 text-[11px]"
                  >
                    <div>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[9px] font-black uppercase",
                          movement.type === "IN"
                            ? "bg-[#05cd99]/10 text-[#05cd99]"
                            : "bg-[#ee5d50]/10 text-[#ee5d50]",
                        )}
                      >
                        {movement.type === "IN" ? "STOCK IN" : "STOCK OUT"}
                      </span>
                      <p className="mt-1 text-[9px] font-bold text-[#a3aed0]">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        }).format(new Date(movement.occurredAt))}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-black",
                          movement.qty > 0 ? "text-[#05cd99]" : "text-[#ee5d50]",
                        )}
                      >
                        {movement.qty > 0 ? "+" : ""}
                        {formatNumber(movement.qty)}
                      </p>
                      <p className="text-[9px] font-bold text-[#a3aed0]">
                        Bal {formatNumber(movement.balance)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function ProductRow({ product }: { product: ControlProduct }) {
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);
  const status = stockStatusLabel(product.available, product.threshold);

  return (
    <div
      className={cn(
        "mb-2 overflow-hidden rounded-xl border border-[#eef1f8] transition-all duration-300",
        open ? "bg-[#f8faff]" : "bg-white",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") setOpen(!open);
        }}
        className={cn(
          "group flex cursor-pointer items-center border-none px-4 transition-all hover:bg-[#f4f7fe]/30",
          open && "relative z-10 bg-white shadow-[0_4px_20px_-5px_rgba(0,0,0,0.05)]",
        )}
      >
        <div className="flex min-w-[250px] flex-1 items-center py-4 pr-4 text-sm font-bold text-[#2b3674] transition-colors">
          <div className="leading-snug">{product.name}</div>
        </div>
        <div className="flex w-[140px] items-center text-[11px] font-medium text-[#a3aed0]">
          <div className="leading-tight">{product.categoryName}</div>
        </div>
        <div className="flex w-[100px] items-center justify-center text-center text-sm font-black text-[#2b3674]">
          {formatNumber(product.totalBoxes)}
        </div>
        <div className="flex w-[100px] items-center justify-center text-center text-sm font-bold text-[#a3aed0]">
          {product.unitsPerBox ? formatNumber(product.unitsPerBox) : "—"}
        </div>
        <div className="flex w-[120px] items-center justify-center text-center text-[15px] font-black text-[#2b3674]">
          {formatNumber(product.available)}
        </div>
        <div className="flex w-[100px] items-center justify-center text-center text-sm font-bold text-[#05cd99]">
          +{formatNumber(product.totalIn)}
        </div>
        <div className="flex w-[100px] items-center justify-center text-center text-sm font-bold text-[#ee5d50]">
          -{formatNumber(product.dispatched)}
        </div>
        <div className="flex w-[120px] items-center">
          <span
            className={cn(
              "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm",
              STATUS_CLASSES[status],
            )}
          >
            {status}
          </span>
        </div>
        <div className="flex w-[60px] items-center justify-end">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#f4f7fe]">
            {open ? (
              <ChevronUp className="h-4 w-4 text-[#4318ff]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#a3aed0]" />
            )}
          </span>
        </div>
      </div>

      {open && (
        <div className="block w-full border-none">
          <div className="block w-full border-none p-0">
            <div className="animate-fade-in space-y-8 p-6 md:p-8">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Panel title="Product Information">
                  <InfoItem label="Product Name" value={product.name} />
                  <InfoItem label="SKU" value={product.sku ?? "—"} isMono />
                  <InfoItem label="Category" value={product.categoryName} />
                </Panel>

                <Panel title="Inventory Summary">
                  <InfoItem label="Total Boxes" value={formatNumber(product.totalBoxes)} />
                  <InfoItem
                    label="Units per Box"
                    value={product.unitsPerBox ? formatNumber(product.unitsPerBox) : "—"}
                  />
                  <InfoItem label="Total Units" value={formatNumber(product.available)} highlight />
                  <InfoItem label="Status" value={status} />
                </Panel>

                <Panel title="Warehouse Position">
                  <div className="grid grid-cols-2 gap-3">
                    <PositionCard label="Total Boxes" value={product.totalBoxes} units="Boxes" />
                    <PositionCard
                      label="Total Units"
                      value={product.available}
                      units="Units"
                      color="text-[#4318ff]"
                    />
                    <PositionCard
                      label="Stock IN"
                      value={product.totalIn}
                      units="Units"
                      color="text-[#05cd99]"
                    />
                    <PositionCard
                      label="Stock OUT"
                      value={product.dispatched}
                      units="Units"
                      color="text-[#ee5d50]"
                    />
                  </div>
                </Panel>

                <Panel title="Movement Stats">
                  <InfoItem
                    label="Total Stock IN"
                    value={`${formatNumber(product.totalIn)} Units`}
                  />
                  <InfoItem
                    label="Total Stock OUT"
                    value={`${formatNumber(product.dispatched)} Units`}
                  />
                  <InfoItem
                    label="Current Balance"
                    value={`${formatNumber(product.available)} Units`}
                    highlight
                  />
                  <InfoItem
                    label="Last Updated"
                    value={
                      product.lastMovement
                        ? new Intl.DateTimeFormat("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }).format(new Date(product.lastMovement))
                        : "—"
                    }
                  />
                </Panel>
              </div>

              <div className="grid gap-8 lg:grid-cols-2">
                <div className="rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <Package className="h-4 w-4 text-[#4318ff]" />
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2b3674]">
                      FIFO Batch Inventory
                    </h4>
                  </div>
                  <div className="custom-scrollbar max-h-[300px] space-y-2 overflow-y-auto pr-2">
                    {product.batches.length === 0 ? (
                      <div className="rounded-xl bg-[#f4f7fe] p-4 text-center text-xs italic text-[#a3aed0]">
                        No active batches
                      </div>
                    ) : (
                      product.batches.map((batch) => (
                        <div
                          key={batch.id}
                          className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr] items-center rounded-xl border border-[#f4f7fe] bg-[#f8faff] p-4 text-[11px] transition-colors hover:border-[#4318ff]/20"
                        >
                          <div className="flex flex-col">
                            <span className="text-[9px] font-bold uppercase text-[#a3aed0]">
                              {new Intl.DateTimeFormat("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              }).format(new Date(batch.receivedAt))}
                            </span>
                            <span className="font-black text-[#2b3674]">
                              BATCH #{batch.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span className="text-[9px] font-bold uppercase text-[#a3aed0]">
                              {batch.warehouseName ?? "No warehouse"}
                              {batch.supplierName ? ` · ${batch.supplierName}` : ""}
                              {batch.unitCost !== null
                                ? ` · ${formatMoney(batch.unitCost, settings.currency)}/unit`
                                : ""}
                            </span>
                          </div>
                          <div className="px-2 text-right">
                            <span className="block text-[9px] font-black uppercase text-[#a3aed0]">
                              Boxes
                            </span>
                            <span className="font-bold text-[#2b3674]">
                              {formatNumber(batch.remainingBoxes)} /{" "}
                              {formatNumber(batch.originalBoxes)}
                            </span>
                          </div>
                          <div className="px-2 text-right">
                            <span className="block text-[9px] font-black uppercase text-[#a3aed0]">
                              Ratio
                            </span>
                            <span className="font-bold text-[#2b3674]">
                              {formatNumber(batch.unitsPerBox)}/box
                            </span>
                          </div>
                          <div className="px-2 text-right">
                            <span className="block text-[9px] font-black uppercase text-[#a3aed0]">
                              Units
                            </span>
                            <span className="font-black text-[#4318ff]">
                              {formatNumber(batch.remainingUnits)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span
                              className={cn(
                                "rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider",
                                batch.remainingUnits === 0
                                  ? "bg-gray-100 text-gray-400"
                                  : "bg-[#05cd99]/10 text-[#05cd99]",
                              )}
                            >
                              {batch.status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center gap-2">
                    <History className="h-4 w-4 text-[#4318ff]" />
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2b3674]">
                      Recent Movement History
                    </h4>
                  </div>
                  <div className="custom-scrollbar max-h-[300px] overflow-y-auto overflow-hidden rounded-xl border border-[#f4f7fe] bg-[#f8faff]">
                    <table className="w-full border-collapse text-left">
                      <thead className="bg-[#f4f7fe]/50">
                        <tr>
                          <th className="px-3 py-3 text-[9px] font-black uppercase text-[#a3aed0]">
                            Date
                          </th>
                          <th className="px-3 py-3 text-[9px] font-black uppercase text-[#a3aed0]">
                            Type
                          </th>
                          <th className="px-3 py-3 text-right text-[9px] font-black uppercase text-[#a3aed0]">
                            Qty
                          </th>
                          <th className="px-3 py-3 text-right text-[9px] font-black uppercase text-[#a3aed0]">
                            Balance
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {product.history.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-8 text-center text-xs italic text-[#a3aed0]"
                            >
                              No movement recorded
                            </td>
                          </tr>
                        ) : (
                          product.history.slice(0, 10).map((movement) => (
                            <tr key={movement.id} className="hover:bg-[#f4f7fe]/30">
                              <td className="px-3 py-2 text-[10px] font-medium text-[#a3aed0]">
                                {new Intl.DateTimeFormat("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                }).format(new Date(movement.occurredAt))}
                              </td>
                              <td className="px-3 py-2 text-[10px] font-black uppercase tracking-wider text-[#2b3674]">
                                <span
                                  className={cn(
                                    "rounded px-1.5 py-0.5",
                                    movement.type === "IN"
                                      ? "bg-[#05cd99]/10 text-[#05cd99]"
                                      : "bg-[#ee5d50]/10 text-[#ee5d50]",
                                  )}
                                >
                                  {movement.type === "IN" ? "STOCK IN" : "STOCK OUT"}
                                </span>
                              </td>
                              <td
                                className={cn(
                                  "px-3 py-2 text-right text-[10px] font-black",
                                  movement.qty > 0 ? "text-[#05cd99]" : "text-[#ee5d50]",
                                )}
                              >
                                {movement.qty > 0 ? "+" : ""}
                                {formatNumber(movement.qty)}
                              </td>
                              <td className="px-3 py-2 text-right text-[10px] font-bold text-[#2b3674]">
                                {formatNumber(movement.balance)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Package className="h-4 w-4 text-[#4318ff]" />
        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2b3674]">
          {title}
        </h4>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  isMono = false,
  highlight = false,
}: {
  label: string;
  value: string;
  isMono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#f4f7fe] py-1 last:border-0">
      <span className="text-[9px] font-black uppercase tracking-[0.15em] text-[#a3aed0]">
        {label}
      </span>
      <span
        className={cn(
          "text-xs font-bold text-[#2b3674]",
          isMono && "font-mono text-[11px]",
          highlight && "text-sm font-black text-[#4318ff]",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PositionCard({
  label,
  value,
  units,
  color = "text-[#2b3674]",
}: {
  label: string;
  value: number;
  units: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-[#f4f7fe] bg-[#f4f7fe]/40 p-3">
      <p className="mb-2 text-[8px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <span className={cn("text-base font-black leading-none", color)}>
          {formatNumber(value)}
        </span>
        <span className="text-[8px] font-bold uppercase text-[#a3aed0]">{units}</span>
      </div>
    </div>
  );
}
