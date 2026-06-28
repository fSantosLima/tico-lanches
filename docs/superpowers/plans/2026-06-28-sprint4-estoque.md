# Sprint 4 — Controle de Estoque de Produtos Vendáveis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir saber o saldo de estoque de cada produto vendável, registrar entradas (reposições) e alertar quando o estoque está baixo.

**Architecture:** O saldo é derivado, não armazenado: `saldo = (soma das entradas em StockEntry) − (soma das vendas em Sale)`. Uma entidade nova `StockEntry` registra só entradas/reposições; a venda já é a saída. Lógica de agregação é uma função pura (`calcularEstoque`) testada sem banco, no mesmo estilo de `src/lib/relatorio.ts`. UI em uma nova rota `/estoque` + card de alerta no dashboard.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Prisma + PostgreSQL, NextAuth v4 (JWT), React 19 (`useActionState`), Vitest (Prisma mockado globalmente), Tailwind, `react-datepicker` (via `DateInput`).

## Global Constraints

- **Toda query Prisma DEVE filtrar por `userId: session.user.id`.** Sem exceção.
- **Next.js 16:** proteção de rotas em `src/proxy.ts` (não `middleware.ts`).
- **Testes não usam banco real:** `src/__tests__/setup.ts` mocka `@/lib/prisma` globalmente. Todo novo método Prisma usado precisa existir no mock.
- **Estoque mínimo (`minStock`) é inteiro ≥ 0, default 0.** Quantidade de entrada é inteiro > 0.
- **Status:** `negativo` se `saldo < 0`; senão `baixo` se `minimo > 0 && saldo <= minimo`; senão `ok`. **Mínimo 0 nunca gera "baixo"** (só "negativo").
- **Lançar venda NUNCA é bloqueado por estoque.** Saldo pode ficar negativo.
- **Datas:** `date` em `DateTime @db.Date`; validar formato `YYYY-MM-DD` e `date <= hoje` (`new Date().toISOString().slice(0,10)`), seguindo `lancamento/actions.ts` e `gastos/actions.ts`.
- **Copy em pt-BR.** Mensagens de erro seguem o padrão existente (`'Não autorizado'`, `'Data inválida'`, `'Quantidade inválida'`, `'Campos obrigatórios ausentes'`, `'Produto não encontrado'`).
- **Commits frequentes**, um por task. Mensagens em pt-BR no estilo do repositório, terminando com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `prisma/schema.prisma` (mod) | Entidade `StockEntry`, campo `Product.minStock`, relações inversas. |
| `src/__tests__/setup.ts` (mod) | Mock de `prisma.stockEntry` + `prisma.product.updateMany`. |
| `src/lib/estoque.ts` (novo) | `calcularEstoque` — função pura de agregação de saldo/status. |
| `src/app/(protected)/estoque/actions.ts` (novo) | Server Actions `registrarEntrada`, `removerEntrada`, `definirEstoqueMinimo`. |
| `src/app/(protected)/estoque/EntradaForm.tsx` (novo) | Formulário cliente de registro de entrada. |
| `src/app/(protected)/estoque/page.tsx` (novo) | Página `/estoque`: lista saldo/mínimo/status, form de entrada, entradas recentes, ajuste de mínimo inline. |
| `src/app/api/products/route.ts` (mod) | Aceitar `minStock` no POST. |
| `src/app/(protected)/products/new/page.tsx` (mod) | Campo "estoque mínimo" na criação. |
| `src/components/Sidebar.tsx` (mod) | Link "Estoque". |
| `src/proxy.ts` (mod) | Proteger `/estoque`. |
| `src/app/(protected)/dashboard/page.tsx` (mod) | Card de alerta de estoque baixo. |
| `README.md`, `CLAUDE.md` (mod) | Roadmap e documentação da rota/entidade. |

---

## Task 1: Schema do estoque + mock de testes

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/__tests__/setup.ts`

**Interfaces:**
- Consumes: nada.
- Produces: modelo `StockEntry { id, productId, userId, date: Date, quantity: Int, note: String?, createdAt }`; campo `Product.minStock: Int` (default 0); mock `prisma.stockEntry.{create,deleteMany,findMany}` e `prisma.product.updateMany`.

- [ ] **Step 1: Editar `prisma/schema.prisma`**

Em `model Product`, adicionar o campo `minStock` e a relação inversa `stockEntries`:

```prisma
model Product {
  id           String       @id @default(uuid())
  name         String
  price        Float
  cost         Float
  minStock     Int          @default(0)
  userId       String
  user         User         @relation(fields: [userId], references: [id])
  sales        Sale[]
  stockEntries StockEntry[]
  createdAt    DateTime     @default(now())
}
```

Em `model User`, adicionar a relação inversa:

```prisma
  stockEntries StockEntry[]
