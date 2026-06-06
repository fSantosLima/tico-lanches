# Lançamento por Quantidade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o fluxo de "1 toque = 1 venda em tempo real" por um lançamento de fim de expediente onde o usuário informa a quantidade vendida de cada produto, com faturamento e lucro calculados ao vivo.

**Architecture:** O modelo `Sale` é redefinido como agregado por dia (1 linha por produto/dia com `quantity`, `unitPrice`, `unitCost`). O dashboard vira uma tela de resumo. Uma nova rota `/lancamento` recebe o lançamento via Server Action com `upsert`. A função `calcularTotalDia` é substituída por `calcularResumo` que retorna `{ faturamento, lucro }`.

**Tech Stack:** Next.js 16 App Router, Prisma, PostgreSQL, Vitest, Tailwind CSS v4, next-themes, NextAuth v4

---

## Mapa de arquivos

**Modificados:**
- `prisma/schema.prisma` — redefinir modelo `Sale`
- `src/lib/totals.ts` — substituir `calcularTotalDia` por `calcularResumo`
- `src/__tests__/lib/totals.test.ts` — atualizar para `calcularResumo`
- `src/__tests__/api/sales.test.ts` — remover testes de `POST /api/sales`, atualizar `GET /api/sales/today`
- `src/app/api/sales/route.ts` — remover `POST` (substituído pela Server Action)
- `src/app/api/sales/today/route.ts` — retornar `{ sales, faturamento, lucro }`
- `src/app/(protected)/dashboard/page.tsx` — novo layout: resumo de hoje + lista de dias
- `src/__tests__/setup.ts` — adicionar `sale.upsert` e `sale.deleteMany` ao mock do Prisma

**Criados:**
- `src/app/(protected)/lancamento/page.tsx` — Server Component: carrega produtos + lançamentos do dia
- `src/app/(protected)/lancamento/LancamentoForm.tsx` — Client Component: lista − / + com total ao vivo
- `src/app/(protected)/lancamento/actions.ts` — Server Action `salvarLancamento`
- `src/__tests__/actions/salvarLancamento.test.ts` — testes da Server Action

**Excluídos:**
- `src/app/(protected)/dashboard/ProductButton.tsx` — não existe mais no novo fluxo
- `src/app/(protected)/dashboard/actions.ts` — substituído por `/lancamento/actions.ts`
- `src/__tests__/actions/registerSale.test.ts` — substituído por `salvarLancamento.test.ts`

---

## Task 1: Atualizar o mock do Prisma nos testes

**Files:**
- Modify: `src/__tests__/setup.ts`

O mock global precisa expor `sale.upsert` e `sale.deleteMany` que serão usados pela nova Server Action.

- [ ] **Step 1: Atualizar setup.ts**

Substituir o conteúdo completo de `src/__tests__/setup.ts`:

```ts
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
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))
```

- [ ] **Step 2: Rodar os testes e confirmar que ainda passam**

```bash
npm run test
```

Saída esperada: todos os testes passam. (Nenhum teste usa os novos métodos ainda.)

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/setup.ts
git commit -m "test: expose sale.upsert and sale.deleteMany in Prisma mock"
```

---

## Task 2: Substituir `calcularTotalDia` por `calcularResumo`

**Files:**
- Modify: `src/lib/totals.ts`
- Modify: `src/__tests__/lib/totals.test.ts`

- [ ] **Step 1: Escrever os testes novos (TDD — falharão até Task 2 Step 3)**

Substituir o conteúdo completo de `src/__tests__/lib/totals.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularResumo } from '@/lib/totals'

