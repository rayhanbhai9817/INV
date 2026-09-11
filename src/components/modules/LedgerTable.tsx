"use client";

import { Badge } from "@/components/ui/Badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { formatDateTime, formatNumber } from "@/lib/utils";
import type { LedgerEntryWithProduct } from "@/types";

/** Read-only rendering of ledger rows — the log is never edited from the UI. */
export function LedgerTable({
  entries,
  showBatch = true,
}: {
  entries: LedgerEntryWithProduct[];
  showBatch?: boolean;
}) {
  return (
    <Table>
      <THead>
        <TR>
          <TH>When</TH>
          <TH>Product</TH>
          <TH>Type</TH>
          <TH align="right">Qty</TH>
          {showBatch && <TH>Batch reference</TH>}
          <TH>Reference</TH>
        </TR>
      </THead>
      <TBody>
        {entries.map((entry) => (
          <TR key={entry.id}>
            <TD className="whitespace-nowrap text-xs text-slate-500">
              {formatDateTime(entry.created_at)}
            </TD>
            <TD className="font-medium text-slate-900">
              {entry.product?.name ?? "Deleted product"}
            </TD>
            <TD>
              <Badge tone={entry.type === "IN" ? "success" : "warning"}>{entry.type}</Badge>
            </TD>
            <TD align="right" className="tabular-nums">
              {entry.type === "IN" ? "+" : "−"}
              {formatNumber(entry.qty)}
            </TD>
            {showBatch && (
              <TD className="font-mono text-[11px] text-slate-500">
                {entry.batch_id ? entry.batch_id.slice(0, 8) : "—"}
              </TD>
            )}
            <TD className="max-w-[16rem] truncate text-xs text-slate-500">
              {entry.reference ?? "—"}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
