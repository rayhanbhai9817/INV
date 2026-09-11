"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAsync } from "@/lib/hooks";
import { allCategories } from "@/lib/db/categories";
import { allSuppliers } from "@/lib/db/suppliers";
import { deleteProduct, listProducts } from "@/lib/db/products";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import { formatNumber } from "@/lib/utils";
import type { ProductWithRelations } from "@/types";

export default function ProductsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<ProductWithRelations | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categories = useAsync(() => allCategories(), []);
  const suppliers = useAsync(() => allSuppliers(), []);
  const products = useAsync(
    () => listProducts({ search, categoryId, supplierId, page, pageSize: DEFAULT_PAGE_SIZE }),
    [search, categoryId, supplierId, page],
  );

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteProduct(pendingDelete.id);
      toast.success(`“${pendingDelete.name}” deleted.`);
      setPendingDelete(null);
      products.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  const rows = products.data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Every item you track, with its category, supplier and minimum stock level."
        actions={
          <Link href="/products/new">
            <Button>Add product</Button>
          </Link>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search name or SKU…"
          />
          <Select
            className="w-auto min-w-[10rem]"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value);
              setPage(1);
            }}
            placeholder="All categories"
            options={(categories.data ?? []).map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
          <Select
            className="w-auto min-w-[10rem]"
            value={supplierId}
            onChange={(event) => {
              setSupplierId(event.target.value);
              setPage(1);
            }}
            placeholder="All suppliers"
            options={(suppliers.data ?? []).map((supplier) => ({
              value: supplier.id,
              label: supplier.name,
            }))}
          />
        </div>

        {products.loading ? (
          <TableSkeleton cols={6} />
        ) : products.error ? (
          <ErrorState message={products.error} onRetry={products.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No products found"
            message={
              search || categoryId || supplierId
                ? "No product matches the current filters."
                : "Add your first product to start tracking stock."
            }
            action={
              <Link href="/products/new">
                <Button size="sm">Add product</Button>
              </Link>
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>SKU</TH>
                  <TH>Category</TH>
                  <TH>Supplier</TH>
                  <TH align="right">Min stock</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((product) => (
                  <TR key={product.id}>
                    <TD className="font-medium text-slate-900">
                      <Link href={`/products/${product.id}`} className="hover:text-brand-600">
                        {product.name}
                      </Link>
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {product.unit}
                      </span>
                    </TD>
                    <TD className="text-xs text-slate-500">{product.sku ?? "—"}</TD>
                    <TD>
                      {product.category ? (
                        <Badge tone="info">{product.category.name}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TD>
                    <TD className="text-sm">{product.supplier?.name ?? "—"}</TD>
                    <TD align="right" className="tabular-nums">
                      {formatNumber(product.min_stock)}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/products/${product.id}`}>
                          <Button size="sm" variant="secondary">
                            Edit
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setPendingDelete(product)}
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
              pageSize={products.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={products.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete product"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Delete <strong>{pendingDelete?.name}</strong>? Products with recorded stock movements
            cannot be deleted — their ledger history must stay intact.
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
