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
import { getSupplier, updateSupplier, type SupplierInput } from "@/lib/db/suppliers";
import { listProducts } from "@/lib/db/products";
import { errorMessage } from "@/lib/supabase";
import { formatNumber } from "@/lib/utils";

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const detail = useAsync(
    async () => ({
      supplier: await getSupplier(supplierId),
      products: await listProducts({ supplierId, page: 1, pageSize: 50 }),
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

  const { supplier, products } = detail.data;

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
