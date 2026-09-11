# Deployment — Hostinger + Supabase

The app is a Next.js 14 server-rendered application. It needs a Node.js runtime,
so deploy it to a Hostinger plan that runs Node (VPS, or Cloud/Business hosting
with the Node.js application manager). Shared hosting that only serves static
files is not enough: the product and supplier detail routes are rendered on
demand.

## 1. Supabase (database + auth)

1. Create a project at <https://supabase.com>.
2. **SQL Editor → New query** → paste the whole of `supabase/schema.sql` → **Run**.
   This creates the nine tables, the `inventory` view, indexes, integrity
   constraints, the append-only ledger trigger, RLS policies and the default
   settings rows.
3. **Authentication → Users → Add user**: create the single operator account with
   an email and password, and mark it confirmed.
4. **Authentication → Providers → Email**: keep email/password enabled and turn
   off public sign-ups so no second account can self-register.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

> Only the anon key belongs in this app. Never ship the service-role key to the
> browser — RLS is what protects the data, and every policy here requires an
> authenticated user.

## 2. Build the app

On your machine or in CI:

```bash
npm ci
npm run lint && npm run typecheck && npm test
npm run build
```

Upload these to the server (or `git clone` and build there):

```
.next/        package.json      package-lock.json
public/       next.config.mjs
```

## 3. Hostinger — Node.js application

In hPanel → **Website → Node.js** (VPS: set this up with PM2 instead):

| Setting | Value |
|---------|-------|
| Application root | the folder you uploaded |
| Application startup file | `node_modules/next/dist/bin/next` with args `start` (or use `npm start`) |
| Node version | 18.17 or newer |

Environment variables (hPanel → Node.js → Environment variables, or `.env.local`
on a VPS):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
NODE_ENV=production
PORT=3000
```

These are read at build time as well as at runtime, so set them **before**
running `npm run build` on the server.

Then install and start:

```bash
npm ci --omit=dev
npm run build
npm start          # or: pm2 start npm --name fastsold-inventory -- start
```

### VPS: nginx in front

```nginx
server {
    listen 80;
    server_name inventory.yourdomain.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Issue TLS with Hostinger's free SSL or certbot, and keep the site on HTTPS —
Supabase auth tokens are stored in the browser.

## 4. Post-deploy checklist

- [ ] Sign in at `/login` with the operator account.
- [ ] Create a category, a supplier and a product.
- [ ] Record a Stock In — confirm the total equals box count × qty per box and a
      `IN` row appears in the ledger.
- [ ] Record a Stock Out larger than the stock on hand — it must be blocked.
- [ ] Record a valid Stock Out spanning two batches — confirm the oldest batch is
      consumed first and one `OUT` ledger row exists per batch touched.
- [ ] Check `/inventory` highlights low and out-of-stock products.
- [ ] Check `/notifications` received the low-stock alert.
- [ ] Set the company name in `/settings` and confirm it shows in the sidebar.

## Updating a deployed instance

```bash
git pull
npm ci
npm run build
pm2 restart fastsold-inventory     # or restart the app in hPanel
```

Database changes go through the Supabase SQL Editor. `supabase/schema.sql` is
written to be re-runnable (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE
VIEW`, policies dropped before being recreated).
