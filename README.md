# Fast Sold Inventory Management System

Production-ready inventory system for **Fast Sold LLC** — Next.js 14 (App Router) +
TypeScript + Tailwind CSS on the front end, Supabase (PostgreSQL + Auth) as the only
back end. There is no Laravel or Node API layer: the Supabase JavaScript client is
called from a dedicated service layer in `src/lib/db/`.

## Modules

| # | Module | Route | Notes |
|---|--------|-------|-------|
| 1 | Dashboard | `/dashboard` | KPI cards, recent transactions, low-stock alerts, quick actions |
| 2 | Products | `/products` | CRUD with SKU, category, supplier, unit, min stock |
| 3 | Categories | `/categories` | Deletion blocked while products depend on a category |
| 4 | Suppliers | `/suppliers` | Directory with name, phone, email, address |
| 5 | Inventory | `/inventory` | Live stock from the `inventory` view, low/out-of-stock highlighting |
| 6 | Stock In | `/stock-in` | Product, box count, qty per box; total auto-calculated |
| 7 | Stock Out | `/stock-out` | Product, total qty; deducted through the FIFO engine |
| 8 | Reports | `/reports` | Stock In, Stock Out, Ledger, Low Stock, Supplier — all exportable |
| 9 | Ledger Account | `/ledger` | Immutable audit log of every IN/OUT with batch reference |
| 10 | Notifications | `/notifications` | Low-stock alerts, mark read/unread |
| 11 | Settings | `/settings` | Company name, low-stock threshold, display preferences |
| 12 | Product Price | `/prices` | Independent price book: unit price × unit = total |

## Getting started

```bash
# 1. Create the database
#    Open Supabase -> SQL Editor -> New query, paste supabase/schema.sql, run it.

# 2. Create the single operator account
#    Supabase -> Authentication -> Users -> Add user (email + password, auto-confirm).

# 3. Configure the app
cp .env.example .env.local     # then fill in the project URL and anon key

# 4. Install and run
npm install
npm run dev                    # http://localhost:3000
```

| Script | What it does |
|--------|--------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | FIFO edge-case tests (`node --test`) |

## FIFO stock logic

All of it lives in `src/lib/fifo.ts` (database writes) and `src/lib/fifo-plan.ts`
(the pure allocation planner). No React component contains FIFO maths.

**Stock In**
1. User enters product, box count and qty per box.
2. `total = box_count × qty_per_box` is computed on the form and is read-only.
3. One row is inserted into `stock_batches` with `remaining_qty = total_qty`.
4. One `ledger` row (`type = 'IN'`) is written with that batch's id.
   If the ledger write fails the batch is removed again, so a batch can never
   exist without its audit entry.

**Stock Out**
1. User enters product and total quantity.
2. Open batches are read for the product, ordered by `batch_date` then
   `created_at` — oldest first.
3. If the total available is less than the requested quantity the issue is
   **blocked** with a message naming the shortfall. Nothing is written.
4. Otherwise each batch is decremented in turn
   (`deduct = min(remaining_qty, still_needed)`), each decrement guarded by an
   optimistic-concurrency check so a parallel issue cannot push stock negative.
5. One `ledger` row (`type = 'OUT'`) is written **per batch touched**, carrying
   that batch's id, followed by a single `stock_out` row for the whole issue.
6. If any step fails part-way, the deductions already applied are rolled back.

Stock can never go negative: it is blocked in the form (submit stays disabled),
blocked again in the engine before any write, and constrained in PostgreSQL
(`remaining_qty >= 0`).

## Project structure

```
src/
  app/
    (auth)/login/page.tsx          Sign-in
    (dashboard)/
      layout.tsx                   Sidebar + header shell, client session guard
      dashboard/page.tsx           Dashboard
      products/{page,new,[id]}     Products CRUD
      categories/page.tsx
      suppliers/{page,[id]}
      inventory/page.tsx
      stock-in/page.tsx
      stock-out/page.tsx
      ledger/page.tsx
      reports/page.tsx
      prices/page.tsx
      notifications/page.tsx
      settings/page.tsx
  lib/
    supabase.ts                    createClient singleton
    fifo.ts                        FIFO engine (stock in / stock out)
    fifo-plan.ts                   Pure FIFO allocation planner
    hooks.ts, utils.ts
    db/                            Service layer — the only place Supabase is queried
  types/index.ts                   Interfaces for every table and view
  components/
    ui/                            Button, Input, Select, Modal, Badge, Table, Pagination…
    layout/                        Sidebar, Header, Breadcrumb
    modules/                       StockInForm, StockOutForm, LedgerTable, ProductForm…
    providers/                     Auth, Settings, Notifications context
supabase/schema.sql                Tables, view, indexes, constraints, RLS
supabase/schema-from-spec.sql      The schema exactly as written in the brief
tests/fifo.test.ts                 FIFO edge cases
docs/DEPLOYMENT.md                 Hostinger deployment
```

## Conventions

- Supabase is never called from a component — pages call `src/lib/db/*`.
- Every list page ships a loading skeleton, an empty state, an error state with
  retry, search, filters and 25-row pagination.
- The ledger is append-only: a database trigger rejects `UPDATE` and `DELETE`.
- Product Price has no relationship to the stock flow — it reads and writes only
  `product_prices`.

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for Hostinger (frontend) and
Supabase (database + auth).
