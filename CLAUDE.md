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

**Authentication** uses NextAuth v4 with JWT strategy and a credentials provider (email/bcrypt password). The config lives in [src/lib/auth.ts](src/lib/auth.ts) and is mounted at `src/app/api/auth/[...nextauth]/route.ts`. Route protection uses Next.js proxy in [src/proxy.ts](src/proxy.ts) via `withAuth({ pages: { signIn: '/login' } })`, which redirects unauthenticated requests on the protected routes (`/dashboard`, `/products`, `/lancamento`, `/gastos`, `/relatorios`, `/estoque`, `/insumos`) to the custom login page.

**Data model** (eight entities, all scoped to a `userId`):
- `User` → `Product[]` + `Sale[]` + `Expense[]` + `StockEntry[]` + `Insumo[]` + `InsumoEntry[]`
- `Product` (name, price, cost, minStock) → `Sale[]` + `StockEntry[]` + `RecipeItem[]`
- `Insumo` — insumo/ingrediente: `name`, `unit` (un/g/kg/ml/L), `cost` (custo unitário, informativo), `minStock` (Float). Saldo derivado: `entradas (InsumoEntry) − consumo derivado das vendas via receita`.
- `InsumoEntry` — entradas de compra de insumo (só quantidade física, `Float`): `date`, `quantity`, `note?`. **Não carrega valor** (o dinheiro fica em `Expense`).
- `RecipeItem` — item da ficha técnica: liga `Product` a `Insumo` com `quantity` (consumo por unidade de produto). `@@unique([productId, insumoId])`.
- `Sale` — **aggregate per product/day**: `(userId, productId, date)` is unique. Stores `quantity`, `unitPrice` and `unitCost` snapshots. One row per product per day, not per unit sold.
- `StockEntry` — entradas de estoque (reposições/saldo inicial) por produto: `date`, `quantity` (Int), `note?`. O saldo de estoque é derivado: `entradas − vendas (Sale)`.
- `Expense` — operational costs (ingredients, disposables, etc.) with `date`, `category`, `description`, `quantity`, `unit`, `value`. Categories: `Ingredientes`, `Descartáveis`, `Salgados prontos`, `Outros`.

**Route groups:**
- `(auth)` — unauthenticated pages: `/login`, `/register`
- `/dashboard` — summary: today's revenue+profit card + list of past days
- `/lancamento` — end-of-day entry screen; `?data=YYYY-MM-DD` opens a past day for editing; sales saved via Server Action (`salvarLancamento` in [src/app/(protected)/lancamento/actions.ts](src/app/(protected)/lancamento/actions.ts)); date selector uses `DatePicker` component (`react-datepicker` with pt-BR locale)
- `/gastos` — expense management: filter by period, add/remove expenses grouped by category; uses `DateInput` component for date fields; Server Actions: `adicionarGasto`, `removerGasto`
- `/products` — product listing and creation
- `/products/[id]` — detalhe do produto com **ficha técnica** (receita insumo→produto) e **custo real** derivado (`preço − custo real = margem real`, informativo, não altera `Product.cost` nem o relatório). Server Actions `adicionarItemReceita`, `removerItemReceita`.
- `/estoque` — controle de estoque dos produtos vendáveis: saldo (entradas − vendas), status (ok/baixo/negativo), registro de entradas e ajuste do estoque mínimo inline. Server Actions: `registrarEntrada`, `removerEntrada`, `definirEstoqueMinimo`; agregação pura em [src/lib/estoque.ts](src/lib/estoque.ts). **Lançar venda não é bloqueado por falta de estoque** (saldo pode ficar negativo, apenas alerta). Mínimo 0 não gera alerta de "baixo".
- `/insumos` — controle de estoque de insumos: saldo (entradas − consumo derivado via receita), status (ok/baixo/negativo), cadastro em `/insumos/new`, registro de entradas de compra e ajuste inline de mínimo e custo. Server Actions em [src/app/(protected)/insumos/actions.ts](<src/app/(protected)/insumos/actions.ts>): `criarInsumo`, `registrarEntradaInsumo`, `removerEntradaInsumo`, `definirMinimoInsumo`, `definirCustoInsumo`. Agregação pura em [src/lib/insumos.ts](src/lib/insumos.ts). Entrada de insumo é só física (sem valor); o dinheiro continua em Gastos.
- `/relatorios` — period report crossing revenue (`Sale`) with real expenses (`Expense`): KPIs (faturamento, gastos, lucro real, margem), gastos por categoria, and charts (donut + weekly line via Recharts). Period from URL (`?de&ate&tab`); pure aggregation in [src/lib/relatorio.ts](src/lib/relatorio.ts), period parsing in [src/lib/periodo.ts](src/lib/periodo.ts). **Lucro real = faturamento − gastos reais** (does not subtract product `unitCost`, to avoid double counting). Week math uses UTC components (Monday-start), not date-fns, for timezone determinism.
- `api/` — REST endpoints for products, sales, and today's sales summary

**Date components** (both use `react-datepicker` v9 + `date-fns` pt-BR locale for browser-independent Portuguese calendar):
- `src/components/DateInput.tsx` — reusable date input for forms; renders a hidden `<input type="hidden">` with ISO value for Server Actions
- `src/app/(protected)/lancamento/DatePicker.tsx` — date selector in the lancamento header; navigates to `?data=YYYY-MM-DD` on change. **Must be wrapped in a `<div>`** — react-datepicker renders a Fragment and adding it directly inside a `justify-between` flex container shifts the reference element to center, breaking popup positioning.

**API endpoints:**
- `GET/POST /api/products` — list/create user's products
- `GET /api/sales/today` — today's sales list + `{ faturamento, lucro }` (uses `calcularResumo` from [src/lib/totals.ts](src/lib/totals.ts))
- `POST /api/register` — create new user account

**Helpers in `src/lib`:** The stock status rule (`negativo`/`baixo`/`ok`) lives in [src/lib/stockStatus.ts](src/lib/stockStatus.ts), used by `estoque.ts` and `insumos.ts`.

**Testing:** Vitest with `jsdom` environment. `src/__tests__/setup.ts` globally mocks `@/lib/prisma`, so all tests use `vi.fn()` stubs for Prisma — no real database is required. Path alias `@` maps to `src/`.

## Important Notes

- This project uses **Next.js 16** — read `node_modules/next/dist/docs/` for current API conventions before writing Next.js-specific code, as it may differ from older versions.
- All data is per-user; every Prisma query must include `userId: session.user.id` as a filter.
- Route protection lives in `src/proxy.ts` (renamed from `middleware.ts` in Next.js 16 — the `middleware` file convention is deprecated). It uses `withAuth` from `next-auth/middleware` with `pages: { signIn: '/login' }` so unauthenticated users land on the custom login page, not the default NextAuth page.
