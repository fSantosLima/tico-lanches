# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start Next.js dev server on port 3000
npm run build        # production build
npm run lint         # run ESLint
npm run test         # run all tests once (Vitest)
npm run test:watch   # run tests in watch mode

# run a single test file
npx vitest run src/__tests__/lib/totals.test.ts

# database migrations
npx prisma migrate dev    # apply migrations and regenerate client
npx prisma migrate deploy # apply migrations in production
npx prisma generate       # regenerate client after schema changes
npx prisma studio         # open Prisma Studio GUI
```

## Environment

Required `.env` variables:
```
DATABASE_URL="postgresql://user:password@localhost:5432/lanches"
NEXTAUTH_SECRET="<random string>"
NEXTAUTH_URL="http://localhost:3000"
```

## Architecture

**Next.js App Router** with PostgreSQL via Prisma (using the `@prisma/adapter-pg` driver adapter — not the default TCP connection). The singleton client is in [src/lib/prisma.ts](src/lib/prisma.ts).

**Authentication** uses NextAuth v4 with JWT strategy and a credentials provider (email/bcrypt password). The config lives in [src/lib/auth.ts](src/lib/auth.ts) and is mounted at `src/app/api/auth/[...nextauth]/route.ts`. Route protection uses Next.js proxy in [src/proxy.ts](src/proxy.ts) via `withAuth({ pages: { signIn: '/login' } })`, which redirects unauthenticated requests on the protected routes (`/dashboard`, `/products`, `/lancamento`, `/gastos`, `/relatorios`) to the custom login page.

**Data model** (four entities, all scoped to a `userId`):
- `User` → `Product[]` + `Sale[]` + `Expense[]`
- `Product` (name, price, cost) → `Sale[]`
- `Sale` — **aggregate per product/day**: `(userId, productId, date)` is unique. Stores `quantity`, `unitPrice` and `unitCost` snapshots. One row per product per day, not per unit sold.
- `Expense` — operational costs (ingredients, disposables, etc.) with `date`, `category`, `description`, `quantity`, `unit`, `value`. Categories: `Ingredientes`, `Descartáveis`, `Salgados prontos`, `Outros`.

**Route groups:**
- `(auth)` — unauthenticated pages: `/login`, `/register`
- `/dashboard` — summary: today's revenue+profit card + list of past days
- `/lancamento` — end-of-day entry screen; `?data=YYYY-MM-DD` opens a past day for editing; sales saved via Server Action (`salvarLancamento` in [src/app/(protected)/lancamento/actions.ts](src/app/(protected)/lancamento/actions.ts)); date selector uses `DatePicker` component (`react-datepicker` with pt-BR locale)
- `/gastos` — expense management: filter by period, add/remove expenses grouped by category; uses `DateInput` component for date fields; Server Actions: `adicionarGasto`, `removerGasto`
- `/products` — product listing and creation
- `/relatorios` — period report crossing revenue (`Sale`) with real expenses (`Expense`): KPIs (faturamento, gastos, lucro real, margem), gastos por categoria, and charts (donut + weekly line via Recharts). Period from URL (`?de&ate&tab`); pure aggregation in [src/lib/relatorio.ts](src/lib/relatorio.ts), period parsing in [src/lib/periodo.ts](src/lib/periodo.ts). **Lucro real = faturamento − gastos reais** (does not subtract product `unitCost`, to avoid double counting). Week math uses UTC components (Monday-start), not date-fns, for timezone determinism.
- `api/` — REST endpoints for products, sales, and today's sales summary

**Date components** (both use `react-datepicker` v9 + `date-fns` pt-BR locale for browser-independent Portuguese calendar):
- `src/components/DateInput.tsx` — reusable date input for forms; renders a hidden `<input type="hidden">` with ISO value for Server Actions
- `src/app/(protected)/lancamento/DatePicker.tsx` — date selector in the lancamento header; navigates to `?data=YYYY-MM-DD` on change. **Must be wrapped in a `<div>`** — react-datepicker renders a Fragment and adding it directly inside a `justify-between` flex container shifts the reference element to center, breaking popup positioning.

**API endpoints:**
- `GET/POST /api/products` — list/create user's products
- `GET /api/sales/today` — today's sales list + `{ faturamento, lucro }` (uses `calcularResumo` from [src/lib/totals.ts](src/lib/totals.ts))
- `POST /api/register` — create new user account

**Testing:** Vitest with `jsdom` environment. `src/__tests__/setup.ts` globally mocks `@/lib/prisma`, so all tests use `vi.fn()` stubs for Prisma — no real database is required. Path alias `@` maps to `src/`.

## Important Notes

- This project uses **Next.js 16** — read `node_modules/next/dist/docs/` for current API conventions before writing Next.js-specific code, as it may differ from older versions.
- All data is per-user; every Prisma query must include `userId: session.user.id` as a filter.
- Route protection lives in `src/proxy.ts` (renamed from `middleware.ts` in Next.js 16 — the `middleware` file convention is deprecated). It uses `withAuth` from `next-auth/middleware` with `pages: { signIn: '/login' }` so unauthenticated users land on the custom login page, not the default NextAuth page.