describe('calcularResumo', () => {
  it('retorna zeros quando não há vendas', () => {
    expect(calcularResumo([])).toEqual({ faturamento: 0, lucro: 0 })
  })

  it('calcula faturamento como soma de quantity * unitPrice', () => {
    const sales = [
      { quantity: 10, unitPrice: 18.0, unitCost: 9.0 },
      { quantity: 5,  unitPrice: 6.0,  unitCost: 2.0 },
    ]
    expect(calcularResumo(sales).faturamento).toBeCloseTo(210.0)
  })

  it('calcula lucro como soma de quantity * (unitPrice - unitCost)', () => {
    const sales = [
      { quantity: 10, unitPrice: 18.0, unitCost: 9.0 },
      { quantity: 5,  unitPrice: 6.0,  unitCost: 2.0 },
    ]
    expect(calcularResumo(sales).lucro).toBeCloseTo(110.0)
  })

  it('lucro é zero quando unitCost === unitPrice', () => {
    const sales = [{ quantity: 3, unitPrice: 10.0, unitCost: 10.0 }]
    expect(calcularResumo(sales).lucro).toBe(0)
  })

  it('lida com venda única', () => {
    const sales = [{ quantity: 1, unitPrice: 15.99, unitCost: 8.0 }]
    const result = calcularResumo(sales)
    expect(result.faturamento).toBeCloseTo(15.99)
    expect(result.lucro).toBeCloseTo(7.99)
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
npx vitest run src/__tests__/lib/totals.test.ts
```

Saída esperada: FAIL — `calcularResumo` não encontrada.

- [ ] **Step 3: Implementar `calcularResumo` em `src/lib/totals.ts`**

Substituir o conteúdo completo de `src/lib/totals.ts`:

```ts
export function calcularResumo(
  sales: { quantity: number; unitPrice: number; unitCost: number }[]
): { faturamento: number; lucro: number } {
  return sales.reduce(
    (acc, s) => ({
      faturamento: acc.faturamento + s.quantity * s.unitPrice,
      lucro: acc.lucro + s.quantity * (s.unitPrice - s.unitCost),
    }),
    { faturamento: 0, lucro: 0 }
  )
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npx vitest run src/__tests__/lib/totals.test.ts
```

Saída esperada: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/totals.ts src/__tests__/lib/totals.test.ts
git commit -m "feat: replace calcularTotalDia with calcularResumo (faturamento + lucro)"
```

---

## Task 3: Migração do banco — novo modelo `Sale`

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Atualizar o schema**

Substituir o modelo `Sale` existente em `prisma/schema.prisma`:

```prisma
model Sale {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  date      DateTime @db.Date
  quantity  Int
  unitPrice Float
  unitCost  Float
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, productId, date])
}
```

- [ ] **Step 2: Criar a migration (destrói dados de venda existentes — esperado)**

```bash
npx prisma migrate dev --name sale-aggregate-by-day
```

Saída esperada: migração aplicada, cliente Prisma regenerado. Os dados da tabela `Sale` anterior são descartados.

- [ ] **Step 3: Confirmar que o build não quebra**

```bash
npm run build
```

Saída esperada: build sem erros de tipo. (Haverá erros de TS nas rotas/pages que ainda usam o modelo antigo — normal neste ponto; serão corrigidos nas próximas tasks.)

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: redefine Sale as daily aggregate (quantity + price/cost snapshots)"
```

---

## Task 4: Atualizar `GET /api/sales/today` e remover `POST /api/sales`

**Files:**
- Modify: `src/app/api/sales/today/route.ts`
- Modify: `src/app/api/sales/route.ts`
- Modify: `src/__tests__/api/sales.test.ts`

- [ ] **Step 1: Escrever os novos testes (substituindo os antigos)**

Substituir o conteúdo completo de `src/__tests__/api/sales.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/sales/today/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

beforeEach(() => vi.clearAllMocks())

describe('GET /api/sales/today', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/sales/today'))
    expect(res.status).toBe(401)
  })

  it('retorna faturamento e lucro calculados das vendas de hoje', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockSales = [
      { id: 's1', quantity: 10, unitPrice: 18.0, unitCost: 9.0, date: new Date(), product: { name: 'X-Burguer' } },
      { id: 's2', quantity: 5,  unitPrice: 6.0,  unitCost: 2.0, date: new Date(), product: { name: 'Refri' } },
    ]
    vi.mocked(prisma.sale.findMany).mockResolvedValue(mockSales as any)

    const res = await GET(new Request('http://localhost/api/sales/today'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.faturamento).toBeCloseTo(210.0)
    expect(data.lucro).toBeCloseTo(110.0)
    expect(data.sales).toHaveLength(2)
  })

  it('retorna zeros quando não há vendas hoje', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.sale.findMany).mockResolvedValue([])

    const res = await GET(new Request('http://localhost/api/sales/today'))
    const data = await res.json()

    expect(data.faturamento).toBe(0)
    expect(data.lucro).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
npx vitest run src/__tests__/api/sales.test.ts
```

Saída esperada: FAIL — `data.faturamento` e `data.lucro` não existem ainda.

- [ ] **Step 3: Atualizar `src/app/api/sales/today/route.ts`**

Substituir o conteúdo completo:

```ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { calcularResumo } from '@/lib/totals'

export async function GET(_req?: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sales = await prisma.sale.findMany({
    where: { userId: session.user.id, date: today },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const { faturamento, lucro } = calcularResumo(sales)
  return NextResponse.json({ sales, faturamento, lucro })
}
```

- [ ] **Step 4: Atualizar `src/app/api/sales/route.ts`** — remover o `POST` (substituído pela Server Action)

Substituir o conteúdo completo:

```ts
// POST /api/sales foi substituído pela Server Action salvarLancamento
// em src/app/(protected)/lancamento/actions.ts
export {}
```

- [ ] **Step 5: Rodar os testes**

```bash
npx vitest run src/__tests__/api/sales.test.ts
```

Saída esperada: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/sales/today/route.ts src/app/api/sales/route.ts src/__tests__/api/sales.test.ts
git commit -m "feat: update sales/today to return faturamento+lucro, remove POST /api/sales"
```

---

## Task 5: Server Action `salvarLancamento`

**Files:**
- Create: `src/app/(protected)/lancamento/actions.ts`
- Create: `src/__tests__/actions/salvarLancamento.test.ts`
- Delete: `src/__tests__/actions/registerSale.test.ts` (substituído)
- Delete: `src/app/(protected)/dashboard/actions.ts` (substituído)

- [ ] **Step 1: Escrever os testes da nova Server Action**

Criar `src/__tests__/actions/salvarLancamento.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { salvarLancamento } from '@/app/(protected)/lancamento/actions'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }
const mockProduct = {
  id: 'p-1', userId: 'user-1', name: 'X-Burguer', price: 18.0, cost: 9.0, createdAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('salvarLancamento', () => {
  it('lança erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await expect(salvarLancamento('2026-06-06', [])).rejects.toThrow('Não autorizado')
  })

  it('rejeita data futura', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const futureDate = tomorrow.toISOString().slice(0, 10)
    await expect(salvarLancamento(futureDate, [])).rejects.toThrow('Data inválida')
  })

  it('rejeita quantidade negativa', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const itens = [{ productId: 'p-1', quantity: -1 }]
    await expect(salvarLancamento('2026-06-06', itens)).rejects.toThrow('Quantidade inválida')
  })

  it('rejeita quantidade decimal', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const itens = [{ productId: 'p-1', quantity: 1.5 }]
    await expect(salvarLancamento('2026-06-06', itens)).rejects.toThrow('Quantidade inválida')
  })

  it('faz upsert com snapshot de preço e custo para quantity > 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.upsert).mockResolvedValue({} as any)

    await salvarLancamento('2026-06-06', [{ productId: 'p-1', quantity: 12 }])

    expect(prisma.sale.upsert).toHaveBeenCalledWith({
      where: { userId_productId_date: { userId: 'user-1', productId: 'p-1', date: new Date('2026-06-06') } },
      update: { quantity: 12, unitPrice: 18.0, unitCost: 9.0 },
      create: { userId: 'user-1', productId: 'p-1', date: new Date('2026-06-06'), quantity: 12, unitPrice: 18.0, unitCost: 9.0 },
    })
  })

  it('remove linha existente quando quantity === 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.deleteMany).mockResolvedValue({ count: 1 })

    await salvarLancamento('2026-06-06', [{ productId: 'p-1', quantity: 0 }])

    expect(prisma.sale.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', productId: 'p-1', date: new Date('2026-06-06') },
    })
    expect(prisma.sale.upsert).not.toHaveBeenCalled()
  })

  it('rejeita produto que não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)

    await expect(
      salvarLancamento('2026-06-06', [{ productId: 'p-outro', quantity: 5 }])
    ).rejects.toThrow('Produto não encontrado')
  })

  it('revalida dashboard e lancamento após salvar', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.upsert).mockResolvedValue({} as any)

    await salvarLancamento('2026-06-06', [{ productId: 'p-1', quantity: 5 }])

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    expect(revalidatePath).toHaveBeenCalledWith('/lancamento')
  })
})
```

- [ ] **Step 2: Rodar para confirmar que falham**

```bash
npx vitest run src/__tests__/actions/salvarLancamento.test.ts
```

Saída esperada: FAIL — `salvarLancamento` não encontrada.

- [ ] **Step 3: Criar `src/app/(protected)/lancamento/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function salvarLancamento(
  dateStr: string,
  itens: { productId: string; quantity: number }[]
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const date = new Date(dateStr)
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  if (isNaN(date.getTime()) || date > today) throw new Error('Data inválida')

  for (const item of itens) {
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      throw new Error('Quantidade inválida')
    }
  }

  for (const item of itens) {
    const product = await prisma.product.findFirst({
      where: { id: item.productId, userId: session.user.id },
    })
    if (!product) throw new Error('Produto não encontrado')

    const saleDate = new Date(dateStr)

    if (item.quantity === 0) {
      await prisma.sale.deleteMany({
        where: { userId: session.user.id, productId: item.productId, date: saleDate },
      })
    } else {
      await prisma.sale.upsert({
        where: {
          userId_productId_date: {
            userId: session.user.id,
            productId: item.productId,
            date: saleDate,
          },
        },
        update: { quantity: item.quantity, unitPrice: product.price, unitCost: product.cost },
        create: {
          userId: session.user.id,
          productId: item.productId,
          date: saleDate,
          quantity: item.quantity,
          unitPrice: product.price,
          unitCost: product.cost,
        },
      })
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/lancamento')
}
```

- [ ] **Step 4: Rodar os testes**

```bash
npx vitest run src/__tests__/actions/salvarLancamento.test.ts
```

Saída esperada: 8 passed.

- [ ] **Step 5: Remover arquivos substituídos**

```bash
rm src/app/(protected)/dashboard/actions.ts
rm src/__tests__/actions/registerSale.test.ts
```

- [ ] **Step 6: Rodar todos os testes**

```bash
npm run test
```

Saída esperada: todos passam (exceto erros de import de `registerSale` se houver — serão corrigidos na próxima task).

- [ ] **Step 7: Commit**

```bash
git add src/app/(protected)/lancamento/actions.ts src/__tests__/actions/salvarLancamento.test.ts
git rm src/app/(protected)/dashboard/actions.ts src/__tests__/actions/registerSale.test.ts
git commit -m "feat: add salvarLancamento server action with upsert and validation"
```

---

## Task 6: Tela de lançamento — componente cliente

**Files:**
- Create: `src/app/(protected)/lancamento/LancamentoForm.tsx`

O LancamentoForm é um Client Component puro — não faz fetch, apenas gerencia o estado local dos campos e exibe os totais ao vivo.

- [ ] **Step 1: Criar `src/app/(protected)/lancamento/LancamentoForm.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { salvarLancamento } from './actions'
import { calcularResumo } from '@/lib/totals'

interface Produto {
  id: string
  name: string
  price: number
  cost: number
}

interface LancamentoFormProps {
  produtos: Produto[]
  dateStr: string        // 'YYYY-MM-DD'
  initialQtds: Record<string, number>  // productId → quantity já salva
}

export function LancamentoForm({ produtos, dateStr, initialQtds }: LancamentoFormProps) {
  const [qtds, setQtds] = useState<Record<string, number>>(initialQtds)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  function getQtd(id: string) { return qtds[id] ?? 0 }

  function setQtd(id: string, val: number) {
    const safe = Math.max(0, Math.floor(val))
    setQtds(prev => ({ ...prev, [id]: safe }))
  }

  function handleInput(id: string, raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    setQtd(id, isNaN(n) ? 0 : n)
  }

  const salesForCalc = produtos.map(p => ({
    quantity: getQtd(p.id),
    unitPrice: p.price,
    unitCost: p.cost,
  }))
  const { faturamento, lucro } = calcularResumo(salesForCalc)

  function handleSalvar() {
    startTransition(async () => {
      try {
        const itens = produtos.map(p => ({ productId: p.id, quantity: getQtd(p.id) }))
        await salvarLancamento(dateStr, itens)
        setStatus('success')
        setTimeout(() => setStatus('idle'), 2000)
      } catch {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 2000)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {produtos.map(p => (
        <div
          key={p.id}
          className="flex items-center justify-between bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3"
        >
          <div>
            <p className="font-semibold dark:text-slate-100">{p.name}</p>
            <p className="text-sm text-gray-400 dark:text-slate-500">R$ {p.price.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQtd(p.id, getQtd(p.id) - 1)}
              disabled={getQtd(p.id) === 0}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-xl disabled:opacity-30"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={getQtd(p.id)}
              onChange={e => handleInput(p.id, e.target.value)}
              className="w-14 h-9 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900 text-center font-bold text-lg dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={() => setQtd(p.id, getQtd(p.id) + 1)}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-xl"
            >
              +
            </button>
          </div>
        </div>
      ))}

      <div className="bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-3 mt-1">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-gray-500 dark:text-slate-400">Faturamento</span>
          <span className="text-2xl font-bold text-green-600">R$ {faturamento.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-baseline mt-1">
          <span className="text-sm text-gray-500 dark:text-slate-400">Lucro estimado</span>
          <span className="text-base font-semibold text-emerald-500">R$ {lucro.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={handleSalvar}
        disabled={isPending}
        className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all disabled:opacity-50 ${
          status === 'success' ? 'bg-green-500' :
          status === 'error'   ? 'bg-red-500' :
                                 'bg-orange-500'
        }`}
      >
        {isPending       ? 'Salvando...' :
         status === 'success' ? '✓ Salvo!' :
         status === 'error'   ? '✗ Erro ao salvar' :
                                'Salvar dia'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verificar que o TypeScript compila sem erros**

```bash
npx tsc --noEmit
```

Saída esperada: sem erros relacionados a `LancamentoForm`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(protected)/lancamento/LancamentoForm.tsx
git commit -m "feat: add LancamentoForm client component with stepper and live totals"
```

---

## Task 7: Tela de lançamento — Server Component (page)

**Files:**
- Create: `src/app/(protected)/lancamento/page.tsx`

- [ ] **Step 1: Criar `src/app/(protected)/lancamento/page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LancamentoForm } from './LancamentoForm'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ data?: string }>
}

export default async function LancamentoPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  const { data: dataParam } = await searchParams

  const today = new Date().toISOString().slice(0, 10)
  const dateStr = dataParam ?? today

  const date = new Date(dateStr)
  const isToday = dateStr === today

  const [produtos, salesExistentes] = await Promise.all([
    prisma.product.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.sale.findMany({
      where: { userId: session!.user.id, date },
    }),
  ])

  const initialQtds: Record<string, number> = {}
  for (const s of salesExistentes) {
    initialQtds[s.productId] = s.quantity
  }

  const dateLabel = isToday
    ? 'Hoje'
    : date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      {/* Header mobile */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <Link href="/dashboard" className="text-orange-500 text-sm">← Voltar</Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold dark:text-slate-100">
          Vendas · {dateLabel}
        </h1>
        <Link href="#" className="text-orange-500 text-sm font-medium">trocar data</Link>
      </div>

      {produtos.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-slate-400 mb-4">Nenhum produto cadastrado.</p>
          <Link
            href="/products/new"
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Cadastrar produto
          </Link>
        </div>
      ) : (
        <LancamentoForm
          produtos={produtos}
          dateStr={dateStr}
          initialQtds={initialQtds}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Adicionar `/lancamento` ao proxy (proteção de rota)**

Em `src/proxy.ts`, adicionar `/lancamento/:path*` ao `matcher`:

```ts
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
})

export const config = {
  matcher: ['/dashboard/:path*', '/products/:path*', '/lancamento/:path*'],
}
```

- [ ] **Step 3: Verificar que o TypeScript compila**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(protected)/lancamento/page.tsx src/proxy.ts
git commit -m "feat: add /lancamento page with date param and pre-filled quantities"
```

---

## Task 8: Atualizar o Dashboard

**Files:**
- Modify: `src/app/(protected)/dashboard/page.tsx`
- Delete: `src/app/(protected)/dashboard/ProductButton.tsx`

O dashboard deixa de mostrar botões de produto. Passa a exibir: card de hoje (faturamento + lucro) + botão "Lançar vendas de hoje" + lista de dias anteriores.

- [ ] **Step 1: Atualizar `src/app/(protected)/dashboard/page.tsx`**

Substituir o conteúdo completo:

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularResumo } from '@/lib/totals'
import { LogoutButton } from './LogoutButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Vendas de hoje
  const salesToday = await prisma.sale.findMany({
    where: { userId: session!.user.id, date: today },
  })
  const { faturamento: fatHoje, lucro: lucroHoje } = calcularResumo(salesToday)

  // Últimos 7 dias (excluindo hoje)
  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const salesPassadas = await prisma.sale.findMany({
    where: {
      userId: session!.user.id,
      date: { gte: sevenDaysAgo, lt: today },
    },
    orderBy: { date: 'desc' },
  })

  // Agrupar por dia
  const porDia = new Map<string, typeof salesPassadas>()
  for (const s of salesPassadas) {
    const key = s.date.toISOString().slice(0, 10)
    if (!porDia.has(key)) porDia.set(key, [])
    porDia.get(key)!.push(s)
  }

  const todayStr = today.toISOString().slice(0, 10)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      {/* Header mobile */}
      <div className="flex justify-between items-center mb-4 lg:hidden">
        <span className="text-gray-500 dark:text-slate-400 text-sm">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <div className="flex items-center gap-3">
          <Link href="/products" className="text-orange-500 text-sm font-medium">Produtos</Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      {/* Card de hoje */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mb-4 text-center shadow-sm">
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-1">Hoje</p>
        <p className="text-4xl font-bold text-green-600">R$ {fatHoje.toFixed(2)}</p>
        <p className="text-emerald-500 font-semibold mt-1">lucro R$ {lucroHoje.toFixed(2)}</p>
      </div>

      {/* Botão principal */}
      <Link
        href="/lancamento"
        className="block w-full bg-orange-500 text-white text-center py-4 rounded-xl font-bold text-lg mb-6"
      >
        Lançar vendas de hoje
      </Link>

      {/* Dias anteriores */}
      {porDia.size > 0 && (
        <>
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">
            Dias anteriores
          </p>
          <div className="flex flex-col gap-2">
            {Array.from(porDia.entries()).map(([dateStr, sales]) => {
              const { faturamento, lucro } = calcularResumo(sales)
              const date = new Date(dateStr + 'T00:00:00')
              const label = date.toLocaleDateString('pt-BR', {
                weekday: 'short', day: '2-digit', month: '2-digit',
              })
              const totalItens = sales.reduce((s, r) => s + r.quantity, 0)
              return (
                <Link
                  key={dateStr}
                  href={`/lancamento?data=${dateStr}`}
                  className="flex justify-between items-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-semibold dark:text-slate-100">{label}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{totalItens} itens</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">R$ {faturamento.toFixed(2)}</p>
                    <p className="text-xs text-emerald-500 font-semibold">lucro R$ {lucro.toFixed(2)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Remover `ProductButton.tsx`**

```bash
rm src/app/(protected)/dashboard/ProductButton.tsx
```

- [ ] **Step 3: Rodar todos os testes**

```bash
npm run test
```

Saída esperada: todos passam.

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Saída esperada: sem erros.

- [ ] **Step 5: Commit**

```bash
git rm src/app/(protected)/dashboard/ProductButton.tsx
git add src/app/(protected)/dashboard/page.tsx
git commit -m "feat: redesign dashboard as daily summary with lancamento CTA"
```

---

## Task 9: Verificação final

- [ ] **Step 1: Rodar todos os testes**

```bash
npm run test
```

Saída esperada: todos passam.

- [ ] **Step 2: Build de produção**

```bash
npm run build
```

Saída esperada: build sem erros.

- [ ] **Step 3: Testar no navegador (dev server)**

```bash
npm run dev
```

Verificar:
- `/dashboard` mostra card de hoje (R$ 0,00 se não há lançamentos) + botão "Lançar vendas de hoje"
- Clicar no botão abre `/lancamento` com todos os produtos listados com − / + e número editável
- Digitar quantidades atualiza o total ao vivo
- Clicar "Salvar dia" → botão mostra "✓ Salvo!" e volta ao normal
- Voltar ao dashboard mostra os valores atualizados
- Dias anteriores aparecem na lista quando existem lançamentos

- [ ] **Step 4: Commit final**

Se algum ajuste visual foi feito:

```bash
git add -p
git commit -m "fix: visual adjustments after manual verification"
```