```

(coloque a linha junto às outras relações: depois de `expenses  Expense[]`.)

No fim do arquivo, adicionar o novo modelo:

```prisma
model StockEntry {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  date      DateTime @db.Date
  quantity  Int
  note      String?
  createdAt DateTime @default(now())

  @@index([userId, date])
}
```

- [ ] **Step 2: Atualizar o mock do Prisma em `src/__tests__/setup.ts`**

Adicionar `updateMany` ao bloco `product` e um novo bloco `stockEntry`:

```ts
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    stockEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
```

(mantenha os blocos `sale`, `user`, `expense` como estão.)

- [ ] **Step 3: Formatar e validar o schema**

Run: `npx prisma format && npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀" (sem erros).

- [ ] **Step 4: Gerar o client e aplicar a migration**

Run: `npx prisma generate && npx prisma migrate dev --name add_stock_entry_and_min_stock`
Expected: client gerado; nova migration criada e aplicada.
Nota: `migrate dev` exige `DATABASE_URL` acessível. Se não houver banco neste ambiente, rode apenas `npx prisma generate` (regenera os tipos usados pelo build/tests) e deixe a migration registrada para rodar quando o banco estiver disponível — os testes desta sprint não tocam banco real.

- [ ] **Step 5: Rodar a suíte para garantir que nada quebrou**

Run: `npm run test`
Expected: PASS — mesma contagem de antes (o mock novo ainda não é usado).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/__tests__/setup.ts prisma/migrations
git commit -m "feat: add StockEntry model and Product.minStock for estoque" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Lógica pura `calcularEstoque`

**Files:**
- Create: `src/lib/estoque.ts`
- Test: `src/__tests__/lib/estoque.test.ts`

