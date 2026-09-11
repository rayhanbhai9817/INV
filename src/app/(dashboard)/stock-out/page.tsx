"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { StockOutForm, type StockOutFormValues } from "@/components/modules/StockOutForm";
import { useNotificationsBadge } from "@/components/providers/NotificationsProvider";
import { useAsync } from "@/lib/hooks";
import { allInventory } from "@/lib/db/inventory";
import { listStockOut, recordStockOut } from "@/lib/db/stock";
import { getOpenBatches } from "@/lib/fifo";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import { formatDate, formatNumber } from "@/lib/utils";
import type { StockBatch } from "@/types";

export default function StockOutPage() {
  const toast = useToast();
  const { refresh: refreshBadge } = useNotificationsBadge();
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [pending, setPending] = useState<StockOutFormValues | null>(null);

  const inventory = useAsync(() => allInventory(), [reloadKey]);
  const history = useAsync(
    () => listStockOut({ page, pageSize: DEFAULT_PAGE_SIZE }),
    [page, reloadKey],
  );

  async function handleProductChange(productId: string) {
    if (!productId) {
      setBatches([]);
      return;
    }
    setBatchesLoading(true);
    try {
      setBatches(await getOpenBatches(productId));
    } catch (caught) {
      toast.error(errorMessage(caught));
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  }

  async function handleConfirm() {
    if (!pending) return;
    setSubmitting(true);
    try {
      const result = await recordStockOut(pending.productId, pending.qty, {
        outDate: pending.outDate,
        note: pending.note || null,
      });
      toast.success(
        `Issued ${formatNumber(result.totalIssued)} units from ${result.allocations.length} batch` +
          `${result.allocations.length === 1 ? "" : "es"}.`,
      );
      setPending(null);
      setBatches([]);
      setPage(1);
      setReloadKey((key) => key + 1);
      void refreshBadge();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const pendingProduct = (inventory.data ?? []).find((row) => row.id === pending?.productId);
  const rows = history.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Out"
        description="Issue stock. The oldest batches are consumed first and every deduction is logged."
      />

      <Card padded>
        {inventory.loading ? (
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : inventory.error ? (
          <ErrorState message={inventory.error} onRetry={inventory.reload} />
        ) : (inventory.data ?? []).length === 0 ? (
          <EmptyState title="No products yet" message="Add a product before issuing stock." />
        ) : (
          <StockOutForm
            inventory={inventory.data ?? []}
            batches={batches}
            batchesLoading={batchesLoading}
            submitting={submitting}
            onProductChange={handleProductChange}
            onSubmit={setPending}
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Recent stock out" subtitle="Newest first" />
        {history.loading ? (
          <TableSkeleton cols={4} />
        ) : history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing issued yet" message="Stock Out records will appear here." />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Date</TH>
                  <TH>Product</TH>
                  <TH align="right">Quantity</TH>
                  <TH>Note</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((entry) => (
                  <TR key={entry.id}>
                    <TD className="whitespace-nowrap">{formatDate(entry.out_date)}</TD>
                    <TD className="font-medium text-slate-900">
                      {entry.product?.name ?? "Deleted product"}
                    </TD>
                    <TD align="right" className="tabular-nums">
                      {formatNumber(entry.total_qty)} {entry.product?.unit ?? ""}
                    </TD>
                    <TD className="max-w-[20rem] truncate text-xs text-slate-500">
                      {entry.note ?? "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageSize={history.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={history.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        title="Confirm stock out"
        loading={submitting}
        confirmLabel="Issue stock"
        message={
          <div className="space-y-2">
            <p>
              Issue{" "}
              <strong>
                {formatNumber(pending?.qty ?? 0)} {pendingProduct?.unit ?? "units"}
              </strong>{" "}
              of <strong>{pendingProduct?.name}</strong> on {pending?.outDate}?
            </p>
            <p className="text-xs text-slate-500">
              The oldest batches are deducted first and a ledger entry is written for each batch
              touched. This cannot be undone.
            </p>
          </div>
        }
        onCancel={() => setPending(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}
