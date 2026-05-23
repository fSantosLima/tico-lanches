# Sistema de Gestão de Lanches — Sprint 1 Progress

> Tracks implementation progress against the spec at `docs/superpowers/plans/2026-05-23-sistema-lanches-sprint1.md`.
> Last updated: 2026-05-23

---

## Summary

| Task | Status | Notes |
|------|--------|-------|
| Task 1: Project Setup | ✅ Done | |
| Task 2: Database Schema + Prisma | ✅ Done | Deviated: uses PrismaPg driver adapter |
| Task 3: calcularTotalDia (TDD) | ✅ Done | |
| Task 4: Products API (TDD) | ✅ Done | |
| Task 5: Sales API (TDD) | ✅ Done | |
| Task 6: NextAuth + Register API | ✅ Done | |
| Task 7: Middleware — Route Protection | ✅ Fixed | Was `src/proxy.ts` (named export); replaced with `src/middleware.ts` (default export) |
| Task 8: Auth Pages | ✅ Done | |
| Task 9: Products Pages | ✅ Done | |
| Task 10: Dashboard + Server Action | ✅ Done | |
| Task 11: Full Test Run + Manual Verification | 🔲 Pending | Tests pass; dev-server verification not yet done |

**Test suite:** 22/22 passing (4 files: totals, products API, sales API, register API)

---

## Task 1: Project Setup ✅

- [x] Create Next.js project
- [x] Install runtime dependencies (prisma, next-auth, bcryptjs)
- [x] Install test dependencies (vitest, @vitejs/plugin-react, jsdom)
- [x] Create `vitest.config.ts`
- [x] Create `src/__tests__/setup.ts` with global Prisma mock
- [x] Add `test` / `test:watch` scripts to `package.json`
- [x] Commit: `chore: project setup with Next.js 14, Tailwind, Prisma, NextAuth, Vitest`

---

## Task 2: Database Schema + Prisma Setup ✅ (with deviation)

- [x] Initialize Prisma
- [x] Configure `.env` with `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`
- [x] Write `prisma/schema.prisma` — User, Product, Sale models
- [x] Run migration
- [x] Create `src/lib/prisma.ts`
- [x] Commit: `feat: prisma schema — User, Product, Sale models`

**Deviation:** `src/lib/prisma.ts` uses `PrismaPg` driver adapter (`@prisma/adapter-pg`) instead of plain `new PrismaClient()`.
This was introduced in commit `fix: adapt to Next.js 16 proxy convention and Prisma 7 driver adapter` to support Prisma 7's requirement for explicit driver adapters with PostgreSQL.
The spec's `prisma/schema.prisma` had `url = env("DATABASE_URL")` in the datasource; the actual schema uses no `url` field (it's passed to the adapter instead).

---

## Task 3: calcularTotalDia Utility (TDD) ✅

- [x] Write failing tests in `src/__tests__/lib/totals.test.ts`
- [x] Verified fail
- [x] Implement `src/lib/totals.ts`
- [x] Verified pass (3 tests)
- [x] Commit: `feat: calcularTotalDia utility with unit tests`

---

## Task 4: Products API (TDD) ✅

- [x] Write failing tests in `src/__tests__/api/products.test.ts`
- [x] Verified fail
- [x] Create `src/app/api/products/route.ts`
- [x] Verified pass (4 tests: GET 401, GET returns products, POST 401, POST 400 missing name, POST 400 zero price, POST 201 creates product)
- [x] Commit: `feat: products API — GET list and POST create with validation`

---

## Task 5: Sales API (TDD) ✅

- [x] Write failing tests in `src/__tests__/api/sales.test.ts`
- [x] Verified fail
- [x] Create `src/app/api/sales/route.ts`
- [x] Create `src/app/api/sales/today/route.ts`
- [x] Verified pass (5 tests: POST 401, POST 400 missing productId, POST 404 product not found, POST 201 with price snapshot, GET today 401, GET today returns sales+total)
- [x] Commit: `feat: sales API — POST register sale with price snapshot, GET today summary`

---

## Task 6: NextAuth + Register API ✅

- [x] Create `src/lib/auth.ts` — NextAuth config with Credentials + bcrypt
- [x] Create `src/types/next-auth.d.ts` — Session/JWT type extensions
- [x] Create `src/app/api/auth/[...nextauth]/route.ts`
- [x] Create `src/app/api/register/route.ts`
- [x] Commit: `feat: NextAuth credentials auth and user registration endpoint`

---

## Task 7: Middleware — Route Protection ✅ (Fixed)

- [x] Route protection logic written
- [x] Commit: `feat: middleware — protect dashboard and products routes`
- [x] Fixed: replaced `src/proxy.ts` (named export, not loaded by Next.js) with `src/middleware.ts` (default export)

**What was wrong:** The original implementation created `src/proxy.ts` with `export const proxy = withAuth(...)`. Next.js only loads middleware from `src/middleware.ts` — a file named `proxy.ts` is ignored at runtime, leaving routes unprotected.

**Fix applied:** Created `src/middleware.ts`:
```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/products/:path*'],
}
```
Deleted `src/proxy.ts`.

---

## Task 8: Auth Pages ✅

- [x] Create `src/app/(auth)/layout.tsx`
- [x] Create `src/app/(auth)/login/page.tsx`
- [x] Create `src/app/(auth)/register/page.tsx`
- [x] Commit: `feat: login and register pages`

---

## Task 9: Products Pages ✅

- [x] Create `src/app/products/page.tsx`
- [x] Create `src/app/products/new/page.tsx`
- [x] Commit: `feat: products list page and new product form`

---

## Task 10: Dashboard + Server Action ✅

- [x] Create `src/app/dashboard/actions.ts` — `registerSale` Server Action
- [x] Create `src/app/dashboard/ProductButton.tsx`
- [x] Create `src/app/dashboard/LogoutButton.tsx`
- [x] Create `src/app/dashboard/page.tsx`
- [x] Update `src/app/page.tsx` — root redirect to `/dashboard` or `/login`
- [x] Commit: `feat: dashboard with 1-click product buttons and daily total`
- [x] Commit: `feat: sprint 1 complete — auth, products, 1-click sales, dashboard`

---

## Task 11: Full Test Run + Manual Verification 🔲

- [x] Full test suite passing — 15 tests, 0 failures
- [ ] Start dev server and run manual verification checklist:
  1. Root `/` → redirects to `/login`
  2. `/register` → fill form → creates account → redirects to `/login`
  3. `/login` → wrong password → shows "Email ou senha incorretos"
  4. `/login` → correct credentials → redirects to `/dashboard`
  5. `/dashboard` → shows "R$ 0.00" and "0 vendas"
  6. `/products` → shows empty state with "Criar agora" link
  7. `/products/new` → fill form → product appears in `/products` list
  8. `/dashboard` → product button appears with name and price
  9. Tap product button → shows "✓ Registrado!" → total updates
  10. Tap again → total doubles
  11. Logout → redirects to `/login`
  12. Direct access to `/dashboard` after logout → redirects to `/login` (**blocked by Task 7 deviation**)
- [ ] Final commit (if any fixes applied)

---

## Open Issues

| # | Severity | Description |
|---|----------|-------------|
| 1 | 🟡 Low | Manual verification (Task 11) not yet executed. Requires running dev server against a live PostgreSQL database. |