**Interfaces:**
- Consumes: nada (função pura).
- Produces:
  ```ts
  interface EstoqueProductInput { id: string; name: string; minStock: number }
  interface EstoqueEntry { productId: string; quantity: number }
  interface EstoqueSale  { productId: string; quantity: number }
  type EstoqueStatus = 'ok' | 'baixo' | 'negativo'
  interface EstoqueProduto { productId: string; nome: string; entradas: number; vendido: number; saldo: number; minimo: number; status: EstoqueStatus }
  function calcularEstoque(products: EstoqueProductInput[], entries: EstoqueEntry[], sales: EstoqueSale[]): EstoqueProduto[]
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/lib/estoque.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularEstoque } from '@/lib/estoque'

const prod = (id: string, name: string, minStock = 0) => ({ id, name, minStock })

describe('calcularEstoque', () => {
  it('sem produtos → lista vazia', () => {
    expect(calcularEstoque([], [], [])).toEqual([])
  })

  it('produto sem entradas nem vendas, mínimo 0 → saldo 0, status ok', () => {
    const r = calcularEstoque([prod('p1', 'Coxinha')], [], [])
    expect(r).toEqual([
      { productId: 'p1', nome: 'Coxinha', entradas: 0, vendido: 0, saldo: 0, minimo: 0, status: 'ok' },
    ])
  })

  it('soma entradas e vendas do mesmo produto', () => {
    const r = calcularEstoque(
      [prod('p1', 'Coxinha')],
      [{ productId: 'p1', quantity: 30 }, { productId: 'p1', quantity: 20 }],
      [{ productId: 'p1', quantity: 12 }, { productId: 'p1', quantity: 8 }],
    )
    expect(r[0].entradas).toBe(50)
    expect(r[0].vendido).toBe(20)
    expect(r[0].saldo).toBe(30)
    expect(r[0].status).toBe('ok')
  })

  it('só vendas (sem entradas) → saldo negativo, status negativo', () => {
    const r = calcularEstoque([prod('p1', 'Coxinha')], [], [{ productId: 'p1', quantity: 5 }])
    expect(r[0].saldo).toBe(-5)
    expect(r[0].status).toBe('negativo')
  })

  it('saldo negativo é "negativo" mesmo com mínimo 0', () => {
    const r = calcularEstoque([prod('p1', 'Coxinha', 0)], [{ productId: 'p1', quantity: 1 }], [{ productId: 'p1', quantity: 3 }])
    expect(r[0].saldo).toBe(-2)
    expect(r[0].status).toBe('negativo')
  })

  it('saldo 0 com mínimo 0 é "ok", não "baixo"', () => {
    const r = calcularEstoque([prod('p1', 'Coxinha', 0)], [{ productId: 'p1', quantity: 4 }], [{ productId: 'p1', quantity: 4 }])
    expect(r[0].saldo).toBe(0)
    expect(r[0].status).toBe('ok')
  })

  it('saldo == mínimo com mínimo > 0 é "baixo"', () => {
    const r = calcularEstoque([prod('p1', 'Coxinha', 10)], [{ productId: 'p1', quantity: 10 }], [])
    expect(r[0].saldo).toBe(10)
    expect(r[0].status).toBe('baixo')
  })

  it('saldo abaixo do mínimo é "baixo"', () => {
    const r = calcularEstoque([prod('p1', 'Coxinha', 10)], [{ productId: 'p1', quantity: 9 }], [])
    expect(r[0].status).toBe('baixo')
  })

  it('saldo acima do mínimo é "ok"', () => {
    const r = calcularEstoque([prod('p1', 'Coxinha', 10)], [{ productId: 'p1', quantity: 11 }], [])
    expect(r[0].status).toBe('ok')
  })

  it('ordena negativo → baixo → ok e, dentro do grupo, por nome', () => {
    const r = calcularEstoque(
      [prod('a', 'Acaraje', 5), prod('b', 'Bolinho', 0), prod('c', 'Coxinha', 5), prod('d', 'Empada', 0)],
      [
        { productId: 'b', quantity: 100 },                       // Bolinho: ok
        { productId: 'c', quantity: 5 },                         // Coxinha: saldo 5 == min 5 → baixo
      ],
      [
        { productId: 'a', quantity: 2 },                         // Acaraje: saldo -2 → negativo
        { productId: 'd', quantity: 9 },                         // Empada: saldo -9 → negativo
      ],
    )
    expect(r.map(x => x.nome)).toEqual(['Acaraje', 'Empada', 'Coxinha', 'Bolinho'])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/lib/estoque.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/estoque"`.

- [ ] **Step 3: Implementar `src/lib/estoque.ts`**

```ts
export interface EstoqueProductInput {
  id: string
  name: string
  minStock: number
}

export interface EstoqueEntry {
  productId: string
  quantity: number
}

export interface EstoqueSale {
  productId: string
  quantity: number
}

export type EstoqueStatus = 'ok' | 'baixo' | 'negativo'

export interface EstoqueProduto {
  productId: string
  nome: string
  entradas: number
  vendido: number
  saldo: number
  minimo: number
  status: EstoqueStatus
}

function statusDe(saldo: number, minimo: number): EstoqueStatus {
  if (saldo < 0) return 'negativo'
  if (minimo > 0 && saldo <= minimo) return 'baixo'
  return 'ok'
}

const ORDEM_STATUS: Record<EstoqueStatus, number> = { negativo: 0, baixo: 1, ok: 2 }

function somarPorProduto(itens: { productId: string; quantity: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const i of itens) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity)
  return m
}

export function calcularEstoque(
  products: EstoqueProductInput[],
  entries: EstoqueEntry[],
  sales: EstoqueSale[],
): EstoqueProduto[] {
  const entradasPorProduto = somarPorProduto(entries)
  const vendidoPorProduto = somarPorProduto(sales)

  const resultado = products.map((p): EstoqueProduto => {
    const entradas = entradasPorProduto.get(p.id) ?? 0
    const vendido = vendidoPorProduto.get(p.id) ?? 0
    const saldo = entradas - vendido
    return {
      productId: p.id,
      nome: p.name,
      entradas,
      vendido,
      saldo,
      minimo: p.minStock,
      status: statusDe(saldo, p.minStock),
    }
  })

  resultado.sort((a, b) => {
    const ds = ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]
    return ds !== 0 ? ds : a.nome.localeCompare(b.nome, 'pt-BR')
  })

  return resultado
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/lib/estoque.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/estoque.ts src/__tests__/lib/estoque.test.ts
git commit -m "feat: add calcularEstoque pure aggregation with tests" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Server Actions de estoque

**Files:**
- Create: `src/app/(protected)/estoque/actions.ts`
- Test: `src/__tests__/actions/estoque.test.ts`

**Interfaces:**
- Consumes: `prisma.product.findFirst`, `prisma.product.updateMany`, `prisma.stockEntry.create`, `prisma.stockEntry.deleteMany` (mockados na Task 1).
- Produces:
  ```ts
  type EstoqueActionState = { error: string } | null
  function registrarEntrada(prevState: EstoqueActionState, formData: FormData): Promise<EstoqueActionState>
  function removerEntrada(id: string): Promise<void>
  function definirEstoqueMinimo(productId: string, formData: FormData): Promise<void>
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/actions/estoque.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

