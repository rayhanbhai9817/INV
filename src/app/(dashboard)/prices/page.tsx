"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { PriceForm } from "@/components/modules/PriceForm";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useAsync } from "@/lib/hooks";
import { allProducts } from "@/lib/db/products";
import { createPrice, deletePrice, listPrices, updatePrice, type PriceInput } from "@/lib/db/prices";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import { downloadCsv, formatDate, formatMoney, formatNumber, toCsv } from "@/lib/utils";
import type { ProductPriceWithProduct } from "@/types";

export default function PricesPage() {
  const toast = useToast();
  const { settings } = useSettings();

  const [productId, setProductId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ProductPriceWithProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProductPriceWithProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const products = useAsync(() => allProducts(), []);
  const prices = useAsync(
    () => listPrices({ productId, dateFrom, dateTo, page, pageSize: DEFAULT_PAGE_SIZE }),
    [productId, dateFrom, dateTo, page],
  );

  async function handleSave(input: PriceInput) {
    setSaving(true);
    try {
      if (editing) {
        await updatePrice(editing.id, input);
        toast.success("Price updated.");
      } else {
        await createPrice(input);
        toast.success("Price added.");
      }
      setCreating(false);
      setEditing(null);
      prices.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deletePrice(pendingDelete.id);
      toast.success("Price entry deleted.");
      setPendingDelete(null);
      prices.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  const rows = prices.data?.rows ?? [];
  const pageTotal = rows.reduce((sum, row) => sum + Number(row.total_price ?? 0), 0);

  function handleExport() {
    downloadCsv(
      "product-prices.csv",
      toCsv(
        ["Date", "Product", "SKU", "Unit price", "Unit", "Total price", "Note"],
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Price"
        description="Standalone price book: unit price × unit = total. It does not affect stock or the ledger."
        actions={
          <>
            <Button variant="secondary" onClick={handleExport} disabled={rows.length === 0}>
              Export CSV
            </Button>
            <Button onClick={() => setCreating(true)}>Add price</Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Entries (filtered)" value={formatNumber(prices.data?.count ?? 0)} />
        <StatCard
          label="Total value on this page"
          value={formatMoney(pageTotal, settings.currency)}
        />
      </div>

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setPage(1);
            }}
            placeholder="All products"
            options={(products.data ?? []).map((product) => ({
              value: product.id,
              label: product.name,
            }))}
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
            aria-label="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
            aria-label="To date"
          />
        </div>

        {prices.loading ? (
          <TableSkeleton cols={6} />
        ) : prices.error ? (
          <ErrorState message={prices.error} onRetry={prices.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No price entries"
            message="Record a unit price to build the price book."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                Add price
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Product</TH>
                  <TH align="right">Unit price</TH>
                  <TH align="right">Unit</TH>
                  <TH align="right">Total</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap">{formatDate(row.date)}</TD>
                    <TD className="font-medium text-slate-900">
                      {row.product?.name ?? "Deleted product"}
                      {row.note && (
                        <span className="ml-2 text-xs font-normal text-slate-400">{row.note}</span>
                      )}
                    </TD>
                    <TD align="right" className="tabular-nums">
                      {formatMoney(row.unit_price, settings.currency)}
                    </TD>
                    <TD align="right" className="tabular-nums">{formatNumber(row.unit)}</TD>
                    <TD align="right" className="tabular-nums font-semibold text-slate-900">
                      {formatMoney(row.total_price, settings.currency)}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(row)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setPendingDelete(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageSize={prices.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={prices.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={creating || Boolean(editing)}
        title={editing ? "Edit price entry" : "Add price entry"}
        description="Total price is generated by the database from unit price × unit."
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      >
        <PriceForm
          products={products.data ?? []}
          initial={editing}
          currency={settings.currency}
          submitting={saving}
          submitLabel={editing ? "Save changes" : "Add price"}
          onSubmit={handleSave}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete price entry"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message="Delete this price entry? Stock and ledger data are unaffected."
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
