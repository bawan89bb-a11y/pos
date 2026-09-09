# Thoth POS

Multi-user retail point-of-sale app: React 19 + Vite + Tailwind 4 client, Express + tRPC 11 server, MySQL via Drizzle ORM.

## Structure

- `shared/` — money/time/calc/permissions/CSV logic used by both client and server, with Vitest coverage
- `drizzle/schema.ts` — database schema
- `server/` — Express + tRPC API, auth, business logic (`server/src/db/*`), routers (`server/src/routers/*`)
- `client/` — React app

## Setup

1. Create a MySQL/MariaDB database and user, then set `DATABASE_URL` in `server/.env` (see `server/.env` for the default dev values).
2. Install dependencies from the repo root: `npm install`
3. Push the schema: `npm run db:push`
4. Seed demo data (18 products, 5 customers, ~60 days of sales/expenses, 3 users): `npm run seed`
5. Run the API: `npm run dev:server` (http://localhost:4000)
6. Run the client: `npm run dev:client` (http://localhost:5173)

## Dev logins

- `owner` / `owner123` — full access
- `manager` / `manager123` — everything except managing users
- `cashier` / `cashier123` — register, sales, catalog view, customers, expenses

## Tests

`npm test` runs the shared package's Vitest suite (money/tax/margin/expiry/phone/CSV logic) and the server's test suite.