async function actions() {
  return import('@/app/(protected)/estoque/actions')
}

beforeEach(() => vi.clearAllMocks())

describe('registrarEntrada', () => {
  it('erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { registrarEntrada } = await actions()
    await expect(registrarEntrada(null, new FormData())).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('erro se campo obrigatório ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntrada } = await actions()
    const fd = new FormData()
    fd.set('date', '2026-06-28')
    fd.set('quantity', '10')
    // productId ausente
    await expect(registrarEntrada(null, fd)).resolves.toEqual({ error: 'Campos obrigatórios ausentes' })
  })

  it('erro se data é futura', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntrada } = await actions()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('date', tomorrow.toISOString().slice(0, 10))
    fd.set('quantity', '10')
    await expect(registrarEntrada(null, fd)).resolves.toEqual({ error: 'Data inválida' })
  })

  it('erro se quantity não é inteiro positivo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntrada } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('date', '2026-06-28')
    fd.set('quantity', '2.5')
    await expect(registrarEntrada(null, fd)).resolves.toEqual({ error: 'Quantidade inválida' })
  })

  it('erro se produto não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
    const { registrarEntrada } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('date', '2026-06-28')
    fd.set('quantity', '10')
    await expect(registrarEntrada(null, fd)).resolves.toEqual({ error: 'Produto não encontrado' })
  })

  it('persiste a entrada e retorna null', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'p1', userId: 'user-1' } as any)
    vi.mocked(prisma.stockEntry.create).mockResolvedValue({} as any)
    const { registrarEntrada } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('date', '2026-06-28')
    fd.set('quantity', '10')
    fd.set('note', 'Reposição')
    const result = await registrarEntrada(null, fd)
    expect(result).toBeNull()
    expect(prisma.stockEntry.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', productId: 'p1', date: new Date('2026-06-28'), quantity: 10, note: 'Reposição' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/estoque')
  })
})

describe('removerEntrada', () => {
  it('lança se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerEntrada } = await actions()
    await expect(removerEntrada('e1')).rejects.toThrow('Não autorizado')
  })

  it('lança se entrada não encontrada para o usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.stockEntry.deleteMany).mockResolvedValue({ count: 0 } as any)
    const { removerEntrada } = await actions()
    await expect(removerEntrada('e1')).rejects.toThrow('Entrada não encontrada')
  })

  it('remove a entrada escopada ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.stockEntry.deleteMany).mockResolvedValue({ count: 1 } as any)
    const { removerEntrada } = await actions()
    await removerEntrada('e1')
    expect(prisma.stockEntry.deleteMany).toHaveBeenCalledWith({ where: { id: 'e1', userId: 'user-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/estoque')
  })
})

