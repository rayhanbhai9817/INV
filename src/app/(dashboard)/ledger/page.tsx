"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, StatCard } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { LedgerTable } from "@/components/modules/LedgerTable";
import { useAsync } from "@/lib/hooks";
import { allProducts } from "@/lib/db/products";
import { exportLedger, listLedger } from "@/lib/db/ledger";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import { downloadCsv, formatDateTime, formatNumber, toCsv } from "@/lib/utils";
import type { LedgerType } from "@/types";

export default function LedgerPage() {
  return (
    <Suspense fallback={<TableSkeleton />}>
      <LedgerView />
    </Suspense>
  );
}

function LedgerView() {
  const searchParams = useSearchParams();
  const toast = useToast();

  const [productId, setProductId] = useState(searchParams.get("product") ?? "");
  const [type, setType] = useState<LedgerType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const products = useAsync(() => allProducts(), []);
  const ledger = useAsync(
    () => listLedger({ productId, type, dateFrom, dateTo, page, pageSize: DEFAULT_PAGE_SIZE }),
    [productId, type, dateFrom, dateTo, page],
  );

  const rows = ledger.data?.rows ?? [];
  const inTotal = rows
    .filter((row) => row.type === "IN")
    .reduce((sum, row) => sum + row.qty, 0);
  const outTotal = rows
    .filter((row) => row.type === "OUT")
    .reduce((sum, row) => sum + row.qty, 0);

  async function handleExport() {
    setExporting(true);
    try {
      const entries = await exportLedger({ productId, type, dateFrom, dateTo });
      const csv = toCsv(
        ["When", "Product", "SKU", "Type", "Qty", "Batch ID", "Reference"],
        entries.map((entry) => [
          formatDateTime(entry.created_at),
          entry.product?.name ?? "",
          entry.product?.sku ?? "",
          entry.type,
          entry.qty,
          entry.batch_id ?? "",
          entry.reference ?? "",
        ]),
      );
      downloadCsv("ledger.csv", csv);
      toast.success(`Exported ${entries.length} entries.`);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setProductId("");
    setType("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ledger Account"
        description="Immutable audit log. Every Stock In and every FIFO deduction, with its batch reference."
        actions={
          <>
            <Button variant="secondary" onClick={resetFilters}>
              Reset filters
            </Button>
            <Button onClick={handleExport} loading={exporting} disabled={rows.length === 0}>
              Export CSV
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Entries (filtered)" value={formatNumber(ledger.data?.count ?? 0)} />
        <StatCard label="IN on this page" value={formatNumber(inTotal)} tone="success" />
        <StatCard label="OUT on this page" value={formatNumber(outTotal)} tone="warning" />
      </div>

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <Select
            value={type}
            onChange={(event) => {
              setType(event.target.value as LedgerType | "");
              setPage(1);
            }}
            placeholder="IN and OUT"
            options={[
              { value: "IN", label: "Stock In only" },
              { value: "OUT", label: "Stock Out only" },
            ]}
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

        {ledger.loading ? (
          <TableSkeleton cols={6} />
        ) : ledger.error ? (
          <ErrorState message={ledger.error} onRetry={ledger.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No ledger entries"
            message="Nothing matches these filters yet. Record a Stock In or Stock Out to populate the ledger."
          />
        ) : (
          <>
            <LedgerTable entries={rows} />
            <Pagination
              page={page}
              pageSize={ledger.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={ledger.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
