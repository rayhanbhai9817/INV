"use client";

/**
 * FIFO stock engine — the single source of truth for how stock moves.
 *
 * Nothing in this file may be duplicated inside a React component: pages call
 * `processStockIn` / `processStockOut` and render whatever comes back.
 *
 * Invariants enforced here:
 *   - stock can never go negative: an issue larger than the on-hand total is
 *     rejected before a single batch is touched;
 *   - every IN and every OUT writes a ledger row carrying its batch reference;
 *   - batches are consumed strictly oldest-first (batch_date, then created_at).
 *
 * PostgREST has no client-side transaction, so each batch is decremented with
 * an optimistic-concurrency guard (`remaining_qty` must still equal what we
 * read). If another issue slipped in between the read and the write, that batch
 * is re-read and retried instead of being overwritten. If a later step fails
 * mid-run, the deductions already applied are compensated back.
 */

import { supabase, errorMessage } from "@/lib/supabase";
import { planFifoAllocations, sortBatchesForFifo } from "@/lib/fifo-plan";
import type { FifoAllocation, StockBatch, StockOutResult } from "@/types";
import { todayISO } from "@/lib/utils";

/** Raised for business-rule failures (insufficient stock, bad input). */
export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

const MAX_BATCH_RETRIES = 5;

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Open batches for a product, oldest first — the FIFO pick list. */
export async function getOpenBatches(productId: string): Promise<StockBatch[]> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select("*")
    .eq("product_id", productId)
    .gt("remaining_qty", 0)
    .order("batch_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(errorMessage(error));
  return (data ?? []) as StockBatch[];
}

