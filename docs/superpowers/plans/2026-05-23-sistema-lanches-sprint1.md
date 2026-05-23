# Sistema de Gestão de Lanches — Sprint 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first sales management system for street food vendors: login, product registration, 1-click sale recording, and daily sales dashboard.

**Architecture:** Next.js 14 App Router full-stack. API Routes handle data with Prisma + PostgreSQL. NextAuth with Credentials Provider handles email/password auth. Dashboard uses Server Actions with `revalidatePath` for real-time total updates after each sale.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, PostgreSQL, Prisma, NextAuth.js (Credentials), bcryptjs, Vitest

---

## File Map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | User, Product, Sale models |
| `src/lib/prisma.ts` | PrismaClient singleton |
| `src/lib/auth.ts` | NextAuth config (Credentials + bcrypt) |
| `src/lib/totals.ts` | Pure function: `calcularTotalDia(sales[])` |
| `src/types/next-auth.d.ts` | Extend Session/JWT types with `user.id` |
| `src/middleware.ts` | Redirect unauthenticated requests to /login |
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handler |
| `src/app/api/register/route.ts` | POST — create user with hashed password |
| `src/app/api/products/route.ts` | GET list products, POST create product |
| `src/app/api/sales/route.ts` | POST — register sale (price snapshot) |
| `src/app/api/sales/today/route.ts` | GET — today's sales + total |
| `src/app/(auth)/layout.tsx` | Centered card layout for auth pages |
| `src/app/(auth)/login/page.tsx` | Login form |
| `src/app/(auth)/register/page.tsx` | Register form |
| `src/app/dashboard/actions.ts` | Server Action: `registerSale(productId)` |
| `src/app/dashboard/ProductButton.tsx` | Client component — 1-click sale button |
| `src/app/dashboard/LogoutButton.tsx` | Client component — sign out button |
| `src/app/dashboard/page.tsx` | Main screen: daily total + product buttons |
| `src/app/products/page.tsx` | Product list |
| `src/app/products/new/page.tsx` | Create product form |
| `src/app/page.tsx` | Root redirect (→ /dashboard or /login) |
| `vitest.config.ts` | Vitest config with path aliases |
| `src/__tests__/setup.ts` | Global Prisma mock |
| `src/__tests__/lib/totals.test.ts` | Unit tests for `calcularTotalDia` |
| `src/__tests__/api/products.test.ts` | Unit tests for products API |
| `src/__tests__/api/sales.test.ts` | Unit tests for sales API |

---

## Task 1: Project Setup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/__tests__/setup.ts`
- Modify: `package.json` (test script)

- [ ] **Step 1: Create the Next.js project**

```bash
npx create-next-app@latest sistema-lanches --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
cd sistema-lanches
```

Expected output: `Success! Created sistema-lanches`

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install prisma @prisma/client next-auth bcryptjs
npm install --save-dev @types/bcryptjs
```

- [ ] **Step 3: Install test dependencies**

```bash
npm install --save-dev vitest @vitejs/plugin-react jsdom
```

- [ ] **Step 4: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 5: Create `src/__tests__/setup.ts`**

```typescript
import { vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    sale: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))
```

- [ ] **Step 6: Add test scripts to `package.json`**

In the `"scripts"` section of `package.json`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: project setup with Next.js 14, Tailwind, Prisma, NextAuth, Vitest"
```

---

## Task 2: Database Schema + Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `.env` (never committed — add to `.gitignore`)

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init
```

Expected output: `Your Prisma schema was created at prisma/schema.prisma`

- [ ] **Step 2: Configure `.env`**

```env
DATABASE_URL="postgresql://postgres:123@localhost:5432/lanches"
NEXTAUTH_SECRET="troque-por-uma-string-longa-e-aleatoria"
NEXTAUTH_URL="http://localhost:3000"
```

To run PostgreSQL locally with Docker:

```bash
docker run --name postgres-lanches \
  -e POSTGRES_PASSWORD=123 \
  -e POSTGRES_DB=lanches \
  -p 5432:5432 -d postgres
```

- [ ] **Step 3: Write `prisma/schema.prisma`**

Replace the full contents:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String    @id @default(uuid())
  email     String    @unique
  name      String?
  password  String
  products  Product[]
  sales     Sale[]
  createdAt DateTime  @default(now())
}

model Product {
  id        String   @id @default(uuid())
  name      String
  price     Float
  cost      Float
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  sales     Sale[]
  createdAt DateTime @default(now())
}

model Sale {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  value     Float
  createdAt DateTime @default(now())
}
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 5: Create `src/lib/prisma.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 6: Commit**

```bash
git add prisma/ src/lib/prisma.ts
git commit -m "feat: prisma schema — User, Product, Sale models"
```

---

## Task 3: calcularTotalDia Utility (TDD)

