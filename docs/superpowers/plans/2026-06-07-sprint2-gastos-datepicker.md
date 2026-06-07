# Sprint 2 — Seletor de Data + Gestão de Gastos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar seletor de data funcional no lançamento e uma tela de gestão de gastos com formulário detalhado, lista agrupada por categoria e filtro por período.

**Architecture:** Página `/gastos` como Server Component com formulário inline e lista agrupada, operada por Server Actions (`adicionarGasto`, `removerGasto`). Filtro de data via query params GET. `DatePicker` é um Client Component isolado em `/lancamento`. Novo model `Expense` no Prisma sem alterar tabelas existentes.

**Tech Stack:** Next.js 16 App Router, Prisma com `@prisma/adapter-pg`, NextAuth v4, Tailwind CSS, Vitest (testes de actions com mock do Prisma)

---

## File Map

| Ação | Arquivo |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `prisma/migrations/<timestamp>_add_expense/migration.sql` (gerada automaticamente) |
| Create | `src/app/(protected)/lancamento/DatePicker.tsx` |
| Modify | `src/app/(protected)/lancamento/page.tsx` |
| Create | `src/app/(protected)/gastos/actions.ts` |
| Create | `src/app/(protected)/gastos/page.tsx` |
| Modify | `src/components/Sidebar.tsx` |
| Create | `src/__tests__/actions/adicionarGasto.test.ts` |
| Create | `src/__tests__/actions/removerGasto.test.ts` |

---

## Task 1: Adicionar model Expense ao Prisma

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Adicionar o model Expense ao schema**

Abrir `prisma/schema.prisma` e adicionar ao final, após o model `Sale`:

```prisma
model Expense {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  date        DateTime @db.Date
  category    String
  description String
  quantity    Float
  unit        String
  value       Float
  createdAt   DateTime @default(now())
}
```

Também adicionar a relação inversa no model `User` (após `sales Sale[]`):

```prisma
  expenses  Expense[]
```

- [ ] **Step 2: Rodar a migration**

```bash
cd sistema-lanches && npx prisma migrate dev --name add_expense
```

Esperado: mensagem `The following migration(s) have been created and applied` e `Generated Prisma Client`.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Expense model to Prisma schema"
```

---

## Task 2: Server Action adicionarGasto (TDD)

**Files:**
- Create: `src/__tests__/actions/adicionarGasto.test.ts`
- Create: `src/app/(protected)/gastos/actions.ts`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/__tests__/actions/adicionarGasto.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

async function importAction() {
  const { adicionarGasto } = await import('@/app/(protected)/gastos/actions')
  return adicionarGasto
}

beforeEach(() => vi.clearAllMocks())

describe('adicionarGasto', () => {
  it('lança erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    await expect(adicionarGasto(fd)).rejects.toThrow('Não autorizado')
  })

  it('lança erro se data é futura', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const fd = new FormData()
    fd.set('date', tomorrow.toISOString().slice(0, 10))
    fd.set('category', 'Ingredientes')
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    await expect(adicionarGasto(fd)).rejects.toThrow('Data inválida')
  })

  it('lança erro se value <= 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    fd.set('category', 'Ingredientes')
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '0')
    await expect(adicionarGasto(fd)).rejects.toThrow('Valor inválido')
  })

  it('lança erro se quantity <= 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    fd.set('category', 'Ingredientes')
    fd.set('description', 'Frango')
    fd.set('quantity', '0')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    await expect(adicionarGasto(fd)).rejects.toThrow('Quantidade inválida')
  })

  it('lança erro se campo obrigatório ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    // category ausente
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    await expect(adicionarGasto(fd)).rejects.toThrow('Campos obrigatórios ausentes')
  })

  it('persiste o gasto com userId da sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.create).mockResolvedValue({} as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    fd.set('category', 'Ingredientes')
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    await adicionarGasto(fd)
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        date: new Date('2026-06-07'),
        category: 'Ingredientes',
        description: 'Frango',
        quantity: 3,
        unit: 'kg',
        value: 90,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/gastos')
  })
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd sistema-lanches && npx vitest run src/__tests__/actions/adicionarGasto.test.ts
```

Esperado: FAIL — `Cannot find module '@/app/(protected)/gastos/actions'`

