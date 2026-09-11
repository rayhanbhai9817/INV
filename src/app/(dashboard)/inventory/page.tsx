"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { Select } from "@/components/ui/Select";
import { StockStatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAsync } from "@/lib/hooks";
import { allCategories } from "@/lib/db/categories";
import { allSuppliers } from "@/lib/db/suppliers";
import { listInventory } from "@/lib/db/inventory";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { downloadCsv, formatNumber, toCsv } from "@/lib/utils";
import type { StockStatus } from "@/types";

const STATUS_OPTIONS = [
  { value: "ok", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

export default function InventoryPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <InventoryView />
    </Suspense>
  );
}

function InventoryView() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StockStatus | "">(
    (searchParams.get("status") as StockStatus | null) ?? "",
  );
  const [categoryId, setCategoryId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [page, setPage] = useState(1);

  const categories = useAsync(() => allCategories(), []);
  const suppliers = useAsync(() => allSuppliers(), []);
  const inventory = useAsync(
    () =>
      listInventory({ search, status, categoryId, supplierId, page, pageSize: DEFAULT_PAGE_SIZE }),
    [search, status, categoryId, supplierId, page],
  );

  const rows = inventory.data?.rows ?? [];
  const lowCount = rows.filter((row) => row.stock_status === "low_stock").length;
  const outCount = rows.filter((row) => row.stock_status === "out_of_stock").length;
  const unitsOnPage = rows.reduce((sum, row) => sum + row.current_stock, 0);

  function handleExport() {
    const csv = toCsv(
      ["Product", "SKU", "Unit", "Current stock", "Min stock", "Status"],
      rows.map((row) => [
        row.name,
        row.sku ?? "",
        row.unit,
        row.current_stock,
        row.min_stock,
        row.stock_status,
      ]),
    );
    downloadCsv("inventory.csv", csv);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Live stock position per product, straight from the open batches."
        actions={
          <Button variant="secondary" onClick={handleExport} disabled={rows.length === 0}>
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Products listed" value={formatNumber(inventory.data?.count ?? 0)} />
        <StatCard
          label="Low stock (this page)"
          value={formatNumber(lowCount)}
          tone={lowCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Out of stock (this page)"
          value={formatNumber(outCount)}
          tone={outCount > 0 ? "danger" : "default"}
        />
      </div>

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
            className="w-auto min-w-[9rem]"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StockStatus | "");
              setPage(1);
            }}
            placeholder="All statuses"
            options={STATUS_OPTIONS}
          />
          <Select
            className="w-auto min-w-[9rem]"
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
            className="w-auto min-w-[9rem]"
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
          <span className="ml-auto text-xs text-slate-500">
            {formatNumber(unitsOnPage)} units on this page
          </span>
        </div>

        {inventory.loading ? (
          <TableSkeleton cols={5} />
        ) : inventory.error ? (
          <ErrorState message={inventory.error} onRetry={inventory.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            message="No product matches the current filters."
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
                  <TH align="right">Current stock</TH>
                  <TH align="right">Min stock</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR
                    key={row.id}
                    className={
                      row.stock_status === "out_of_stock"
                        ? "bg-red-50/40"
                        : row.stock_status === "low_stock"
                          ? "bg-amber-50/40"
                          : undefined
                    }
                  >
                    <TD className="font-medium text-slate-900">
                      <Link href={`/products/${row.id}`} className="hover:text-brand-600">
                        {row.name}
                      </Link>
                    </TD>
                    <TD className="text-xs text-slate-500">{row.sku ?? "—"}</TD>
                    <TD align="right" className="tabular-nums font-semibold text-slate-900">
                      {formatNumber(row.current_stock)} {row.unit}
                    </TD>
                    <TD align="right" className="tabular-nums text-slate-500">
                      {formatNumber(row.min_stock)}
                    </TD>
                    <TD>
                      <StockStatusBadge status={row.stock_status} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageSize={inventory.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={inventory.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
