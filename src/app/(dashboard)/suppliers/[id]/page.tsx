"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { SupplierForm } from "@/components/modules/SupplierForm";
import { useAsync } from "@/lib/hooks";
import { useSettings } from "@/components/providers/SettingsProvider";
import { getSupplier, updateSupplier, type SupplierInput } from "@/lib/db/suppliers";
import { listProducts } from "@/lib/db/products";
import { listStockIn } from "@/lib/db/stock";
import { errorMessage } from "@/lib/supabase";
import { formatMoney, formatNumber } from "@/lib/utils";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const router = useRouter();
  const toast = useToast();
  const { settings } = useSettings();
  const [saving, setSaving] = useState(false);

  const detail = useAsync(
    async () => ({
      supplier: await getSupplier(supplierId),
      products: await listProducts({ supplierId, page: 1, pageSize: 50 }),
      // Receipts recorded against this supplier. Empty on a database that has
      // not run the warehouse/cost migration, so it must not break the page.
      receipts: await listStockIn({ supplierId, page: 1, pageSize: 50 }).catch(() => null),
    }),
    [supplierId],
  );

  async function handleSubmit(input: SupplierInput) {
    setSaving(true);
    try {
      await updateSupplier(supplierId, input);
      toast.success("Supplier updated.");
      detail.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (detail.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (detail.error || !detail.data) {
    return (
      <Card>
        <ErrorState message={detail.error ?? "Supplier not found."} onRetry={detail.reload} />
      </Card>
    );
  }

  const { supplier, products, receipts } = detail.data;
  const receiptRows = receipts?.rows ?? [];
  const purchased = receiptRows.reduce((sum, row) => sum + Number(row.total_qty ?? 0), 0);
  const spend = receiptRows.reduce(
    (sum, row) => sum + Number(row.total_qty ?? 0) * Number(row.unit_cost ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={supplier.name}
        description={supplier.email ?? supplier.phone ?? "Supplier details"}
        actions={
          <Button variant="secondary" onClick={() => router.push("/suppliers")}>
            Back to suppliers
          </Button>
        }
      />

      <Card padded>
        <h3 className="mb-4 text-sm font-semibold text-slate-900">Edit supplier</h3>
        <SupplierForm
          initial={supplier}
          submitting={saving}
          submitLabel="Save changes"
          onSubmit={handleSubmit}
        />
      </Card>

      <Card>
        <CardHeader
          title="Purchase history"
          subtitle={
            receiptRows.length === 0
              ? "Nothing received from this supplier yet"
              : `${formatNumber(receiptRows.length)} receipt${receiptRows.length === 1 ? "" : "s"} · ` +
                `${formatNumber(purchased)} units · ${formatMoney(spend, settings.currency)}`
          }
        />
        {receiptRows.length === 0 ? (
          <EmptyState
            title="No receipts yet"
            message="Choose this supplier on the Stock IN form and its purchases will appear here."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Product</TH>
                <TH>Warehouse</TH>
                <TH align="right">Units</TH>
                <TH align="right">Unit cost</TH>
                <TH align="right">Total</TH>
              </TR>
            </THead>
            <TBody>
              {receiptRows.map((receipt) => (
                <TR key={receipt.id}>
                  <TD className="text-xs text-slate-500">{receipt.batch_date}</TD>
                  <TD className="font-medium text-slate-900">{receipt.product?.name ?? "—"}</TD>
                  <TD className="text-sm">{receipt.warehouse?.name ?? "—"}</TD>
                  <TD align="right" className="tabular-nums">
                    {formatNumber(receipt.total_qty)}
                  </TD>
                  <TD align="right" className="tabular-nums">
                    {receipt.unit_cost === null
                      ? "—"
                      : formatMoney(receipt.unit_cost, settings.currency)}
                  </TD>
                  <TD align="right" className="tabular-nums font-semibold text-slate-900">
                    {receipt.unit_cost === null
                      ? "—"
                      : formatMoney(
                          Number(receipt.unit_cost) * Number(receipt.total_qty ?? 0),
                          settings.currency,
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
          title="Products from this supplier"
          subtitle={`${products.count} linked product${products.count === 1 ? "" : "s"}`}
        />
        {products.rows.length === 0 ? (
          <EmptyState
            title="No products linked"
            message="Assign this supplier on a product to see it listed here."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Product</TH>
                <TH>SKU</TH>
                <TH>Category</TH>
                <TH align="right">Min stock</TH>
              </TR>
            </THead>
            <TBody>
              {products.rows.map((product) => (
                <TR key={product.id}>
                  <TD className="font-medium text-slate-900">
                    <Link href={`/products/${product.id}`} className="hover:text-brand-600">
                      {product.name}
                    </Link>
                  </TD>
                  <TD className="text-xs text-slate-500">{product.sku ?? "—"}</TD>
                  <TD className="text-sm">{product.category?.name ?? "—"}</TD>
                  <TD align="right" className="tabular-nums">
                    {formatNumber(product.min_stock)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