- [ ] **Step 3: Criar `src/app/(protected)/gastos/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CATEGORIES = ['Ingredientes', 'Descartáveis', 'Salgados prontos', 'Outros'] as const

export async function adicionarGasto(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const date = formData.get('date') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const quantityRaw = formData.get('quantity') as string
  const unit = formData.get('unit') as string
  const valueRaw = formData.get('value') as string

  if (!date || !category || !description || !quantityRaw || !unit || !valueRaw) {
    throw new Error('Campos obrigatórios ausentes')
  }

  const today = new Date().toISOString().slice(0, 10)
  if (date > today) throw new Error('Data inválida')

  const quantity = parseFloat(quantityRaw)
  if (isNaN(quantity) || quantity <= 0) throw new Error('Quantidade inválida')

  const value = parseFloat(valueRaw)
  if (isNaN(value) || value <= 0) throw new Error('Valor inválido')

  await prisma.expense.create({
    data: {
      userId: session.user.id,
      date: new Date(date),
      category,
      description,
      quantity,
      unit,
      value,
    },
  })

  revalidatePath('/gastos')
}

export async function removerGasto(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const expense = await prisma.expense.findFirst({ where: { id } })
  if (!expense) throw new Error('Gasto não encontrado')
  if (expense.userId !== session.user.id) throw new Error('Não autorizado')

  await prisma.expense.delete({ where: { id } })
  revalidatePath('/gastos')
}
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd sistema-lanches && npx vitest run src/__tests__/actions/adicionarGasto.test.ts
```

Esperado: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/actions/adicionarGasto.test.ts src/app/(protected)/gastos/actions.ts
git commit -m "feat: add adicionarGasto server action with tests"
```

---

## Task 3: Server Action removerGasto (TDD)

**Files:**
- Create: `src/__tests__/actions/removerGasto.test.ts`
- (actions.ts já criado na Task 2)

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/__tests__/actions/removerGasto.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }
const mockExpense = {
  id: 'exp-1',
  userId: 'user-1',
  date: new Date('2026-06-07'),
  category: 'Ingredientes',
  description: 'Frango',
  quantity: 3,
  unit: 'kg',
  value: 90,
  createdAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('removerGasto', () => {
  it('lança erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await expect(removerGasto('exp-1')).rejects.toThrow('Não autorizado')
  })

  it('lança erro se gasto não encontrado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(null)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await expect(removerGasto('exp-inexistente')).rejects.toThrow('Gasto não encontrado')
  })

  it('lança erro se gasto pertence a outro usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ ...mockExpense, userId: 'outro-user' } as any)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await expect(removerGasto('exp-1')).rejects.toThrow('Não autorizado')
  })

  it('deleta o gasto quando válido', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(mockExpense as any)
    vi.mocked(prisma.expense.delete).mockResolvedValue(mockExpense as any)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await removerGasto('exp-1')
    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'exp-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/gastos')
  })
})
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd sistema-lanches && npx vitest run src/__tests__/actions/removerGasto.test.ts
```

Esperado: FAIL — os mocks de `prisma.expense` ainda não existem no setup global do Prisma mock.

- [ ] **Step 3: Adicionar `expense` ao mock global do Prisma**

Abrir `src/__tests__/setup.ts` (ou o arquivo onde `@/lib/prisma` é mockado). Verificar o conteúdo atual com:

```bash
cat src/__tests__/setup.ts 2>/dev/null || find src -name "setup.ts" -path "*__tests__*"
```

Localizar onde os mocks do Prisma são definidos (provavelmente em `src/__tests__/setup.ts` ou diretamente nos arquivos de teste via `vi.mock('@/lib/prisma')`). O mock do Prisma no projeto usa o `src/__mocks__/` ou é configurado via `vitest.config.ts`.

Verificar:
```bash
cat sistema-lanches/vitest.config.ts
cat sistema-lanches/src/__tests__/setup.ts 2>/dev/null
find sistema-lanches/src -name "*.ts" | xargs grep -l "vi.mock.*prisma" | head -5
```

O mock global em `src/__tests__` provavelmente tem um arquivo que exporta stubs. Adicionar `expense` ao objeto mockado com os métodos necessários:

