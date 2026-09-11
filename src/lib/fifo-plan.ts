import type { StockBatch } from "@/types";

/**
 * Pure FIFO allocation planner — no database, no React.
 *
 * Both the Stock Out preview and the engine in `src/lib/fifo.ts` walk batches
 * in this exact order, so what the user is shown before confirming is what the
 * engine actually deducts.
 */

export interface PlannedAllocation {
  batch: StockBatch;
  deduct: number;
  remainingAfter: number;
}

export interface FifoPlan {
  allocations: PlannedAllocation[];
  /** Units that could not be covered by the supplied batches. */
  shortfall: number;
  available: number;
  requested: number;
}

/** Oldest first: batch_date, then created_at as the tie-break. */
export function sortBatchesForFifo(batches: StockBatch[]): StockBatch[] {
  return [...batches].sort((left, right) => {
    if (left.batch_date !== right.batch_date) {
      return left.batch_date < right.batch_date ? -1 : 1;
    }
    if (left.created_at !== right.created_at) {
      return left.created_at < right.created_at ? -1 : 1;
    }
    return 0;
  });
}

export function totalAvailable(batches: StockBatch[]): number {
  return batches.reduce((sum, batch) => sum + Math.max(0, batch.remaining_qty), 0);
}

/**
 * Works out which batches cover `requested` units. A plan with a non-zero
 * `shortfall` must never be applied — that is the over-issue case the Stock Out
 * flow blocks.
 */
export function planFifoAllocations(batches: StockBatch[], requested: number): FifoPlan {
  const open = sortBatchesForFifo(batches).filter((batch) => batch.remaining_qty > 0);
  const available = totalAvailable(open);
  const target = Number.isFinite(requested) ? Math.trunc(requested) : 0;

  const allocations: PlannedAllocation[] = [];
  let needed = Math.max(0, target);

  for (const batch of open) {
    if (needed === 0) break;
    const deduct = Math.min(batch.remaining_qty, needed);
    allocations.push({ batch, deduct, remainingAfter: batch.remaining_qty - deduct });
    needed -= deduct;
  }

  return { allocations, shortfall: needed, available, requested: Math.max(0, target) };
}
