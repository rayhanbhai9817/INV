/**
 * FIFO edge-case tests — Step 17.
 *
 * Run with: npm test
 * These cover the allocation planner that both the Stock Out preview and the
 * engine in src/lib/fifo.ts walk: multiple batches, exact depletion, partial
 * consumption, over-issue, and out-of-order batch dates.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  plannedCost,
  planFifoAllocations,
  sortBatchesForFifo,
  totalAvailable,
} from "../src/lib/fifo-plan.ts";
import type { StockBatch } from "../src/types/index.ts";

function batch(
  id: string,
  batch_date: string,
  total_qty: number,
  remaining_qty: number,
  created_at = `${batch_date}T09:00:00.000Z`,
  unit_cost: number | null = null,
): StockBatch {
  return {
    id,
    product_id: "product-1",
    box_count: 1,
    qty_per_box: total_qty,
    total_qty,
    remaining_qty,
    batch_date,
    unit_cost,
    supplier_id: null,
    warehouse_id: "warehouse-1",
    created_at,
  };
}

test("single batch covers the request and leaves the remainder", () => {
  const plan = planFifoAllocations([batch("b1", "2026-01-01", 100, 100)], 30);

  assert.equal(plan.shortfall, 0);
  assert.equal(plan.allocations.length, 1);
  assert.equal(plan.allocations[0].deduct, 30);
  assert.equal(plan.allocations[0].remainingAfter, 70);
});

test("spans multiple batches oldest first", () => {
  const plan = planFifoAllocations(
    [
      batch("newest", "2026-03-01", 50, 50),
      batch("oldest", "2026-01-01", 40, 40),
      batch("middle", "2026-02-01", 30, 30),
    ],
    80,
  );

  assert.equal(plan.shortfall, 0);
  assert.deepEqual(
    plan.allocations.map((allocation) => [allocation.batch.id, allocation.deduct]),
    [
      ["oldest", 40],
      ["middle", 30],
      ["newest", 10],
    ],
  );
});

test("exact depletion empties every batch touched", () => {
  const plan = planFifoAllocations(
    [batch("b1", "2026-01-01", 20, 20), batch("b2", "2026-01-02", 30, 30)],
    50,
  );

  assert.equal(plan.shortfall, 0);
  assert.deepEqual(
    plan.allocations.map((allocation) => allocation.remainingAfter),
    [0, 0],
  );
});

test("over-issue reports the shortfall and is never applied", () => {
  const plan = planFifoAllocations(
    [batch("b1", "2026-01-01", 10, 10), batch("b2", "2026-01-02", 5, 5)],
    20,
  );

  assert.equal(plan.available, 15);
  assert.equal(plan.shortfall, 5);
});

test("depleted batches are skipped entirely", () => {
  const plan = planFifoAllocations(
    [
      batch("depleted", "2026-01-01", 100, 0),
      batch("partial", "2026-01-05", 100, 25),
      batch("fresh", "2026-02-01", 100, 100),
    ],
    60,
  );

  assert.deepEqual(
    plan.allocations.map((allocation) => [allocation.batch.id, allocation.deduct]),
    [
      ["partial", 25],
      ["fresh", 35],
    ],
  );
});

test("partially consumed batch is finished before the next one starts", () => {
  const plan = planFifoAllocations(
    [batch("b1", "2026-01-01", 100, 40), batch("b2", "2026-01-02", 100, 100)],
    45,
  );

  assert.deepEqual(
    plan.allocations.map((allocation) => [allocation.batch.id, allocation.deduct]),
    [
      ["b1", 40],
      ["b2", 5],
    ],
  );
});

test("same batch date falls back to created_at ordering", () => {
  const ordered = sortBatchesForFifo([
    batch("later", "2026-01-01", 10, 10, "2026-01-01T18:00:00.000Z"),
    batch("earlier", "2026-01-01", 10, 10, "2026-01-01T06:00:00.000Z"),
  ]);

  assert.deepEqual(
    ordered.map((entry) => entry.id),
    ["earlier", "later"],
  );
});

test("zero, negative and fractional requests allocate nothing", () => {
  const batches = [batch("b1", "2026-01-01", 10, 10)];

  assert.equal(planFifoAllocations(batches, 0).allocations.length, 0);
  assert.equal(planFifoAllocations(batches, -5).allocations.length, 0);
  // Fractional input is truncated before allocation — stock is whole units.
  assert.equal(planFifoAllocations(batches, 2.7).allocations[0].deduct, 2);
});

test("no batches means nothing is available", () => {
  const plan = planFifoAllocations([], 10);

  assert.equal(totalAvailable([]), 0);
  assert.equal(plan.available, 0);
  assert.equal(plan.shortfall, 10);
  assert.equal(plan.allocations.length, 0);
});

test("issuing the entire stock in one go succeeds with no shortfall", () => {
  const batches = [
    batch("b1", "2026-01-01", 10, 10),
    batch("b2", "2026-01-02", 20, 20),
    batch("b3", "2026-01-03", 30, 30),
  ];
  const plan = planFifoAllocations(batches, totalAvailable(batches));

  assert.equal(plan.shortfall, 0);
  assert.equal(plan.allocations.length, 3);
  assert.ok(plan.allocations.every((allocation) => allocation.remainingAfter === 0));
});

// --------------------------- costing the plan ------------------------------

test("cost of a plan prices each batch at what that batch cost", () => {
  const plan = planFifoAllocations(
    [
      batch("b1", "2026-01-01", 100, 100, "2026-01-01T09:00:00.000Z", 10),
      batch("b2", "2026-02-01", 100, 100, "2026-02-01T09:00:00.000Z", 12),
    ],
    150,
  );

  // 100 units at 10 from the older batch, then 50 at 12 from the newer one.
  assert.equal(plannedCost(plan.allocations), 100 * 10 + 50 * 12);
});

test("cost is unknown when any consumed batch has no cost recorded", () => {
  const plan = planFifoAllocations(
    [
      batch("b1", "2026-01-01", 100, 100, "2026-01-01T09:00:00.000Z", null),
      batch("b2", "2026-02-01", 100, 100, "2026-02-01T09:00:00.000Z", 12),
    ],
    150,
  );

  assert.equal(plannedCost(plan.allocations), null);
});

test("a batch with no cost outside the plan does not spoil the total", () => {
  const plan = planFifoAllocations(
    [
      batch("b1", "2026-01-01", 100, 100, "2026-01-01T09:00:00.000Z", 10),
      batch("b2", "2026-02-01", 100, 100, "2026-02-01T09:00:00.000Z", null),
    ],
    60,
  );

  // Only the first batch is touched, so the uncosted one is irrelevant.
  assert.equal(plannedCost(plan.allocations), 600);
});

test("an empty plan costs nothing rather than reading as unknown", () => {
  assert.equal(plannedCost([]), 0);
});