**Files:**
- Create: `src/__tests__/lib/totals.test.ts`
- Create: `src/lib/totals.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/lib/totals.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calcularTotalDia } from '@/lib/totals'

describe('calcularTotalDia', () => {
  it('retorna 0 quando não há vendas', () => {
    expect(calcularTotalDia([])).toBe(0)
  })

  it('soma os valores de todas as vendas', () => {
    const sales = [{ value: 10.5 }, { value: 7.0 }, { value: 3.5 }]
    expect(calcularTotalDia(sales)).toBe(21.0)
  })

  it('lida com venda única', () => {
    expect(calcularTotalDia([{ value: 15.99 }])).toBe(15.99)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test src/__tests__/lib/totals.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/totals'`

- [ ] **Step 3: Implement `src/lib/totals.ts`**

```typescript
export function calcularTotalDia(sales: { value: number }[]): number {
  return sales.reduce((total, sale) => total + sale.value, 0)
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test src/__tests__/lib/totals.test.ts
```

Expected: PASS — 3 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/totals.ts src/__tests__/lib/totals.test.ts
git commit -m "feat: calcularTotalDia utility with unit tests"
```

---

## Task 4: Products API (TDD)

**Files:**
- Create: `src/__tests__/api/products.test.ts`
- Create: `src/app/api/products/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/api/products.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/products/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

beforeEach(() => vi.clearAllMocks())

describe('GET /api/products', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/products'))
    expect(res.status).toBe(401)
  })

  it('retorna produtos do usuário logado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockProducts = [
      { id: 'p1', name: 'X-Burguer', price: 12.0, cost: 5.0, userId: 'user-1' },
    ]
    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    const res = await GET(new Request('http://localhost/api/products'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual(mockProducts)
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('POST /api/products', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12, cost: 5 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('retorna 400 se name estiver ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ price: 12, cost: 5 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 400 se price for zero ou negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 0, cost: 5 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('cria produto e retorna 201', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockProduct = { id: 'p1', name: 'X-Burguer', price: 12.0, cost: 5.0, userId: 'user-1' }
    vi.mocked(prisma.product.create).mockResolvedValue(mockProduct as any)

    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12.0, cost: 5.0 }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual(mockProduct)
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: { name: 'X-Burguer', price: 12.0, cost: 5.0, userId: 'user-1' },
    })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test src/__tests__/api/products.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/products/route'`

- [ ] **Step 3: Create `src/app/api/products/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(products)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { name, price, cost } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }
  if (!price || price <= 0) {
    return NextResponse.json({ error: 'Preço deve ser maior que zero' }, { status: 400 })
  }
  if (cost === undefined || cost < 0) {
    return NextResponse.json({ error: 'Custo inválido' }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: { name: name.trim(), price, cost, userId: session.user.id },
  })

  return NextResponse.json(product, { status: 201 })
}
```

Note: Both test files mock `@/lib/auth` (so `authOptions` resolves at test time) and mock `next-auth` directly (so `getServerSession` returns controlled values). `src/lib/auth.ts` with real bcrypt logic is created in Task 6.

- [ ] **Step 4: Run to verify they pass**

```bash
npm test src/__tests__/api/products.test.ts
```

Expected: PASS — 4 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/app/api/products/ src/__tests__/api/products.test.ts
git commit -m "feat: products API — GET list and POST create with validation"
```

---

## Task 5: Sales API (TDD)

**Files:**
- Create: `src/__tests__/api/sales.test.ts`
- Create: `src/app/api/sales/route.ts`
- Create: `src/app/api/sales/today/route.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/api/sales.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/sales/route'
import { GET } from '@/app/api/sales/today/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

beforeEach(() => vi.clearAllMocks())

describe('POST /api/sales', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const req = new Request('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify({ productId: 'p1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('retorna 400 se productId estiver ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 404 se produto não existir ou não pertencer ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)

    const req = new Request('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify({ productId: 'p-inexistente' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('registra venda com snapshot do preço e retorna 201', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockProduct = { id: 'p1', name: 'X-Burguer', price: 12.0, cost: 5.0, userId: 'user-1' }
    const mockSale = { id: 's1', productId: 'p1', userId: 'user-1', value: 12.0, createdAt: new Date() }
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.create).mockResolvedValue(mockSale as any)

    const req = new Request('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify({ productId: 'p1' }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.value).toBe(12.0)
    expect(prisma.sale.create).toHaveBeenCalledWith({
      data: { productId: 'p1', userId: 'user-1', value: 12.0 },
    })
  })
})

describe('GET /api/sales/today', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/sales/today'))
    expect(res.status).toBe(401)
  })

  it('retorna vendas de hoje e total', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const today = new Date()
    const mockSales = [
      { id: 's1', value: 12.0, createdAt: today, product: { name: 'X-Burguer' } },
      { id: 's2', value: 8.0, createdAt: today, product: { name: 'Suco' } },
    ]
    vi.mocked(prisma.sale.findMany).mockResolvedValue(mockSales as any)

    const res = await GET(new Request('http://localhost/api/sales/today'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.total).toBe(20.0)
    expect(data.sales).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

```bash
npm test src/__tests__/api/sales.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/sales/route'`

- [ ] **Step 3: Create `src/app/api/sales/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { productId } = body

  if (!productId) {
    return NextResponse.json({ error: 'productId é obrigatório' }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
  })

  if (!product) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const sale = await prisma.sale.create({
    data: { productId, userId: session.user.id, value: product.price },
  })

  return NextResponse.json(sale, { status: 201 })
}
```

- [ ] **Step 4: Create `src/app/api/sales/today/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { calcularTotalDia } from '@/lib/totals'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const sales = await prisma.sale.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ sales, total: calcularTotalDia(sales) })
}
```

- [ ] **Step 5: Run to verify they pass**

```bash
npm test src/__tests__/api/sales.test.ts
```

Expected: PASS — 5 tests passed

- [ ] **Step 6: Commit**

```bash
git add src/app/api/sales/ src/__tests__/api/sales.test.ts
git commit -m "feat: sales API — POST register sale with price snapshot, GET today summary"
```

---

## Task 6: NextAuth + Register API

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/types/next-auth.d.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/api/register/route.ts`

- [ ] **Step 1: Create `src/lib/auth.ts`**

```typescript
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) return null

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) return null

        return { id: user.id, email: user.email, name: user.name ?? undefined }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.id as string
      return session
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
}
```

- [ ] **Step 2: Create `src/types/next-auth.d.ts`**

```typescript
import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
  }
}
```

- [ ] **Step 3: Create `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 4: Create `src/app/api/register/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  const body = await request.json()
  const { email, password, name } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'Email já cadastrado' }, { status: 409 })
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { email, password: hashedPassword, name },
  })

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/types/ src/app/api/auth/ src/app/api/register/
git commit -m "feat: NextAuth credentials auth and user registration endpoint"
```