describe('definirEstoqueMinimo', () => {
  it('lança se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { definirEstoqueMinimo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '5')
    await expect(definirEstoqueMinimo('p1', fd)).rejects.toThrow('Não autorizado')
  })

  it('lança se mínimo é negativo ou não inteiro', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { definirEstoqueMinimo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '-1')
    await expect(definirEstoqueMinimo('p1', fd)).rejects.toThrow('Estoque mínimo inválido')
  })

  it('atualiza o mínimo escopado ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as any)
    const { definirEstoqueMinimo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '8')
    await definirEstoqueMinimo('p1', fd)
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', userId: 'user-1' },
      data: { minStock: 8 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/estoque')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/actions/estoque.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/(protected)/estoque/actions"`.

- [ ] **Step 3: Implementar `src/app/(protected)/estoque/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type EstoqueActionState = { error: string } | null

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export async function registrarEntrada(
  _prevState: EstoqueActionState,
  formData: FormData
): Promise<EstoqueActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const productId = formData.get('productId') as string
  const dateStr = formData.get('date') as string
  const quantityRaw = formData.get('quantity') as string
  const noteRaw = formData.get('note') as string | null
  const note = noteRaw && noteRaw.trim() !== '' ? noteRaw.trim() : null

  if (!productId || !dateStr || !quantityRaw) {
    return { error: 'Campos obrigatórios ausentes' }
  }

  if (!ISO_RE.test(dateStr)) return { error: 'Data inválida' }
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) return { error: 'Data inválida' }

  const quantity = Number(quantityRaw)
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Quantidade inválida' }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
  })
  if (!product) return { error: 'Produto não encontrado' }

  await prisma.stockEntry.create({
    data: {
      userId: session.user.id,
      productId,
      date: new Date(dateStr),
      quantity,
      note,
    },
  })

  revalidatePath('/estoque')
  revalidatePath('/dashboard')
  return null
}

export async function removerEntrada(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const result = await prisma.stockEntry.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (result.count === 0) throw new Error('Entrada não encontrada ou não autorizada')

  revalidatePath('/estoque')
  revalidatePath('/dashboard')
}

export async function definirEstoqueMinimo(productId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const minStock = Number(formData.get('minStock'))
  if (!Number.isInteger(minStock) || minStock < 0) throw new Error('Estoque mínimo inválido')

  const result = await prisma.product.updateMany({
    where: { id: productId, userId: session.user.id },
    data: { minStock },
  })
  if (result.count === 0) throw new Error('Produto não encontrado ou não autorizado')

  revalidatePath('/estoque')
  revalidatePath('/dashboard')
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/actions/estoque.test.ts`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/estoque/actions.ts" src/__tests__/actions/estoque.test.ts
git commit -m "feat: add estoque server actions (entrada, remover, mínimo)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Campo `minStock` na criação de produto

**Files:**
- Modify: `src/app/api/products/route.ts`
- Modify: `src/app/(protected)/products/new/page.tsx`
- Test: `src/__tests__/api/products.test.ts`

**Interfaces:**
- Consumes: `prisma.product.create` (já mockado).
- Produces: `POST /api/products` aceita `minStock` opcional (inteiro ≥ 0, default 0) e o inclui em `prisma.product.create`.

- [ ] **Step 1: Atualizar o teste existente e adicionar casos novos**

Em `src/__tests__/api/products.test.ts`, **substituir** o teste `'cria produto e retorna 201'` (o `create` agora inclui `minStock: 0`) e **adicionar** dois casos. Substitua o bloco do teste existente por:

```ts
  it('cria produto e retorna 201 (minStock default 0)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockProduct = { id: 'p1', name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 0, userId: 'user-1' }
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
      data: { name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 0, userId: 'user-1' },
    })
  })

  it('aceita minStock inteiro e o persiste', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.create).mockResolvedValue({} as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 10 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: { name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 10, userId: 'user-1' },
    })
  })

  it('retorna 400 se minStock for negativo ou não inteiro', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: -3 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/api/products.test.ts`
Expected: FAIL — `create` chamado sem `minStock`; e o caso negativo retorna 201 em vez de 400.

- [ ] **Step 3: Atualizar `src/app/api/products/route.ts`**

No `POST`, trocar a desestruturação e a criação. Substituir:

```ts
  const body = await request.json()
  const { name, price, cost } = body
```

por:

```ts
  const body = await request.json()
  const { name, price, cost, minStock } = body
```

E, logo após a validação de `cost` (depois do bloco `if (cost === undefined || cost < 0) { ... }`), adicionar:

```ts
  const min = minStock === undefined ? 0 : minStock
  if (!Number.isInteger(min) || min < 0) {
    return NextResponse.json({ error: 'Estoque mínimo inválido' }, { status: 400 })
  }
```

E trocar o `create`:

```ts
  const product = await prisma.product.create({
    data: { name: name.trim(), price, cost, minStock: min, userId: session.user.id },
  })
```

- [ ] **Step 4: Adicionar o campo no formulário `src/app/(protected)/products/new/page.tsx`**

Adicionar o estado, junto aos outros `useState`:

```tsx
  const [minStock, setMinStock] = useState('0')
```

No corpo da requisição `fetch`, incluir `minStock`:

```tsx
      body: JSON.stringify({
        name,
        price: parseFloat(price),
        cost: parseFloat(cost),
        minStock: parseInt(minStock || '0', 10),
      }),
```

E adicionar o campo no formulário, logo depois do bloco do campo "Custo (R$)":

```tsx
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-100">Estoque mínimo</label>
          <input
            type="number"
            value={minStock}
            onChange={e => setMinStock(e.target.value)}
            placeholder="0"
            step="1"
            min="0"
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">0 = sem alerta de estoque baixo</p>
        </div>
```

- [ ] **Step 5: Rodar testes + lint e confirmar verde**

Run: `npx vitest run src/__tests__/api/products.test.ts && npm run lint`
Expected: PASS nos testes; lint sem erros nos arquivos alterados.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/products/route.ts "src/app/(protected)/products/new/page.tsx" src/__tests__/api/products.test.ts
git commit -m "feat: accept minStock when creating a product" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Página `/estoque`

**Files:**
- Create: `src/app/(protected)/estoque/EntradaForm.tsx`
- Create: `src/app/(protected)/estoque/page.tsx`

**Interfaces:**
- Consumes: `calcularEstoque` (Task 2); `registrarEntrada`, `removerEntrada`, `definirEstoqueMinimo` (Task 3); `prisma.product.findMany`, `prisma.stockEntry.findMany`, `prisma.sale.findMany`; componente `DateInput`.
- Produces: rota `/estoque` renderizada (sem export consumido por outras tasks).

Nota: páginas/forms não têm teste unitário neste projeto (igual `/relatorios`). A verificação é `npm run build` + `npm run lint`.

- [ ] **Step 1: Criar o formulário `src/app/(protected)/estoque/EntradaForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { registrarEntrada } from './actions'
import { DateInput } from '@/components/DateInput'

interface Props {
  today: string
  products: { id: string; name: string }[]
}

export function EntradaForm({ today, products }: Props) {
  const [state, formAction] = useActionState(registrarEntrada, null)

  return (
    <form
      action={formAction}
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col gap-3"
    >
      <p className="font-semibold dark:text-slate-100 text-sm">Registrar entrada</p>

      {state?.error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Produto</label>
          <select
            name="productId"
            required
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Selecionar...</option>
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Data</label>
          <DateInput
            name="date"
            defaultValue={today}
            max={today}
            required
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Qtd</label>
          <input
            type="number"
            name="quantity"
            step="1"
            min="1"
            placeholder="0"
            required
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Observação</label>
          <input
            type="text"
            name="note"
            placeholder="opcional"
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <button
        type="submit"
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm mt-1"
      >
        Registrar entrada
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Criar a página `src/app/(protected)/estoque/page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularEstoque, type EstoqueStatus } from '@/lib/estoque'
import { removerEntrada, definirEstoqueMinimo } from './actions'
import { EntradaForm } from './EntradaForm'

const STATUS_BADGE: Record<EstoqueStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  baixo: { label: 'Baixo', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  negativo: { label: 'Negativo', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default async function EstoquePage() {
  const session = await getServerSession(authOptions)
  const userId = session!.user.id
  const today = new Date().toISOString().slice(0, 10)

  const [products, entries, sales] = await Promise.all([
    prisma.product.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.stockEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.sale.findMany({ where: { userId } }),
  ])

  const estoque = calcularEstoque(
    products.map(p => ({ id: p.id, name: p.name, minStock: p.minStock })),
    entries.map(e => ({ productId: e.productId, quantity: e.quantity })),
    sales.map(s => ({ productId: s.productId, quantity: s.quantity })),
  )

  const nomePorProduto = new Map(products.map(p => [p.id, p.name]))
  const recentes = entries.slice(0, 15)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <h1 className="text-xl font-bold dark:text-slate-100 mb-4">Estoque</h1>

      <EntradaForm today={today} products={products.map(p => ({ id: p.id, name: p.name }))} />

      {/* Saldo por produto */}
      {estoque.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 py-8">
          Nenhum produto cadastrado.
        </p>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="flex justify-between items-center px-4 py-3 border-b dark:border-slate-700">
            <span className="font-semibold dark:text-slate-100">Saldo por produto</span>
          </div>
          {estoque.map(item => {
            const badge = STATUS_BADGE[item.status]
            return (
              <div key={item.productId} className="flex flex-wrap justify-between items-center gap-3 px-4 py-3 border-b last:border-0 dark:border-slate-700">
                <div className="min-w-[8rem]">
                  <p className="text-sm font-medium dark:text-slate-100">{item.nome}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {item.entradas} entradas · {item.vendido} vendidos
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${item.saldo < 0 ? 'text-red-500' : 'dark:text-slate-100'}`}>
                    {item.saldo}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.className}`}>
                    {badge.label}
                  </span>
                  <form action={definirEstoqueMinimo.bind(null, item.productId)} className="flex items-center gap-1">
                    <label className="text-xs text-gray-400 dark:text-slate-500">mín.</label>
                    <input
                      type="number"
                      name="minStock"
                      min="0"
                      step="1"
                      defaultValue={item.minimo}
                      className="w-14 border dark:border-slate-600 rounded-lg px-2 py-1 text-sm dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button type="submit" className="text-xs text-orange-500 hover:text-orange-600">
                      Salvar
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Entradas recentes */}
      {recentes.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-slate-700">
            <span className="font-semibold dark:text-slate-100">Entradas recentes</span>
          </div>
          {recentes.map(e => (
            <div key={e.id} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
              <p className="text-sm dark:text-slate-200">
                {e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ·{' '}
                {nomePorProduto.get(e.productId) ?? '—'} · +{e.quantity}
                {e.note ? ` · ${e.note}` : ''}
              </p>
              <form action={removerEntrada.bind(null, e.id)}>
                <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Remover
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar build e lint**

Run: `npm run build && npm run lint`
Expected: build conclui; lint sem erros. (Se `next build` exigir banco e ele não existir neste ambiente, rode ao menos `npx tsc --noEmit` + `npm run lint` para garantir tipos/lint.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/estoque/page.tsx" "src/app/(protected)/estoque/EntradaForm.tsx"
git commit -m "feat: add /estoque page with saldo, entrada form and inline mínimo" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Navegação e proteção da rota

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: rota `/estoque` (Task 5).
- Produces: link "Estoque" na sidebar; `/estoque` protegido por auth.

- [ ] **Step 1: Adicionar o link na sidebar**

Em `src/components/Sidebar.tsx`, dentro de `<nav>`, adicionar o link **logo após** o de Produtos (mantendo a ordem Dashboard → Produtos → Estoque → Gastos → Relatórios):

```tsx
        <Link href="/estoque" className={navClass('/estoque')}>
          Estoque
        </Link>
```

- [ ] **Step 2: Proteger a rota em `src/proxy.ts`**

Substituir o `matcher` para incluir `/estoque`:

```ts
export const config = {
  matcher: ['/dashboard/:path*', '/products/:path*', '/lancamento/:path*', '/gastos/:path*', '/relatorios/:path*', '/estoque/:path*'],
}
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/proxy.ts
git commit -m "feat: add Estoque link to sidebar and protect /estoque route" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Alerta de estoque baixo no dashboard

**Files:**
- Modify: `src/app/(protected)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `calcularEstoque` (Task 2); `prisma.product.findMany`, `prisma.stockEntry.findMany`, `prisma.sale.findMany`.
- Produces: card de alerta no dashboard listando produtos com status `baixo`/`negativo`.

- [ ] **Step 1: Importar `calcularEstoque` no topo de `dashboard/page.tsx`**

Adicionar, junto aos imports existentes:

```tsx
import { calcularEstoque } from '@/lib/estoque'
```

- [ ] **Step 2: Buscar dados e calcular os produtos em alerta**

Em `DashboardPage`, **depois** do bloco que monta `porDia` (logo antes do `return`), adicionar:

```tsx
  const [produtosEstoque, entradasEstoque, todasVendas] = await Promise.all([
    prisma.product.findMany({ where: { userId: session!.user.id } }),
    prisma.stockEntry.findMany({ where: { userId: session!.user.id } }),
    prisma.sale.findMany({ where: { userId: session!.user.id } }),
  ])

  const alertasEstoque = calcularEstoque(
    produtosEstoque.map(p => ({ id: p.id, name: p.name, minStock: p.minStock })),
    entradasEstoque.map(e => ({ productId: e.productId, quantity: e.quantity })),
    todasVendas.map(s => ({ productId: s.productId, quantity: s.quantity })),
  ).filter(item => item.status !== 'ok')
```

- [ ] **Step 3: Renderizar o card de alerta**

No JSX, inserir este bloco **logo após** o `<Link href="/lancamento" ...>...</Link>` (o botão "Lançar vendas de hoje") e **antes** do bloco `{porDia.size > 0 && (...)}`:

```tsx
      {alertasEstoque.length > 0 && (
        <Link
          href="/estoque"
          className="block bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-500/40 rounded-2xl p-4 mb-6 shadow-sm"
        >
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
            ⚠️ Estoque baixo ({alertasEstoque.length})
          </p>
          <div className="flex flex-col gap-1">
            {alertasEstoque.map(item => (
              <div key={item.productId} className="flex justify-between text-sm">
                <span className="dark:text-slate-200">{item.nome}</span>
                <span className={item.saldo < 0 ? 'text-red-500 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                  {item.saldo} un.
                </span>
              </div>
            ))}
          </div>
        </Link>
      )}
```

- [ ] **Step 4: Verificar build e lint**

Run: `npm run build && npm run lint`
Expected: build conclui; lint sem erros. (Fallback sem banco: `npx tsc --noEmit && npm run lint`.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/dashboard/page.tsx"
git commit -m "feat: show low-stock alert card on dashboard" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Documentação (README + CLAUDE.md)

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: roadmap e docs atualizados.

- [ ] **Step 1: Adicionar a linha do Sprint 4 no roadmap do `README.md`**

Na tabela "## Roadmap", adicionar **abaixo** da linha do Sprint 3:

```markdown
| Sprint 4 | ✅ Concluído | Controle de estoque de produtos vendáveis em `/estoque`: saldo = entradas − vendas, registro de entradas/reposições, estoque mínimo por produto e alerta de estoque baixo no dashboard |
```

- [ ] **Step 2: Atualizar `CLAUDE.md`**

(a) Na descrição de proteção de rotas (proxy), incluir `/estoque` na lista de rotas protegidas.

(b) No bloco "**Data model**", adicionar a entidade `StockEntry` e o campo `minStock`:

```markdown
- `Product` (name, price, cost, minStock) → `Sale[]` + `StockEntry[]`
- `StockEntry` — entradas de estoque (reposições/saldo inicial) por produto: `date`, `quantity` (Int), `note?`. O saldo de estoque é derivado: `entradas − vendas (Sale)`.
```

(c) Em "**Route groups:**", adicionar:

```markdown
- `/estoque` — controle de estoque dos produtos vendáveis: saldo (entradas − vendas), status (ok/baixo/negativo), registro de entradas e ajuste do estoque mínimo inline. Server Actions: `registrarEntrada`, `removerEntrada`, `definirEstoqueMinimo`; agregação pura em [src/lib/estoque.ts](src/lib/estoque.ts). **Lançar venda não é bloqueado por falta de estoque** (saldo pode ficar negativo, apenas alerta). Mínimo 0 não gera alerta de "baixo".
```

- [ ] **Step 3: Rodar a suíte completa**

Run: `npm run test`
Expected: PASS — todos os testes (anteriores + estoque: lib 10, actions 12, products API atualizado).

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document Sprint 4 estoque feature and roadmap" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] `npm run test` → todos verdes (inclui `estoque.test.ts` com 10 e `estoque` actions com 12).
- [ ] `npm run lint` → sem erros.
- [ ] `npm run build` → build limpo (requer `npx prisma generate`; `migrate dev` requer banco).
- [ ] Conferir manualmente em `/estoque`: registrar entrada, ver saldo mudar, ajustar mínimo, remover entrada; e o card de alerta aparecer no dashboard quando há produto abaixo do mínimo ou negativo.

## Out of Scope (Sprint 5+)

- Estoque de insumos/ingredientes (Sprint 5).
- Receita/ficha técnica ligando insumo → produto.
- Valoração de estoque (saldo × custo) como KPI.
- Relatório/histórico de movimentação de estoque.
- Exportação (PDF/CSV).
- Bloquear lançamento de vendas por falta de estoque.
