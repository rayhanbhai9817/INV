"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StockStatusBadge } from "@/components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { LedgerTable } from "@/components/modules/LedgerTable";
import { useAsync } from "@/lib/hooks";
import { allProducts } from "@/lib/db/products";
import { allSuppliers } from "@/lib/db/suppliers";
import { listInventory } from "@/lib/db/inventory";
import { listLedger } from "@/lib/db/ledger";
import { listStockIn, listStockOut } from "@/lib/db/stock";
import { cn, downloadCsv, formatDate, formatDateTime, formatNumber, toCsv } from "@/lib/utils";
import type {
  InventoryRow,
  LedgerEntryWithProduct,
  Paginated,
  StockBatchWithProduct,
  StockOutWithProduct,
} from "@/types";

type ReportKey = "stock_in" | "stock_out" | "ledger" | "low_stock" | "supplier";

const REPORTS: Array<{ key: ReportKey; label: string; description: string }> = [
  { key: "stock_in", label: "Stock In", description: "Batches received in the period." },
  { key: "stock_out", label: "Stock Out", description: "Quantities issued in the period." },
  { key: "ledger", label: "Ledger", description: "Every IN and OUT movement with its batch." },
  { key: "low_stock", label: "Low Stock", description: "Products at or below their minimum." },
  { key: "supplier", label: "Supplier", description: "Products grouped by supplier." },
];

const REPORT_LIMIT = 500;

export default function ReportsPage() {
  const toast = useToast();
  const [report, setReport] = useState<ReportKey>("stock_in");
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const products = useAsync(() => allProducts(), []);
  const suppliers = useAsync(() => allSuppliers(), []);

  const data = useAsync(async () => {
    const paging = { page: 1, pageSize: REPORT_LIMIT };
    switch (report) {
      case "stock_in":
        return { kind: "stock_in" as const, ...(await listStockIn({ productId, dateFrom, dateTo, ...paging })) };
      case "stock_out":
        return { kind: "stock_out" as const, ...(await listStockOut({ productId, dateFrom, dateTo, ...paging })) };
      case "ledger":
        return { kind: "ledger" as const, ...(await listLedger({ productId, dateFrom, dateTo, ...paging })) };
      case "low_stock":
        return { kind: "low_stock" as const, ...(await listInventory({ supplierId, ...paging })) };
      case "supplier":
      default:
        return { kind: "supplier" as const, ...(await listInventory({ supplierId, ...paging })) };
    }
  }, [report, productId, supplierId, dateFrom, dateTo]);

  const usesDates = report === "stock_in" || report === "stock_out" || report === "ledger";
  const usesProduct = usesDates;
  const usesSupplier = report === "supplier" || report === "low_stock";

  function handleExport() {
    if (!data.data) return;

    if (data.data.kind === "stock_in") {
      downloadCsv(
        "report-stock-in.csv",
        toCsv(
          ["Batch date", "Product", "SKU", "Boxes", "Qty per box", "Total", "Remaining"],
          data.data.rows.map((row) => [
            row.batch_date,
            row.product?.name ?? "",
            row.product?.sku ?? "",
            row.box_count,
            row.qty_per_box,
            row.total_qty,
            row.remaining_qty,
          ]),
        ),
      );
    } else if (data.data.kind === "stock_out") {
      downloadCsv(
        "report-stock-out.csv",
        toCsv(
          ["Date", "Product", "SKU", "Quantity", "Note"],
          data.data.rows.map((row) => [
            row.out_date,
            row.product?.name ?? "",
            row.product?.sku ?? "",
            row.total_qty,
            row.note ?? "",
          ]),
        ),
      );
    } else if (data.data.kind === "ledger") {
      downloadCsv(
        "report-ledger.csv",
        toCsv(
          ["When", "Product", "Type", "Qty", "Batch ID", "Reference"],
          data.data.rows.map((row) => [
            formatDateTime(row.created_at),
            row.product?.name ?? "",
            row.type,
            row.qty,
            row.batch_id ?? "",
            row.reference ?? "",
          ]),
        ),
      );
    } else {
      const rows =
        data.data.kind === "low_stock"
          ? data.data.rows.filter((row) => row.stock_status !== "ok")
          : data.data.rows;
      downloadCsv(
        data.data.kind === "low_stock" ? "report-low-stock.csv" : "report-supplier.csv",
        toCsv(
          ["Product", "SKU", "Unit", "Current stock", "Min stock", "Status"],
          rows.map((row) => [
            row.name,
            row.sku ?? "",
            row.unit,
            row.current_stock,
            row.min_stock,
            row.stock_status,
          ]),
        ),
      );
    }
    toast.success("Report exported.");
  }

  function resetFilters() {
    setProductId("");
    setSupplierId("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Filterable views over stock movements, the ledger, low stock and suppliers."
        actions={
          <>
            <Button variant="secondary" onClick={resetFilters}>
              Reset
            </Button>
            <Button onClick={handleExport} disabled={data.loading || !data.data}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {REPORTS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setReport(item.key)}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-medium transition",
              report === item.key
                ? "border-brand-200 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {usesProduct && (
            <Select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder="All products"
              options={(products.data ?? []).map((product) => ({
                value: product.id,
                label: product.name,
              }))}
            />
          )}
          {usesSupplier && (
            <Select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              placeholder="All suppliers"
              options={(suppliers.data ?? []).map((supplier) => ({
                value: supplier.id,
                label: supplier.name,
              }))}
            />
          )}
          {usesDates && (
            <>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                aria-label="From date"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                aria-label="To date"
              />
            </>
          )}
          <p className="self-center text-xs text-slate-500 lg:col-span-4">
            {REPORTS.find((item) => item.key === report)?.description} Showing up to {REPORT_LIMIT}{" "}
            rows.
          </p>
        </div>

        {data.loading ? (
          <TableSkeleton cols={6} />
        ) : data.error ? (
          <ErrorState message={data.error} onRetry={data.reload} />
        ) : !data.data ? null : (
          <ReportBody data={data.data} />
        )}
      </Card>
    </div>
  );
}

