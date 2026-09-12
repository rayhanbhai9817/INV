"use client";

import { useMemo, useState } from "react";
import { Inbox, Loader2, Pencil, Plus, Star, X } from "lucide-react";

import { MobileCard, MobileCards } from "@/components/ui/DataCards";
import { useToast } from "@/components/ui/Toast";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useAsync } from "@/lib/hooks";
import {
  allWarehouses,
  createWarehouse,
  deleteWarehouse,
  updateWarehouse,
} from "@/lib/db/warehouses";
import { supabase, errorMessage } from "@/lib/supabase";
import { cn, formatMoney, formatNumber } from "@/lib/utils";
import type { Warehouse } from "@/types";

/** Units and value currently sitting in each warehouse. */
interface WarehouseHolding {
  units: number;
  value: number;
  products: number;
}

async function getHoldings(): Promise<Record<string, WarehouseHolding>> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select("product_id,warehouse_id,remaining_qty,unit_cost")
    .gt("remaining_qty", 0);
  if (error) throw new Error(errorMessage(error));

  const holdings: Record<string, WarehouseHolding & { ids: Set<string> }> = {};

  for (const batch of (data ?? []) as Array<{
    product_id: string;
    warehouse_id: string | null;
    remaining_qty: number;
    unit_cost: number | null;
  }>) {
    if (!batch.warehouse_id) continue;
    const entry = (holdings[batch.warehouse_id] ??= {
      units: 0,
      value: 0,
      products: 0,
      ids: new Set<string>(),
    });
    const remaining = Number(batch.remaining_qty ?? 0);
    entry.units += remaining;
    entry.value += remaining * Number(batch.unit_cost ?? 0);
    entry.ids.add(batch.product_id);
  }

  return Object.fromEntries(
    Object.entries(holdings).map(([id, entry]) => [
      id,
      { units: entry.units, value: entry.value, products: entry.ids.size },
    ]),
  );
}