---

## Task 7: Middleware — Route Protection

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Create `src/middleware.ts`**

```typescript
export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/dashboard/:path*', '/products/:path*'],
}
```

Any request to `/dashboard` or `/products` without a valid session is automatically redirected to `/login` (the `signIn` page configured in `authOptions`).

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: middleware — protect dashboard and products routes"
```

---

## Task 8: Auth Pages

**Files:**
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Create `src/app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-6">
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/(auth)/login/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email ou senha incorretos')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-center mb-6">Entrar</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="text-center text-sm mt-4">
        Não tem conta?{' '}
        <Link href="/register" className="text-orange-500 font-medium">
          Cadastrar
        </Link>
      </p>
    </>
  )
}
```

- [ ] **Step 3: Create `src/app/(auth)/register/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erro ao criar conta')
      setLoading(false)
      return
    }

    router.push('/login')
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-center mb-6">Criar Conta</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome (opcional)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
            minLength={6}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50"
        >
          {loading ? 'Criando conta...' : 'Criar Conta'}
        </button>
      </form>
      <p className="text-center text-sm mt-4">
        Já tem conta?{' '}
        <Link href="/login" className="text-orange-500 font-medium">
          Entrar
        </Link>
      </p>
    </>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/"
git commit -m "feat: login and register pages"
```

---

## Task 9: Products Pages

**Files:**
- Create: `src/app/products/page.tsx`
- Create: `src/app/products/new/page.tsx`

- [ ] **Step 1: Create `src/app/products/page.tsx`**

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  const products = await prisma.product.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Produtos</h1>
        <Link
          href="/products/new"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Novo
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Nenhum produto cadastrado.{' '}
          <Link href="/products/new" className="text-orange-500">
            Criar agora
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {products.map(product => (
            <li key={product.id} className="bg-white border rounded-xl p-4">
              <div className="flex justify-between items-start">
                <span className="font-medium">{product.name}</span>
                <span className="text-green-600 font-bold">
                  R$ {product.price.toFixed(2)}
                </span>
              </div>
              <span className="text-gray-400 text-sm">
                Custo: R$ {product.cost.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Link href="/dashboard" className="text-orange-500 text-sm">
          ← Voltar ao dashboard
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/app/products/new/page.tsx`**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price: parseFloat(price),
        cost: parseFloat(cost),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erro ao salvar produto')
      setLoading(false)
      return
    }

    router.push('/products')
  }

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-orange-500 text-lg">←</Link>
        <h1 className="text-xl font-bold">Novo Produto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: X-Burguer"
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Preço de venda (R$)</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Custo (R$)</label>
          <input
            type="number"
            value={cost}
            onChange={e => setCost(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Produto'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/products/
git commit -m "feat: products list page and new product form"
```

---

## Task 10: Dashboard + Server Action

**Files:**
- Create: `src/app/dashboard/actions.ts`
- Create: `src/app/dashboard/ProductButton.tsx`
- Create: `src/app/dashboard/LogoutButton.tsx`
- Create: `src/app/dashboard/page.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/app/dashboard/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function registerSale(productId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
  })
  if (!product) throw new Error('Produto não encontrado')

  await prisma.sale.create({
    data: { productId, userId: session.user.id, value: product.price },
  })

  revalidatePath('/dashboard')
}
```

- [ ] **Step 2: Create `src/app/dashboard/ProductButton.tsx`**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { registerSale } from './actions'

interface ProductButtonProps {
  id: string
  name: string
  price: number
}

export function ProductButton({ id, name, price }: ProductButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<'idle' | 'success' | 'error'>('idle')

  function handleClick() {
    startTransition(async () => {
      try {
        await registerSale(id)
        setFeedback('success')
        setTimeout(() => setFeedback('idle'), 1500)
      } catch {
        setFeedback('error')
        setTimeout(() => setFeedback('idle'), 1500)
      }
    })
  }

  const colorClass =
    feedback === 'success' ? 'bg-green-500 text-white' :
    feedback === 'error'   ? 'bg-red-500 text-white' :
                             'bg-orange-500 text-white'

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`w-full py-6 rounded-2xl font-bold text-xl transition-all active:scale-95 disabled:opacity-50 ${colorClass}`}
    >
      <span className="block">{name}</span>
      <span className="block text-base font-normal mt-1">
        {feedback === 'success' ? '✓ Registrado!' :
         feedback === 'error'   ? '✗ Erro' :
                                  `R$ ${price.toFixed(2)}`}
      </span>
    </button>
  )
}
```