```typescript
// Onde prisma é mockado (ex: src/__mocks__/lib/prisma.ts ou similar)
expense: {
  create: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  delete: vi.fn(),
},
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd sistema-lanches && npx vitest run src/__tests__/actions/removerGasto.test.ts src/__tests__/actions/adicionarGasto.test.ts
```

Esperado: todos os testes PASS.

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/actions/removerGasto.test.ts
git commit -m "feat: add removerGasto server action with tests"
```

---

## Task 4: DatePicker — seletor de data no lançamento

**Files:**
- Create: `src/app/(protected)/lancamento/DatePicker.tsx`
- Modify: `src/app/(protected)/lancamento/page.tsx`

- [ ] **Step 1: Criar o componente DatePicker**

Criar `src/app/(protected)/lancamento/DatePicker.tsx`:

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DatePickerProps {
  currentDate: string  // 'YYYY-MM-DD'
  today: string        // 'YYYY-MM-DD'
}

export function DatePicker({ currentDate, today }: DatePickerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    setOpen(false)
    router.push(`/lancamento?data=${val}`)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-orange-500 text-sm font-medium"
      >
        trocar data
      </button>
    )
  }

  return (
    <input
      type="date"
      defaultValue={currentDate}
      max={today}
      autoFocus
      onChange={handleChange}
      onBlur={() => setOpen(false)}
      className="text-sm border border-orange-400 rounded-lg px-2 py-1 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
    />
  )
}
```

- [ ] **Step 2: Atualizar lancamento/page.tsx para usar DatePicker**

Em `src/app/(protected)/lancamento/page.tsx`, substituir a linha com `<Link href="#">` (linha 51) pelo componente `DatePicker`:

Remover:
```typescript
import Link from 'next/link'
```
(manter se ainda for usado em outro lugar na página — verificar se o import é necessário)

Adicionar import:
```typescript
import { DatePicker } from './DatePicker'
```

Substituir:
```typescript
<Link href="#" className="text-orange-500 text-sm font-medium">trocar data</Link>
```

Por:
```typescript
<DatePicker currentDate={dateStr} today={today} />
```

- [ ] **Step 3: Rodar o build para verificar tipos**

```bash
cd sistema-lanches && npm run build 2>&1 | tail -20
```