/** Total units on hand for a product (sum of every open batch). */
export async function getAvailableStock(productId: string): Promise<number> {
  const { data, error } = await supabase
    .from("stock_batches")
    .select("remaining_qty")
    .eq("product_id", productId)
    .gt("remaining_qty", 0);

  if (error) throw new Error(errorMessage(error));
  return (data ?? []).reduce((sum, row) => sum + Number(row.remaining_qty ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Stock In
// ---------------------------------------------------------------------------

export interface StockInInput {
  productId: string;
  boxCount: number;
  qtyPerBox: number;
  batchDate?: string;
  reference?: string | null;
}

export interface StockInResult {
  batch: StockBatch;
  totalQty: number;
}

/**
 * Receive stock: one new batch plus its ledger IN entry.
 * total_qty = box_count x qty_per_box, and remaining_qty starts at total_qty.
 */
export async function processStockIn(input: StockInInput): Promise<StockInResult> {
  const boxCount = Math.trunc(Number(input.boxCount));
  const qtyPerBox = Math.trunc(Number(input.qtyPerBox));

  if (!input.productId) throw new StockError("Select a product before receiving stock.");
  if (!Number.isFinite(boxCount) || boxCount <= 0) {
    throw new StockError("Box count must be a whole number greater than zero.");
  }
  if (!Number.isFinite(qtyPerBox) || qtyPerBox <= 0) {
    throw new StockError("Qty per box must be a whole number greater than zero.");
  }

  const totalQty = boxCount * qtyPerBox;
  const batchDate = input.batchDate || todayISO();

  const { data: batch, error: batchError } = await supabase
    .from("stock_batches")
    .insert({
      product_id: input.productId,
      box_count: boxCount,
      qty_per_box: qtyPerBox,
      total_qty: totalQty,
      remaining_qty: totalQty,
      batch_date: batchDate,
    })
    .select("*")
    .single();

  if (batchError || !batch) throw new Error(errorMessage(batchError));

  const { error: ledgerError } = await supabase.from("ledger").insert({
    product_id: input.productId,
    type: "IN",
    qty: totalQty,
    batch_id: batch.id,
    reference: input.reference ?? `Stock In ${boxCount} box x ${qtyPerBox}`,
  });

  if (ledgerError) {
    // A batch with no ledger entry would break the audit trail — undo it.
    await supabase.from("stock_batches").delete().eq("id", batch.id);
    throw new Error(errorMessage(ledgerError));
  }

  return { batch: batch as StockBatch, totalQty };
}

// ---------------------------------------------------------------------------
// Stock Out (FIFO)
// ---------------------------------------------------------------------------

export interface StockOutOptions {
  outDate?: string;
  note?: string | null;
  reference?: string | null;
}

/**
 * Issue `qty` units of a product, consuming the oldest batches first.
 *
 * Blocks with a clear error when the requested quantity exceeds what is on
 * hand — no partial issue, no negative stock.
 */
export async function processStockOut(
  productId: string,
  qty: number,
  options: StockOutOptions = {},
): Promise<StockOutResult> {
  const requested = Math.trunc(Number(qty));

  if (!productId) throw new StockError("Select a product before issuing stock.");
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new StockError("Quantity must be a whole number greater than zero.");
  }

  const batches = await getOpenBatches(productId);
  const plan = planFifoAllocations(batches, requested);

  if (plan.shortfall > 0) {
    throw new StockError(
      `Not enough stock. Requested ${requested}, available ${plan.available}. ` +
        `Short by ${plan.shortfall}.`,
    );
  }

  const allocations: FifoAllocation[] = [];
  let needed = requested;

  try {
    for (const batch of sortBatchesForFifo(batches)) {
      if (needed === 0) break;

      const applied = await deductFromBatch(batch, needed);
      if (applied === 0) continue; // batch was drained by a concurrent issue

      allocations.push(applied.allocation);
      needed -= applied.allocation.deducted;
    }

    if (needed > 0) {
      // Concurrent issues ate the stock between the check and the writes.
      throw new StockError(
        `Not enough stock. ${needed} unit(s) could not be issued — stock changed while saving.`,
      );
    }

    // Ledger first: an OUT row per batch touched, carrying the batch reference.
    const { error: ledgerError } = await supabase.from("ledger").insert(
      allocations.map((allocation) => ({
        product_id: productId,
        type: "OUT" as const,
        qty: allocation.deducted,
        batch_id: allocation.batch_id,
        reference: options.reference ?? `Stock Out ${requested}`,
      })),
    );
    if (ledgerError) throw new Error(errorMessage(ledgerError));

    const { data: stockOut, error: stockOutError } = await supabase
      .from("stock_out")
      .insert({
        product_id: productId,
        total_qty: requested,
        out_date: options.outDate || todayISO(),
        note: options.note ?? null,
      })
      .select("id")
      .single();

    if (stockOutError || !stockOut) throw new Error(errorMessage(stockOutError));

    return { stockOutId: stockOut.id as string, totalIssued: requested, allocations };
  } catch (error) {
    await restoreAllocations(allocations);
    throw error;
  }
}

/**
 * Decrement one batch by at most `needed` units, guarding against a concurrent
 * write. Returns 0 when the batch was emptied by someone else.
 */
async function deductFromBatch(
  batch: StockBatch,
  needed: number,
): Promise<0 | { allocation: FifoAllocation }> {
  let current = batch;

  for (let attempt = 0; attempt < MAX_BATCH_RETRIES; attempt += 1) {
    if (current.remaining_qty <= 0) return 0;

    const deduct = Math.min(current.remaining_qty, needed);
    const remainingAfter = current.remaining_qty - deduct;

    const { data, error } = await supabase
      .from("stock_batches")
      .update({ remaining_qty: remainingAfter })
      .eq("id", current.id)
      .eq("remaining_qty", current.remaining_qty) // optimistic lock
      .select("id")
      .maybeSingle();

    if (error) throw new Error(errorMessage(error));

    if (data) {
      return {
        allocation: {
          batch_id: current.id,
          batch_date: current.batch_date,
          deducted: deduct,
          remaining_after: remainingAfter,
        },
      };
    }

    // Lost the race — re-read the batch and try again.
    const { data: fresh, error: refetchError } = await supabase
      .from("stock_batches")
      .select("*")
      .eq("id", current.id)
      .single();

    if (refetchError || !fresh) throw new Error(errorMessage(refetchError));
    current = fresh as StockBatch;
  }

  throw new StockError(
    "Stock is changing faster than it can be issued. Please retry this Stock Out.",
  );
}

/** Compensating write-back used when a run fails after some batches moved. */
async function restoreAllocations(allocations: FifoAllocation[]): Promise<void> {
  for (const allocation of allocations.slice().reverse()) {
    const { data } = await supabase
      .from("stock_batches")
      .select("remaining_qty")
      .eq("id", allocation.batch_id)
      .maybeSingle();

    if (!data) continue;
    await supabase
      .from("stock_batches")
      .update({ remaining_qty: Number(data.remaining_qty) + allocation.deducted })
      .eq("id", allocation.batch_id);
  }
}