- [ ] **Step 3: Create `src/app/dashboard/LogoutButton.tsx`**

```typescript
'use client'

import { signOut } from 'next-auth/react'

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-gray-400 text-xs underline"
    >
      Sair
    </button>
  )
}
```

- [ ] **Step 4: Create `src/app/dashboard/page.tsx`**

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularTotalDia } from '@/lib/totals'
import { ProductButton } from './ProductButton'
import { LogoutButton } from './LogoutButton'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const [products, sales] = await Promise.all([
    prisma.product.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.sale.findMany({
      where: {
        userId: session!.user.id,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
  ])

  const totalDia = calcularTotalDia(sales)

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-500 text-sm">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <div className="flex items-center gap-3">
          <Link href="/products" className="text-orange-500 text-sm font-medium">
            Produtos
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 mb-6 text-center shadow-sm">
        <p className="text-gray-500 text-sm mb-1">Total de hoje</p>
        <p className="text-4xl font-bold text-green-600">
          R$ {totalDia.toFixed(2)}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {sales.length} venda{sales.length !== 1 ? 's' : ''}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">Nenhum produto cadastrado ainda.</p>
          <Link
            href="/products/new"
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Cadastrar primeiro produto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map(product => (
            <ProductButton
              key={product.id}
              id={product.id}
              name={product.name}
              price={product.price}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Update `src/app/page.tsx`**

Replace full contents:

```typescript
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function Home() {
  const session = await getServerSession(authOptions)
  redirect(session ? '/dashboard' : '/login')
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/ src/app/page.tsx
git commit -m "feat: dashboard with 1-click product buttons and daily total"
```

---

## Task 11: Full Test Run + Manual Verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected output:
```
✓ src/__tests__/lib/totals.test.ts (3 tests)
✓ src/__tests__/api/products.test.ts (4 tests)
✓ src/__tests__/api/sales.test.ts (5 tests)

Test Files: 3 passed (3)
Tests: 12 passed (12)
```

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Manual verification checklist**

Open http://localhost:3000 and verify each step:

1. Root `/` → redirects to `/login`
2. `/register` → fill form → creates account → redirects to `/login`
3. `/login` → wrong password → shows "Email ou senha incorretos"
4. `/login` → correct credentials → redirects to `/dashboard`
5. `/dashboard` → shows "R$ 0.00" and "0 vendas"
6. `/products` → shows empty state with "Criar agora" link
7. `/products/new` → fill form → product appears in `/products` list
8. `/dashboard` → product button appears with name and price
9. Tap product button → shows "✓ Registrado!" → total updates to product price
10. Tap again → total doubles
11. Logout button → redirects to `/login`
12. Direct access to `/dashboard` after logout → redirects to `/login`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: sprint 1 complete — auth, products, 1-click sales, dashboard"
```

---

## Out of Scope (Sprint 2)

- Inventory management (Estoque)
- Expense tracking (Gastos)
- Reports by period (Relatórios)
- PDF export
- Multi-tenant / SaaS features
