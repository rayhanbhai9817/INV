"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { StockInForm, type StockInFormValues } from "@/components/modules/StockInForm";
import { useAsync } from "@/lib/hooks";
import { allInventory } from "@/lib/db/inventory";
import { listStockIn, recordStockIn } from "@/lib/db/stock";
import { useNotificationsBadge } from "@/components/providers/NotificationsProvider";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import { formatDate, formatNumber } from "@/lib/utils";

export default function StockInPage() {
  const toast = useToast();
  const { refresh: refreshBadge } = useNotificationsBadge();
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  const inventory = useAsync(() => allInventory(), [reloadKey]);
  const history = useAsync(
    () => listStockIn({ page, pageSize: DEFAULT_PAGE_SIZE }),
    [page, reloadKey],
  );

  async function handleSubmit(values: StockInFormValues) {
    setSubmitting(true);
    try {
      const result = await recordStockIn({
        productId: values.productId,
        boxCount: values.boxCount,
        qtyPerBox: values.qtyPerBox,
        batchDate: values.batchDate,
        reference: values.note || null,
      });
      toast.success(
        `Stock In recorded — ${formatNumber(result.totalQty)} units added and written to the ledger.`,
      );
      setPage(1);
      setReloadKey((key) => key + 1);
      void refreshBadge();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const rows = history.data?.rows ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock In"
        description="Receive stock as a batch. Total is calculated for you and the ledger is updated automatically."
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
          <EmptyState
            title="No products yet"
            message="Add a product before recording stock."
          />
        ) : (
          <StockInForm
            inventory={inventory.data ?? []}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Recent stock in batches" subtitle="Newest first" />
        {history.loading ? (
          <TableSkeleton cols={6} />
        ) : history.error ? (
          <ErrorState message={history.error} onRetry={history.reload} />
        ) : rows.length === 0 ? (
          <EmptyState title="No batches yet" message="Your first Stock In will show up here." />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Batch date</TH>
                  <TH>Product</TH>
                  <TH align="right">Boxes</TH>
                  <TH align="right">Qty / box</TH>
                  <TH align="right">Total</TH>
                  <TH align="right">Remaining</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((batch) => (
                  <TR key={batch.id}>
                    <TD className="whitespace-nowrap">{formatDate(batch.batch_date)}</TD>
                    <TD className="font-medium text-slate-900">
                      {batch.product?.name ?? "Deleted product"}
                    </TD>
                    <TD align="right" className="tabular-nums">{formatNumber(batch.box_count)}</TD>
                    <TD align="right" className="tabular-nums">{formatNumber(batch.qty_per_box)}</TD>
                    <TD align="right" className="tabular-nums font-medium text-slate-900">
                      {formatNumber(batch.total_qty)}
                    </TD>
                    <TD align="right" className="tabular-nums">
                      {formatNumber(batch.remaining_qty)}
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
    </div>
  );
}