type ReportData =
  | ({ kind: "stock_in" } & Paginated<StockBatchWithProduct>)
  | ({ kind: "stock_out" } & Paginated<StockOutWithProduct>)
  | ({ kind: "ledger" } & Paginated<LedgerEntryWithProduct>)
  | ({ kind: "low_stock" } & Paginated<InventoryRow>)
  | ({ kind: "supplier" } & Paginated<InventoryRow>);

function ReportBody({ data }: { data: ReportData }) {
  if (data.kind === "stock_in") {
    if (data.rows.length === 0)
      return <EmptyState title="No stock in records" message="Nothing received in this period." />;
    return (
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
          {data.rows.map((row) => (
            <TR key={row.id}>
              <TD className="whitespace-nowrap">{formatDate(row.batch_date)}</TD>
              <TD className="font-medium text-slate-900">{row.product?.name ?? "—"}</TD>
              <TD align="right" className="tabular-nums">{formatNumber(row.box_count)}</TD>
              <TD align="right" className="tabular-nums">{formatNumber(row.qty_per_box)}</TD>
              <TD align="right" className="tabular-nums">{formatNumber(row.total_qty)}</TD>
              <TD align="right" className="tabular-nums">{formatNumber(row.remaining_qty)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    );
  }

  if (data.kind === "stock_out") {
    if (data.rows.length === 0)
      return <EmptyState title="No stock out records" message="Nothing issued in this period." />;
    return (
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
          {data.rows.map((row) => (
            <TR key={row.id}>
              <TD className="whitespace-nowrap">{formatDate(row.out_date)}</TD>
              <TD className="font-medium text-slate-900">{row.product?.name ?? "—"}</TD>
              <TD align="right" className="tabular-nums">{formatNumber(row.total_qty)}</TD>
              <TD className="text-xs text-slate-500">{row.note ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    );
  }

  if (data.kind === "ledger") {
    if (data.rows.length === 0)
      return <EmptyState title="No ledger entries" message="No movement matches these filters." />;
    return <LedgerTable entries={data.rows} />;
  }

  const rows = data.kind === "low_stock" ? data.rows.filter((row) => row.stock_status !== "ok") : data.rows;

  if (rows.length === 0) {
    return (
      <EmptyState
        title={data.kind === "low_stock" ? "Nothing is low on stock" : "No products"}
        message={
          data.kind === "low_stock"
            ? "Every product is above its minimum level."
            : "No product matches this supplier."
        }
      />
    );
  }

  return (
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
          <TR key={row.id}>
            <TD className="font-medium text-slate-900">{row.name}</TD>
            <TD className="text-xs text-slate-500">{row.sku ?? "—"}</TD>
            <TD align="right" className="tabular-nums">
              {formatNumber(row.current_stock)} {row.unit}
            </TD>
            <TD align="right" className="tabular-nums">{formatNumber(row.min_stock)}</TD>
            <TD>
              <StockStatusBadge status={row.stock_status} />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
