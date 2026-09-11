"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Badge, StockStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { ErrorState, Skeleton, EmptyState } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductForm } from "@/components/modules/ProductForm";
import { useAsync } from "@/lib/hooks";
import { allCategories } from "@/lib/db/categories";
import { allSuppliers } from "@/lib/db/suppliers";
import { getProduct, updateProduct, type ProductInput } from "@/lib/db/products";
import { getInventoryRow } from "@/lib/db/inventory";
import { listBatchesForProduct } from "@/lib/db/stock";
import { listLedger } from "@/lib/db/ledger";
import { errorMessage } from "@/lib/supabase";
import { formatDate, formatDateTime, formatNumber } from "@/lib/utils";

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const detail = useAsync(
    async () => ({
      product: await getProduct(productId),
      categories: await allCategories(),
      suppliers: await allSuppliers(),
      inventory: await getInventoryRow(productId),
      batches: await listBatchesForProduct(productId),
      ledger: await listLedger({ productId, page: 1, pageSize: 10 }),
    }),
    [productId],
  );

  async function handleSubmit(input: ProductInput) {
    setSubmitting(true);
    try {
      await updateProduct(productId, input);
      toast.success("Product updated.");
      detail.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  if (detail.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (detail.error || !detail.data) {
    return (
      <Card>
        <ErrorState message={detail.error ?? "Product not found."} onRetry={detail.reload} />
      </Card>
    );
  }

  const { product, categories, suppliers, inventory, batches, ledger } = detail.data;
  const openBatches = batches.filter((batch) => batch.remaining_qty > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku ?? "—"} · measured in ${product.unit}`}
        actions={
          <>
            <Link href="/stock-in">
              <Button variant="secondary">Stock In</Button>
            </Link>
            <Link href="/stock-out">
              <Button variant="secondary">Stock Out</Button>
            </Link>
            <Button variant="ghost" onClick={() => router.push("/products")}>
              Back
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="On hand"
          value={`${formatNumber(inventory?.current_stock ?? 0)} ${product.unit}`}
          hint={`Minimum ${formatNumber(product.min_stock)}`}
        />
        <StatCard label="Open batches" value={formatNumber(openBatches.length)} hint="FIFO queue" />
        <StatCard
          label="Category"
          value={product.category?.name ?? "—"}
          hint={product.supplier?.name ?? "No supplier"}
        />
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          {inventory ? (
            <StockStatusBadge status={inventory.stock_status} />
          ) : (
            <Badge>Unknown</Badge>
          )}
        </div>
      </div>

      <Card padded>
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Edit product</h3>
        <ProductForm
          initial={product}
          categories={categories}
          suppliers={suppliers}
          submitting={submitting}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
        />
      </Card>

      <Card>
        <CardHeader title="Stock batches" subtitle="Oldest first — the order FIFO consumes them" />
        {batches.length === 0 ? (
          <EmptyState title="No batches" message="Record a Stock In to create the first batch." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Batch date</TH>
                <TH align="right">Boxes</TH>
                <TH align="right">Qty / box</TH>
                <TH align="right">Received</TH>
                <TH align="right">Remaining</TH>
                <TH>State</TH>
              </TR>
            </THead>
            <TBody>
              {batches.map((batch) => (
                <TR key={batch.id}>
                  <TD>{formatDate(batch.batch_date)}</TD>
                  <TD align="right" className="tabular-nums">{formatNumber(batch.box_count)}</TD>
                  <TD align="right" className="tabular-nums">{formatNumber(batch.qty_per_box)}</TD>
                  <TD align="right" className="tabular-nums">{formatNumber(batch.total_qty)}</TD>
                  <TD align="right" className="tabular-nums font-medium text-slate-900">
                    {formatNumber(batch.remaining_qty)}
                  </TD>
                  <TD>
                    {batch.remaining_qty === 0 ? (
                      <Badge tone="neutral">Depleted</Badge>
                    ) : batch.remaining_qty < batch.total_qty ? (
                      <Badge tone="warning">Partially used</Badge>
                    ) : (
                      <Badge tone="success">Full</Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Recent ledger entries"
          action={
            <Link
              href={`/ledger?product=${product.id}`}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              View all
            </Link>
          }
        />
        {ledger.rows.length === 0 ? (
          <EmptyState title="No ledger entries" message="Stock movements will appear here." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Type</TH>
                <TH align="right">Qty</TH>
                <TH>Reference</TH>
              </TR>
            </THead>
            <TBody>
              {ledger.rows.map((entry) => (
                <TR key={entry.id}>
                  <TD className="whitespace-nowrap text-xs text-slate-500">
                    {formatDateTime(entry.created_at)}
                  </TD>
                  <TD>
                    <Badge tone={entry.type === "IN" ? "success" : "warning"}>{entry.type}</Badge>
                  </TD>
                  <TD align="right" className="tabular-nums">{formatNumber(entry.qty)}</TD>
                  <TD className="text-xs text-slate-500">{entry.reference ?? "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