Esperado: build sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/app/(protected)/lancamento/DatePicker.tsx src/app/(protected)/lancamento/page.tsx
git commit -m "feat: add date picker to lancamento page"
```

---

## Task 5: Página de Gastos — /gastos

**Files:**
- Create: `src/app/(protected)/gastos/page.tsx`

- [ ] **Step 1: Criar a página**

Criar `src/app/(protected)/gastos/page.tsx`:

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adicionarGasto, removerGasto } from './actions'

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>
}

const CATEGORY_ORDER = ['Ingredientes', 'Descartáveis', 'Salgados prontos', 'Outros'] as const

function defaultDe() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function defaultAte() {
  return new Date().toISOString().slice(0, 10)
}

export default async function GastosPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  const { de, ate } = await searchParams

  const deStr = de ?? defaultDe()
  const ateStr = ate ?? defaultAte()

  const today = defaultAte()

  const expenses = await prisma.expense.findMany({
    where: {
      userId: session!.user.id,
      date: {
        gte: new Date(deStr),
        lte: new Date(ateStr),
      },
    },
    orderBy: { date: 'desc' },
  })

  // Agrupar por categoria
  const byCategory = new Map<string, typeof expenses>()
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, [])
  for (const e of expenses) {
    const key = CATEGORY_ORDER.includes(e.category as any) ? e.category : 'Outros'
    byCategory.get(key)!.push(e)
  }

  const totalGeral = expenses.reduce((s, e) => s + e.value, 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <h1 className="text-xl font-bold dark:text-slate-100 mb-4">Gastos</h1>

      {/* Filtro de período */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">De</label>
          <input
            type="date"
            name="de"
            defaultValue={deStr}
            max={today}
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Até</label>
          <input
            type="date"
            name="ate"
            defaultValue={ateStr}
            max={today}
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="submit"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Filtrar
        </button>
      </form>

      {/* Formulário de adição */}
      <form
        action={adicionarGasto}
        className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col gap-3"
      >
        <p className="font-semibold dark:text-slate-100 text-sm">Novo gasto</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Data</label>
            <input
              type="date"
              name="date"
              defaultValue={today}
              max={today}
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Categoria</label>
            <select
              name="category"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Selecionar...</option>
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Descrição</label>
            <input
              type="text"
              name="description"
              placeholder="ex: Frango"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Qtd</label>
            <input
              type="number"
              name="quantity"
              step="0.01"
              min="0.01"
              placeholder="0"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Unidade</label>
            <input
              type="text"
              name="unit"
              placeholder="ex: kg"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Valor (R$)</label>
            <input
              type="number"
              name="value"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm mt-1"
        >
          Adicionar gasto
        </button>
      </form>

      {/* Lista agrupada por categoria */}
      {expenses.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 py-8">
          Nenhum gasto registrado no período.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {CATEGORY_ORDER.map(cat => {
            const items = byCategory.get(cat)!
            if (items.length === 0) return null
            const totalCat = items.reduce((s, e) => s + e.value, 0)
            return (
              <div key={cat} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 border-b dark:border-slate-700">
                  <span className="font-semibold dark:text-slate-100">{cat}</span>
                  <span className="font-bold text-green-600">R$ {totalCat.toFixed(2)}</span>
                </div>
                {items.map(e => (
                  <div key={e.id} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
                    <div>
                      <p className="text-sm dark:text-slate-200">
                        {e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {e.description} · {e.quantity}{e.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold dark:text-slate-200">R$ {e.value.toFixed(2)}</span>
                      <form action={removerGasto.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Remover
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          <div className="flex justify-between items-center px-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-xl">
            <span className="font-semibold dark:text-slate-200">Total do período</span>
            <span className="font-bold text-green-600 text-lg">R$ {totalGeral.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rodar o build para verificar tipos**

```bash
cd sistema-lanches && npm run build 2>&1 | tail -20
```

Esperado: build sem erros de tipo.

- [ ] **Step 3: Commit**

```bash
git add src/app/(protected)/gastos/page.tsx
git commit -m "feat: add gastos page with form and grouped list"
```

---

## Task 6: Adicionar Gastos à Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Adicionar link de Gastos na nav**

Em `src/components/Sidebar.tsx`, dentro do `<nav>`, adicionar após o link de Produtos:

```typescript
<Link href="/gastos" className={navClass('/gastos')}>
  Gastos
</Link>
```

- [ ] **Step 2: Rodar todos os testes para garantir que nada quebrou**

```bash
cd sistema-lanches && npm run test
```

Esperado: todos os testes PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add Gastos link to sidebar navigation"
```

---

## Task 7: Adicionar /gastos ao proxy de autenticação

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Verificar a configuração atual do proxy**

```bash
cat sistema-lanches/src/proxy.ts
```

O `withAuth` protege rotas via matcher. Verificar se `/gastos` já está coberto pelo matcher atual. Se o matcher usar `/dashboard` e `/products` explicitamente, adicionar `/gastos`.

- [ ] **Step 2: Atualizar o matcher se necessário**

Se o arquivo tiver um `config.matcher` com rotas explícitas, adicionar `'/gastos/:path*'`. Se já usar um padrão como `'/(protected)/:path*'` ou similar, nenhuma mudança é necessária.

- [ ] **Step 3: Rodar o build final**

```bash
cd sistema-lanches && npm run build 2>&1 | tail -20
```

Esperado: build sem erros.

- [ ] **Step 4: Commit final**

```bash
git add src/proxy.ts
git commit -m "feat: protect /gastos route in auth proxy"
```

---

## Checklist de auto-review

- [x] Spec coverage: Task 1 (modelo), Task 2+3 (Server Actions), Task 4 (DatePicker), Task 5 (página), Task 6 (navegação), Task 7 (proteção de rota)
- [x] Sem placeholders: todos os steps têm código completo
- [x] Consistência de tipos: `adicionarGasto(formData: FormData)` e `removerGasto(id: string)` usados de forma consistente nas Tasks 2, 3 e 5
- [x] O mock de `prisma.expense` precisa ser adicionado ao setup global — coberto no Step 3 da Task 3