export default function WarehousesPage() {
  const toast = useToast();
  const { settings } = useSettings();
  const [reloadKey, setReloadKey] = useState(0);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const [removing, setRemoving] = useState<Warehouse | null>(null);
  const [deleting, setDeleting] = useState(false);

  const network = useAsync(async () => {
    const [warehouses, holdings] = await Promise.all([allWarehouses(), getHoldings()]);
    return { warehouses, holdings };
  }, [reloadKey]);

  const warehouses = useMemo(() => network.data?.warehouses ?? [], [network.data]);
  const empty: WarehouseHolding = { units: 0, value: 0, products: 0 };
  const holdingFor = (id: string) => network.data?.holdings[id] ?? empty;

  const totals = useMemo(
    () =>
      warehouses.reduce(
        (sum, warehouse) => {
          const holding = network.data?.holdings[warehouse.id] ?? empty;
          return { units: sum.units + holding.units, value: sum.value + holding.value };
        },
        { units: 0, value: 0 },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [warehouses, network.data],
  );

  function openCreate() {
    setEditingId(null);
    setName("");
    setLocation("");
    setIsDefault(warehouses.length === 0);
    setOpen(true);
  }

  function openEdit(warehouse: Warehouse) {
    setEditingId(warehouse.id);
    setName(warehouse.name);
    setLocation(warehouse.location ?? "");
    setIsDefault(warehouse.is_default);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Warehouse name is required");
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim().slice(0, 120),
        location: location.trim() ? location.trim().slice(0, 300) : null,
        is_default: isDefault,
      };
      if (editingId) {
        await updateWarehouse(editingId, input);
        toast.success("Warehouse updated");
      } else {
        await createWarehouse(input);
        toast.success("Warehouse created");
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
      await deleteWarehouse(removing.id);
      toast.success("Warehouse deleted");
      setRemoving(null);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">Warehouses</h1>
          <p className="text-sm font-medium text-[#a3aed0]">
            Where stock is held. Each receipt lands in one, and each dispatch leaves from one.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="flex h-11 items-center rounded-2xl bg-[#4318ff] px-6 text-sm font-black uppercase tracking-widest text-white shadow-[0_10px_20px_-5px_rgba(67,24,255,0.3)] transition-all hover:bg-[#3311cc]"
          >
            <Plus className="mr-2 h-4 w-4" /> Add warehouse
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Warehouses" value={formatNumber(warehouses.length)} />
        <Stat label="Units Held" value={formatNumber(totals.units)} tone="text-[#4318ff]" />
        <Stat
          label="Stock Value"
          value={formatMoney(totals.value, settings.currency)}
          tone="text-[#05cd99]"
        />
      </div>

      <div className="mb-8 overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
        {network.loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : network.error ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm text-[#ee5d50]">
            <span>{network.error}</span>
            <button
              type="button"
              onClick={network.reload}
              className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
            >
              Try again
            </button>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Inbox className="h-6 w-6" />
            No warehouses yet
          </div>
        ) : (
          <>
            <MobileCards>
              {warehouses.map((warehouse) => {
                const holding = holdingFor(warehouse.id);
                return (
                  <MobileCard
                    key={warehouse.id}
                    title={warehouse.name}
                    subtitle={warehouse.location ?? "No location set"}
                    badge={warehouse.is_default ? <DefaultChip /> : undefined}
                    fields={[
                      {
                        label: "Units Held",
                        value: formatNumber(holding.units),
                        tone: "text-[#4318ff]",
                      },
                      { label: "Products", value: formatNumber(holding.products) },
                      {
                        label: "Stock Value",
                        value: formatMoney(holding.value, settings.currency),
                        tone: "text-[#05cd99]",
                        wide: true,
                      },
                    ]}
                    actions={
                      <>
                        <IconButton label="Edit warehouse" onClick={() => openEdit(warehouse)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Delete warehouse"
                          tone="danger"
                          onClick={() => setRemoving(warehouse)}
                        >
                          <X className="h-4 w-4" />
                        </IconButton>
                      </>
                    }
                  />
                );
              })}
            </MobileCards>

            <div className="custom-scrollbar hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#f4f7fe]">
                    <Th>Name</Th>
                    <Th>Location</Th>
                    <Th align="right">Products</Th>
                    <Th align="right">Units Held</Th>
                    <Th align="right">Stock Value</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {warehouses.map((warehouse) => {
                    const holding = holdingFor(warehouse.id);
                    return (
                      <tr
                        key={warehouse.id}
                        className="border-b border-[#f4f7fe] transition-colors hover:bg-[#f4f7fe]/30"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#2b3674]">{warehouse.name}</span>
                            {warehouse.is_default && <DefaultChip />}
                          </div>
                        </td>
                        <td className="max-w-xs px-6 py-4 font-medium text-[#a3aed0]">
                          {warehouse.location ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-[#2b3674]">
                          {formatNumber(holding.products)}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-[#4318ff]">
                          {formatNumber(holding.units)}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-[#05cd99]">
                          {formatMoney(holding.value, settings.currency)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton label="Edit warehouse" onClick={() => openEdit(warehouse)}>
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label="Delete warehouse"
                              tone="danger"
                              onClick={() => setRemoving(warehouse)}
                            >
                              <X className="h-4 w-4" />
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
      </div>

      {open && (
        <Overlay onClose={() => setOpen(false)}>
          <h2 className="text-lg font-black text-[#2b3674]">
            {editingId ? "Edit warehouse" : "Add warehouse"}
          </h2>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                htmlFor="wh-name"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]"
              >
                Name
              </label>
              <input
                id="wh-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                autoFocus
                placeholder="e.g. Main Warehouse"
                className="h-12 w-full rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] px-4 font-bold text-[#2b3674] outline-none placeholder:font-medium placeholder:text-[#a3aed0] focus:ring-2 focus:ring-[#4318ff]/20"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="wh-location"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]"
              >
                Location
              </label>
              <input
                id="wh-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={300}
                placeholder="Address or area (optional)"
                className="h-12 w-full rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] px-4 font-medium text-[#2b3674] outline-none placeholder:text-[#a3aed0] focus:ring-2 focus:ring-[#4318ff]/20"
              />
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#f4f7fe] p-4">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(event) => setIsDefault(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#4318ff]"
              />
              <span>
                <span className="block text-sm font-bold text-[#2b3674]">Default warehouse</span>
                <span className="block text-xs font-medium text-[#a3aed0]">
                  Pre-selected on the Stock IN and Stock OUT forms. Only one warehouse can hold
                  this, so choosing it here clears it elsewhere.
                </span>
              </span>
            </label>
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
              className="h-11 rounded-2xl bg-[#4318ff] px-6 text-sm font-bold text-white transition hover:bg-[#3311cc] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Overlay>
      )}

      {removing && (
        <Overlay onClose={() => setRemoving(null)}>
          <h2 className="text-lg font-black text-[#2b3674]">Delete warehouse</h2>
          <p className="py-4 text-sm text-[#a3aed0]">
            Delete <span className="font-bold text-[#2b3674]">{removing.name}</span>? This is
            blocked while it still holds stock or appears on past movements.
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

function DefaultChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#4318ff]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.15em] text-[#4318ff]">
      <Star className="h-2.5 w-2.5 fill-current" /> Default
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-[20px] border border-[#f4f7fe] bg-white p-5 shadow-sm">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
        {label}
      </span>
      <p className={cn("mt-2 text-2xl font-black text-[#2b3674]", tone)}>{value}</p>
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
        "px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]",
        align === "right" && "text-right",
      )}
    >
      {children}
    </th>
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
        "flex h-9 w-9 items-center justify-center rounded-lg transition",
        tone === "danger"
          ? "text-[#ee5d50] hover:bg-[#ee5d50]/10"
          : "text-[#2b3674] hover:bg-[#f4f7fe]",
      )}
    >
      {children}
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0b1437]/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-[20px] bg-white p-6 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}
