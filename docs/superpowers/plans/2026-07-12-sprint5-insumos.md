# Sprint 5 — Insumos, Estoque de Insumos e Ficha Técnica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar insumos, controlar seu estoque por entradas de compra (só quantidade física) e montar a ficha técnica (receita) de cada produto, derivando o consumo de insumo das vendas e o custo real por produto.

**Architecture:** Três entidades novas escopadas a `userId` — `Insumo`, `InsumoEntry` (entradas físicas, `Float`) e `RecipeItem` (item da receita, `@@unique([productId, insumoId])`). O saldo do insumo é **derivado em leitura**: `saldo = Σ entradas − Σ (venda.quantity × quantidade do insumo na receita do produto)`. A agregação é feita por funções puras testáveis em `src/lib/insumos.ts` (`calcularEstoqueInsumos`, `calcularCustoReal`), no estilo de `src/lib/estoque.ts`. A regra de status (baixo/negativo) é extraída para um helper compartilhado `src/lib/stockStatus.ts`, reusado por estoque e insumos. UI: nova rota `/insumos` (+ `/insumos/new`), ficha técnica na nova rota de detalhe do produto `/products/[id]`, e card "Insumos em falta" no dashboard.

**Tech Stack:** Next.js 16 (App Router, Server Actions, async `params`), Prisma + PostgreSQL, NextAuth v4 (JWT), React 19 (`useActionState`), Vitest (Prisma mockado globalmente), Tailwind, `react-datepicker` (via `DateInput`).

## Global Constraints

- **Toda query Prisma DEVE filtrar por `userId: session.user.id`.** Sem exceção.
- **Insumo é só quantidade física.** A entrada de insumo **não** carrega valor/dinheiro. O dinheiro continua em Gastos (`Expense`); o relatório de lucro real (Sprint 3) **não** muda.
- **`Insumo.cost`** é o custo unitário (informativo), usado **só** para calcular custo real por produto. **Não** sobrescreve `Product.cost` nem entra no relatório.
- **Quantidades de insumo são `Float`** (0,15 kg; 1,5 L). Validação: `Number(x)`, rejeita `isNaN` ou `<= 0` (entradas/receita) e `< 0` (custo/mínimo). **Não** usar `Number.isInteger` para insumo.
- **Unidade de medida** vem de uma lista fixa: `['un', 'g', 'kg', 'ml', 'L']`. Sem conversão de unidade — a quantidade da receita é sempre na unidade do insumo.
- **Status** (mesma regra da Sprint 4): `negativo` se `saldo < 0`; senão `baixo` se `minimo > 0 && saldo <= minimo`; senão `ok`. **Mínimo 0 nunca gera "baixo"** (só "negativo").
- **Next.js 16:** proteção de rotas em `src/proxy.ts` (não `middleware.ts`); `params` de páginas dinâmicas é `Promise` e precisa de `await`.
- **Testes não usam banco real:** `src/__tests__/setup.ts` mocka `@/lib/prisma` globalmente. Todo novo método Prisma usado precisa existir no mock.
- **Datas:** `date` em `DateTime @db.Date`; validar formato `YYYY-MM-DD` e `date <= hoje` (`new Date().toISOString().slice(0,10)`), como em `estoque/actions.ts`.
- **Copy em pt-BR.** Mensagens de erro seguem o padrão existente (`'Não autorizado'`, `'Campos obrigatórios ausentes'`, `'Data inválida'`, `'Quantidade inválida'`, `'Insumo não encontrado'`, `'Produto não encontrado'`).
- **Commits frequentes**, um por task. Mensagens em pt-BR no estilo do repositório, terminando com:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## File Structure

| Arquivo | Responsabilidade |
|---------|------------------|
| `prisma/schema.prisma` (mod) | Entidades `Insumo`, `InsumoEntry`, `RecipeItem` + relações inversas em `User` e `Product`. |
| `src/__tests__/setup.ts` (mod) | Mock de `prisma.insumo`, `prisma.insumoEntry`, `prisma.recipeItem`. |
| `src/lib/stockStatus.ts` (novo) | `EstoqueStatus`, `statusEstoque(saldo, minimo)`, `ORDEM_STATUS` — helper compartilhado. |
| `src/lib/estoque.ts` (mod) | Importar status do helper (remove duplicação); re-exporta `EstoqueStatus`. |
| `src/lib/insumos.ts` (novo) | `calcularEstoqueInsumos` (saldo/consumo derivado) + `calcularCustoReal`. |
| `src/app/(protected)/insumos/actions.ts` (novo) | `criarInsumo`, `registrarEntradaInsumo`, `removerEntradaInsumo`, `definirMinimoInsumo`, `definirCustoInsumo`. |
| `src/app/(protected)/insumos/EntradaInsumoForm.tsx` (novo) | Formulário de entrada de compra. |
| `src/app/(protected)/insumos/MinimoInsumoForm.tsx` (novo) | Ajuste inline do mínimo. |
| `src/app/(protected)/insumos/CustoInsumoForm.tsx` (novo) | Ajuste inline do custo. |
| `src/app/(protected)/insumos/page.tsx` (novo) | Página `/insumos`: saldo/status, entrada, entradas recentes, ajustes inline. |
| `src/app/(protected)/insumos/new/NovoInsumoForm.tsx` (novo) | Formulário de cadastro de insumo. |
| `src/app/(protected)/insumos/new/page.tsx` (novo) | Página `/insumos/new`. |
| `src/app/(protected)/products/[id]/actions.ts` (novo) | `adicionarItemReceita`, `removerItemReceita`. |
| `src/app/(protected)/products/[id]/ReceitaForm.tsx` (novo) | Formulário de adição de item à ficha técnica. |
| `src/app/(protected)/products/[id]/page.tsx` (novo) | Detalhe do produto: ficha técnica + custo real. |
| `src/app/(protected)/products/page.tsx` (mod) | Cada produto vira link para o detalhe. |
| `src/components/Sidebar.tsx` (mod) | Link "Insumos". |
| `src/proxy.ts` (mod) | Proteger `/insumos`. |
| `src/app/(protected)/dashboard/page.tsx` (mod) | Card "Insumos em falta". |
| `README.md`, `CLAUDE.md` (mod) | Roadmap e documentação. |

---

## Task 1: Schema de insumos + mock de testes

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/__tests__/setup.ts`

**Interfaces:**
- Consumes: nada.
- Produces: modelos `Insumo { id, name, unit, cost: Float, minStock: Float, userId, createdAt }`, `InsumoEntry { id, insumoId, userId, date: Date, quantity: Float, note?, createdAt }`, `RecipeItem { id, productId, insumoId, userId, quantity: Float, createdAt, @@unique([productId, insumoId]) }`; mocks `prisma.insumo.{create,findMany,findFirst,updateMany,deleteMany}`, `prisma.insumoEntry.{create,findMany,deleteMany}`, `prisma.recipeItem.{create,findMany,findFirst,deleteMany}`.

- [ ] **Step 1: Editar `prisma/schema.prisma`**

Em `model User`, adicionar as três relações inversas junto às existentes (depois de `stockEntries StockEntry[]`):

```prisma
  insumos       Insumo[]
  insumoEntries InsumoEntry[]
  recipeItems   RecipeItem[]
```

Em `model Product`, adicionar a relação inversa junto às existentes (depois de `stockEntries StockEntry[]`):

```prisma
  recipeItems  RecipeItem[]
```

No fim do arquivo, adicionar os três modelos novos:

```prisma
model Insumo {
  id          String        @id @default(uuid())
  name        String
  unit        String
  cost        Float
  minStock    Float         @default(0)
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  entries     InsumoEntry[]
  recipeItems RecipeItem[]
  createdAt   DateTime      @default(now())
}

model InsumoEntry {
  id        String   @id @default(uuid())
  insumoId  String
  insumo    Insumo   @relation(fields: [insumoId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  date      DateTime @db.Date
  quantity  Float
  note      String?
  createdAt DateTime @default(now())

  @@index([userId, date])
}

model RecipeItem {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id])
  insumoId  String
  insumo    Insumo   @relation(fields: [insumoId], references: [id])
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  quantity  Float
  createdAt DateTime @default(now())

  @@unique([productId, insumoId])
}
```

- [ ] **Step 2: Atualizar o mock do Prisma em `src/__tests__/setup.ts`**

Adicionar os três blocos novos dentro do objeto `prisma` (depois do bloco `stockEntry`):

```ts
    insumo: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    insumoEntry: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    recipeItem: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
```

(mantenha os blocos `product`, `sale`, `user`, `expense`, `stockEntry` como estão.)

- [ ] **Step 3: Formatar e validar o schema**

Run: `npx prisma format && npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀" (sem erros).

- [ ] **Step 4: Gerar o client e aplicar a migration**

Run: `npx prisma generate && npx prisma migrate dev --name add_insumo_entry_recipe`
Expected: client gerado; nova migration criada e aplicada.
Nota: `migrate dev` exige `DATABASE_URL` acessível. Se não houver banco neste ambiente, rode apenas `npx prisma generate` (regenera os tipos usados pelo build/tests) e deixe a migration para rodar quando o banco estiver disponível — os testes desta sprint não tocam banco real.

- [ ] **Step 5: Rodar a suíte para garantir que nada quebrou**

Run: `npm run test`
Expected: PASS — mesma contagem de antes (o mock novo ainda não é usado).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/__tests__/setup.ts prisma/migrations
git commit -m "feat: add Insumo, InsumoEntry and RecipeItem models" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Helper de status compartilhado + refactor de `estoque.ts`

**Files:**
- Create: `src/lib/stockStatus.ts`
- Test: `src/__tests__/lib/stockStatus.test.ts`
- Modify: `src/lib/estoque.ts`

**Interfaces:**
- Consumes: nada (função pura).
- Produces:
  ```ts
  type EstoqueStatus = 'ok' | 'baixo' | 'negativo'
  function statusEstoque(saldo: number, minimo: number): EstoqueStatus
  const ORDEM_STATUS: Record<EstoqueStatus, number>
  ```
  `src/lib/estoque.ts` passa a importar esses símbolos e re-exporta `EstoqueStatus` (para não quebrar `estoque/page.tsx` e `dashboard/page.tsx`, que importam o tipo de `@/lib/estoque`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/lib/stockStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statusEstoque } from '@/lib/stockStatus'

describe('statusEstoque', () => {
  it('saldo negativo é "negativo", mesmo com mínimo 0', () => {
    expect(statusEstoque(-1, 0)).toBe('negativo')
    expect(statusEstoque(-0.5, 3)).toBe('negativo')
  })

  it('saldo 0 com mínimo 0 é "ok"', () => {
    expect(statusEstoque(0, 0)).toBe('ok')
  })

  it('saldo <= mínimo com mínimo > 0 é "baixo"', () => {
    expect(statusEstoque(3, 3)).toBe('baixo')
    expect(statusEstoque(2, 3)).toBe('baixo')
    expect(statusEstoque(0, 1)).toBe('baixo')
  })

  it('saldo > mínimo é "ok"', () => {
    expect(statusEstoque(4, 3)).toBe('ok')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/lib/stockStatus.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/stockStatus"`.

- [ ] **Step 3: Criar `src/lib/stockStatus.ts`**

```ts
export type EstoqueStatus = 'ok' | 'baixo' | 'negativo'

export function statusEstoque(saldo: number, minimo: number): EstoqueStatus {
  if (saldo < 0) return 'negativo'
  if (minimo > 0 && saldo <= minimo) return 'baixo'
  return 'ok'
}

export const ORDEM_STATUS: Record<EstoqueStatus, number> = { negativo: 0, baixo: 1, ok: 2 }
```

- [ ] **Step 4: Refatorar `src/lib/estoque.ts` para usar o helper**

No topo do arquivo, adicionar o import e **remover** as declarações locais de `EstoqueStatus`, `statusDe` e `ORDEM_STATUS`.

Adicionar como primeira linha:

```ts
import { statusEstoque, ORDEM_STATUS, type EstoqueStatus } from './stockStatus'

export type { EstoqueStatus }
```

Remover estas três definições que hoje existem no arquivo:

```ts
export type EstoqueStatus = 'ok' | 'baixo' | 'negativo'

function statusDe(saldo: number, minimo: number): EstoqueStatus {
  if (saldo < 0) return 'negativo'
  if (minimo > 0 && saldo <= minimo) return 'baixo'
  return 'ok'
}

const ORDEM_STATUS: Record<EstoqueStatus, number> = { negativo: 0, baixo: 1, ok: 2 }
```

E na função `calcularEstoque`, trocar a chamada `status: statusDe(saldo, p.minStock),` por:

```ts
      status: statusEstoque(saldo, p.minStock),
```

(o resto de `calcularEstoque` fica igual; `ORDEM_STATUS` continua sendo usado no `sort`, agora vindo do import.)

- [ ] **Step 5: Rodar os testes de status e estoque e confirmar verde**

Run: `npx vitest run src/__tests__/lib/stockStatus.test.ts src/__tests__/lib/estoque.test.ts`
Expected: PASS — stockStatus (4 testes) e estoque (10 testes) verdes, provando que o refactor preservou o comportamento.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stockStatus.ts src/__tests__/lib/stockStatus.test.ts src/lib/estoque.ts
git commit -m "refactor: extract shared statusEstoque helper for estoque and insumos" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Lógica pura `calcularEstoqueInsumos`

**Files:**
- Create: `src/lib/insumos.ts`
- Test: `src/__tests__/lib/insumos.test.ts`

**Interfaces:**
- Consumes: `statusEstoque`, `ORDEM_STATUS`, `EstoqueStatus` de `./stockStatus` (Task 2).
- Produces:
  ```ts
  interface InsumoInput { id: string; name: string; unit: string; cost: number; minStock: number }
  interface InsumoEntradaInput { insumoId: string; quantity: number }
  interface ReceitaItemInput { productId: string; insumoId: string; quantity: number }
  interface VendaInput { productId: string; quantity: number }
  interface InsumoSaldo { insumoId: string; nome: string; unidade: string; entradas: number; consumido: number; saldo: number; minimo: number; status: EstoqueStatus }
  function calcularEstoqueInsumos(insumos: InsumoInput[], entradas: InsumoEntradaInput[], receitas: ReceitaItemInput[], vendas: VendaInput[]): InsumoSaldo[]
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/lib/insumos.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularEstoqueInsumos } from '@/lib/insumos'

const ins = (id: string, name: string, minStock = 0) => ({ id, name, unit: 'kg', cost: 0, minStock })

describe('calcularEstoqueInsumos', () => {
  it('sem insumos → lista vazia', () => {
    expect(calcularEstoqueInsumos([], [], [], [])).toEqual([])
  })

  it('insumo só com entradas (sem vendas) → saldo = entradas, consumo 0', () => {
    const r = calcularEstoqueInsumos(
      [ins('i1', 'Carne')],
      [{ insumoId: 'i1', quantity: 10 }, { insumoId: 'i1', quantity: 5 }],
      [],
      [],
    )
    expect(r[0].entradas).toBe(15)
    expect(r[0].consumido).toBe(0)
    expect(r[0].saldo).toBe(15)
    expect(r[0].status).toBe('ok')
  })

  it('consumo derivado de 1 produto/1 insumo', () => {
    // Receita: X-Burger consome 0,2 kg de Carne. Vendeu 10 → consumo 2 kg.
    const r = calcularEstoqueInsumos(
      [ins('i1', 'Carne')],
      [{ insumoId: 'i1', quantity: 5 }],
      [{ productId: 'p1', insumoId: 'i1', quantity: 0.2 }],
      [{ productId: 'p1', quantity: 10 }],
    )
    expect(r[0].consumido).toBeCloseTo(2, 5)
    expect(r[0].saldo).toBeCloseTo(3, 5)
    expect(r[0].status).toBe('ok')
  })

  it('insumo usado em vários produtos soma o consumo dos dois', () => {
    // Carne em p1 (0,2/un) e p2 (0,5/un). Vendeu 10 de p1 e 4 de p2 → 2 + 2 = 4.
    const r = calcularEstoqueInsumos(
      [ins('i1', 'Carne')],
      [{ insumoId: 'i1', quantity: 10 }],
      [
        { productId: 'p1', insumoId: 'i1', quantity: 0.2 },
        { productId: 'p2', insumoId: 'i1', quantity: 0.5 },
      ],
      [{ productId: 'p1', quantity: 10 }, { productId: 'p2', quantity: 4 }],
    )
    expect(r[0].consumido).toBeCloseTo(4, 5)
    expect(r[0].saldo).toBeCloseTo(6, 5)
  })

  it('produto com vários insumos consome cada um', () => {
    // p1 usa 1 Pão (i1) e 0,2 Carne (i2) por unidade. Vendeu 3.
    const r = calcularEstoqueInsumos(
      [ins('i1', 'Pao'), ins('i2', 'Carne')],
      [{ insumoId: 'i1', quantity: 10 }, { insumoId: 'i2', quantity: 10 }],
      [
        { productId: 'p1', insumoId: 'i1', quantity: 1 },
        { productId: 'p1', insumoId: 'i2', quantity: 0.2 },
      ],
      [{ productId: 'p1', quantity: 3 }],
    )
    const pao = r.find(x => x.insumoId === 'i1')!
    const carne = r.find(x => x.insumoId === 'i2')!
    expect(pao.consumido).toBe(3)
    expect(carne.consumido).toBeCloseTo(0.6, 5)
  })

  it('venda de produto sem receita não consome nada', () => {
    const r = calcularEstoqueInsumos(
      [ins('i1', 'Carne')],
      [{ insumoId: 'i1', quantity: 5 }],
      [], // nenhuma receita
      [{ productId: 'p1', quantity: 100 }],
    )
    expect(r[0].consumido).toBe(0)
    expect(r[0].saldo).toBe(5)
  })

  it('consumo maior que entradas → saldo negativo, status negativo (mesmo com mínimo 0)', () => {
    const r = calcularEstoqueInsumos(
      [ins('i1', 'Carne', 0)],
      [{ insumoId: 'i1', quantity: 1 }],
      [{ productId: 'p1', insumoId: 'i1', quantity: 1 }],
      [{ productId: 'p1', quantity: 3 }],
    )
    expect(r[0].saldo).toBe(-2)
    expect(r[0].status).toBe('negativo')
  })

  it('saldo == mínimo com mínimo > 0 é "baixo"', () => {
    const r = calcularEstoqueInsumos(
      [ins('i1', 'Carne', 2)],
      [{ insumoId: 'i1', quantity: 5 }],
      [{ productId: 'p1', insumoId: 'i1', quantity: 1 }],
      [{ productId: 'p1', quantity: 3 }],
    )
    expect(r[0].saldo).toBe(2)
    expect(r[0].status).toBe('baixo')
  })

  it('saldo 0 com mínimo 0 é "ok"', () => {
    const r = calcularEstoqueInsumos(
      [ins('i1', 'Carne', 0)],
      [{ insumoId: 'i1', quantity: 3 }],
      [{ productId: 'p1', insumoId: 'i1', quantity: 1 }],
      [{ productId: 'p1', quantity: 3 }],
    )
    expect(r[0].saldo).toBe(0)
    expect(r[0].status).toBe('ok')
  })

  it('ordena negativo → baixo → ok e, dentro do grupo, por nome', () => {
    const r = calcularEstoqueInsumos(
      [ins('a', 'Alface', 5), ins('b', 'Bacon', 0), ins('c', 'Carne', 5), ins('d', 'Queijo', 0)],
      [
        { insumoId: 'b', quantity: 100 }, // Bacon: saldo 100, min 0 → ok
        { insumoId: 'c', quantity: 5 },   // Carne: saldo 5 == min 5 → baixo
      ],
      [
        { productId: 'pa', insumoId: 'a', quantity: 1 }, // Alface consumida abaixo de 0
        { productId: 'pd', insumoId: 'd', quantity: 1 },
      ],
      [
        { productId: 'pa', quantity: 2 }, // Alface: saldo -2 → negativo
        { productId: 'pd', quantity: 9 }, // Queijo: saldo -9 → negativo
      ],
    )
    expect(r.map(x => x.nome)).toEqual(['Alface', 'Queijo', 'Carne', 'Bacon'])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/lib/insumos.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/insumos"`.

- [ ] **Step 3: Implementar `src/lib/insumos.ts`**

```ts
import { statusEstoque, ORDEM_STATUS, type EstoqueStatus } from './stockStatus'

export interface InsumoInput {
  id: string
  name: string
  unit: string
  cost: number
  minStock: number
}

export interface InsumoEntradaInput {
  insumoId: string
  quantity: number
}

export interface ReceitaItemInput {
  productId: string
  insumoId: string
  quantity: number
}

export interface VendaInput {
  productId: string
  quantity: number
}

export interface InsumoSaldo {
  insumoId: string
  nome: string
  unidade: string
  entradas: number
  consumido: number
  saldo: number
  minimo: number
  status: EstoqueStatus
}

export function calcularEstoqueInsumos(
  insumos: InsumoInput[],
  entradas: InsumoEntradaInput[],
  receitas: ReceitaItemInput[],
  vendas: VendaInput[],
): InsumoSaldo[] {
  // Entradas somadas por insumo
  const entradasPorInsumo = new Map<string, number>()
  for (const e of entradas) {
    entradasPorInsumo.set(e.insumoId, (entradasPorInsumo.get(e.insumoId) ?? 0) + e.quantity)
  }

  // Receita agrupada por produto
  const receitaPorProduto = new Map<string, { insumoId: string; quantity: number }[]>()
  for (const r of receitas) {
    if (!receitaPorProduto.has(r.productId)) receitaPorProduto.set(r.productId, [])
    receitaPorProduto.get(r.productId)!.push({ insumoId: r.insumoId, quantity: r.quantity })
  }

  // Consumo derivado das vendas
  const consumoPorInsumo = new Map<string, number>()
  for (const v of vendas) {
    const itens = receitaPorProduto.get(v.productId)
    if (!itens) continue
    for (const it of itens) {
      consumoPorInsumo.set(
        it.insumoId,
        (consumoPorInsumo.get(it.insumoId) ?? 0) + it.quantity * v.quantity,
      )
    }
  }

  const resultado = insumos.map((i): InsumoSaldo => {
    const entradasTot = entradasPorInsumo.get(i.id) ?? 0
    const consumido = consumoPorInsumo.get(i.id) ?? 0
    const saldo = entradasTot - consumido
    return {
      insumoId: i.id,
      nome: i.name,
      unidade: i.unit,
      entradas: entradasTot,
      consumido,
      saldo,
      minimo: i.minStock,
      status: statusEstoque(saldo, i.minStock),
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

Run: `npx vitest run src/__tests__/lib/insumos.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/insumos.ts src/__tests__/lib/insumos.test.ts
git commit -m "feat: add calcularEstoqueInsumos derived-consumption aggregation" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Lógica pura `calcularCustoReal`

**Files:**
- Modify: `src/lib/insumos.ts`
- Modify: `src/__tests__/lib/insumos.test.ts`

**Interfaces:**
- Consumes: `InsumoInput`, `ReceitaItemInput` (Task 3).
- Produces:
  ```ts
  interface CustoRealItem { insumoId: string; nome: string; unidade: string; quantidade: number; custoUnitario: number; subtotal: number }
  interface CustoRealProduto { productId: string; custoReal: number; itens: CustoRealItem[] }
  function calcularCustoReal(productId: string, itensReceita: ReceitaItemInput[], insumosPorId: Map<string, InsumoInput>): CustoRealProduto
  ```

- [ ] **Step 1: Adicionar os testes que falham**

No fim de `src/__tests__/lib/insumos.test.ts`, adicionar o import e o novo `describe`:

Atualizar a linha de import para incluir `calcularCustoReal`:

```ts
import { calcularEstoqueInsumos, calcularCustoReal } from '@/lib/insumos'
```

E adicionar ao fim do arquivo:

```ts
describe('calcularCustoReal', () => {
  const insumo = (id: string, name: string, cost: number) => ({ id, name, unit: 'kg', cost, minStock: 0 })
  const mapa = (...arr: { id: string; name: string; unit: string; cost: number; minStock: number }[]) =>
    new Map(arr.map(i => [i.id, i]))

  it('produto sem receita → custo real 0 e sem itens', () => {
    const r = calcularCustoReal('p1', [], mapa(insumo('i1', 'Carne', 30)))
    expect(r).toEqual({ productId: 'p1', custoReal: 0, itens: [] })
  })

  it('soma os subtotais (quantidade × custo) dos itens do produto', () => {
    // p1: 0,2 kg Carne (R$ 30/kg) + 1 un Pão (R$ 0,50) = 6 + 0,50 = 6,50
    const r = calcularCustoReal(
      'p1',
      [
        { productId: 'p1', insumoId: 'i1', quantity: 0.2 },
        { productId: 'p1', insumoId: 'i2', quantity: 1 },
      ],
      mapa(insumo('i1', 'Carne', 30), { id: 'i2', name: 'Pao', unit: 'un', cost: 0.5, minStock: 0 }),
    )
    expect(r.custoReal).toBeCloseTo(6.5, 5)
    expect(r.itens).toHaveLength(2)
    expect(r.itens[0]).toEqual({ insumoId: 'i1', nome: 'Carne', unidade: 'kg', quantidade: 0.2, custoUnitario: 30, subtotal: 6 })
  })

  it('ignora itens de receita de outros produtos', () => {
    const r = calcularCustoReal(
      'p1',
      [
        { productId: 'p1', insumoId: 'i1', quantity: 1 },
        { productId: 'p2', insumoId: 'i1', quantity: 5 },
      ],
      mapa(insumo('i1', 'Carne', 10)),
    )
    expect(r.custoReal).toBe(10)
    expect(r.itens).toHaveLength(1)
  })

  it('ignora item cujo insumo não está no mapa', () => {
    const r = calcularCustoReal(
      'p1',
      [{ productId: 'p1', insumoId: 'sumiu', quantity: 1 }],
      mapa(insumo('i1', 'Carne', 10)),
    )
    expect(r.custoReal).toBe(0)
    expect(r.itens).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/lib/insumos.test.ts`
Expected: FAIL — `calcularCustoReal is not a function` / import não resolvido.

- [ ] **Step 3: Adicionar `calcularCustoReal` em `src/lib/insumos.ts`**

Ao fim do arquivo, adicionar:

```ts
export interface CustoRealItem {
  insumoId: string
  nome: string
  unidade: string
  quantidade: number
  custoUnitario: number
  subtotal: number
}

export interface CustoRealProduto {
  productId: string
  custoReal: number
  itens: CustoRealItem[]
}

export function calcularCustoReal(
  productId: string,
  itensReceita: ReceitaItemInput[],
  insumosPorId: Map<string, InsumoInput>,
): CustoRealProduto {
  const itens: CustoRealItem[] = []
  let custoReal = 0

  for (const r of itensReceita) {
    if (r.productId !== productId) continue
    const insumo = insumosPorId.get(r.insumoId)
    if (!insumo) continue
    const subtotal = r.quantity * insumo.cost
    custoReal += subtotal
    itens.push({
      insumoId: r.insumoId,
      nome: insumo.name,
      unidade: insumo.unit,
      quantidade: r.quantity,
      custoUnitario: insumo.cost,
      subtotal,
    })
  }

  return { productId, custoReal, itens }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/lib/insumos.test.ts`
Expected: PASS (14 testes — 10 do Task 3 + 4 novos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/insumos.ts src/__tests__/lib/insumos.test.ts
git commit -m "feat: add calcularCustoReal for per-product real cost" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Server Actions de insumos

**Files:**
- Create: `src/app/(protected)/insumos/actions.ts`
- Test: `src/__tests__/actions/insumos.test.ts`

**Interfaces:**
- Consumes: `prisma.insumo.{create,findFirst,updateMany}`, `prisma.insumoEntry.{create,deleteMany}` (mockados na Task 1); `redirect` de `next/navigation`.
- Produces:
  ```ts
  type InsumoActionState = { error: string } | null
  function criarInsumo(prevState: InsumoActionState, formData: FormData): Promise<InsumoActionState>
  function registrarEntradaInsumo(prevState: InsumoActionState, formData: FormData): Promise<InsumoActionState>
  function removerEntradaInsumo(id: string): Promise<void>
  function definirMinimoInsumo(insumoId: string, formData: FormData): Promise<void>
  function definirCustoInsumo(insumoId: string, formData: FormData): Promise<void>
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/actions/insumos.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

async function actions() {
  return import('@/app/(protected)/insumos/actions')
}

beforeEach(() => vi.clearAllMocks())

describe('criarInsumo', () => {
  it('erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { criarInsumo } = await actions()
    await expect(criarInsumo(null, new FormData())).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('erro se campo obrigatório ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { criarInsumo } = await actions()
    const fd = new FormData()
    fd.set('name', 'Carne')
    // unit e cost ausentes
    await expect(criarInsumo(null, fd)).resolves.toEqual({ error: 'Campos obrigatórios ausentes' })
  })

  it('erro se unidade inválida', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { criarInsumo } = await actions()
    const fd = new FormData()
    fd.set('name', 'Carne')
    fd.set('unit', 'toneladas')
    fd.set('cost', '30')
    await expect(criarInsumo(null, fd)).resolves.toEqual({ error: 'Unidade inválida' })
  })

  it('erro se custo negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { criarInsumo } = await actions()
    const fd = new FormData()
    fd.set('name', 'Carne')
    fd.set('unit', 'kg')
    fd.set('cost', '-1')
    await expect(criarInsumo(null, fd)).resolves.toEqual({ error: 'Custo inválido' })
  })

  it('cria insumo e redireciona para /insumos', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.create).mockResolvedValue({} as any)
    const { criarInsumo } = await actions()
    const fd = new FormData()
    fd.set('name', 'Carne')
    fd.set('unit', 'kg')
    fd.set('cost', '30')
    fd.set('minStock', '2')
    await criarInsumo(null, fd)
    expect(prisma.insumo.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Carne', unit: 'kg', cost: 30, minStock: 2 },
    })
    expect(redirect).toHaveBeenCalledWith('/insumos')
  })
})

describe('registrarEntradaInsumo', () => {
  it('erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { registrarEntradaInsumo } = await actions()
    await expect(registrarEntradaInsumo(null, new FormData())).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('erro se quantidade <= 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntradaInsumo } = await actions()
    const fd = new FormData()
    fd.set('insumoId', 'i1')
    fd.set('date', '2026-07-12')
    fd.set('quantity', '0')
    await expect(registrarEntradaInsumo(null, fd)).resolves.toEqual({ error: 'Quantidade inválida' })
  })

  it('erro se data é futura', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntradaInsumo } = await actions()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const fd = new FormData()
    fd.set('insumoId', 'i1')
    fd.set('date', tomorrow.toISOString().slice(0, 10))
    fd.set('quantity', '5')
    await expect(registrarEntradaInsumo(null, fd)).resolves.toEqual({ error: 'Data inválida' })
  })

  it('erro se insumo não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue(null)
    const { registrarEntradaInsumo } = await actions()
    const fd = new FormData()
    fd.set('insumoId', 'i1')
    fd.set('date', '2026-07-12')
    fd.set('quantity', '5')
    await expect(registrarEntradaInsumo(null, fd)).resolves.toEqual({ error: 'Insumo não encontrado' })
  })

  it('aceita quantidade fracionária e persiste', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue({ id: 'i1', userId: 'user-1' } as any)
    vi.mocked(prisma.insumoEntry.create).mockResolvedValue({} as any)
    const { registrarEntradaInsumo } = await actions()
    const fd = new FormData()
    fd.set('insumoId', 'i1')
    fd.set('date', '2026-07-12')
    fd.set('quantity', '1.5')
    fd.set('note', 'Compra atacado')
    const result = await registrarEntradaInsumo(null, fd)
    expect(result).toBeNull()
    expect(prisma.insumoEntry.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', insumoId: 'i1', date: new Date('2026-07-12'), quantity: 1.5, note: 'Compra atacado' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/insumos')
  })
})

describe('removerEntradaInsumo', () => {
  it('lança se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerEntradaInsumo } = await actions()
    await expect(removerEntradaInsumo('e1')).rejects.toThrow('Não autorizado')
  })

  it('lança se entrada não encontrada', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumoEntry.deleteMany).mockResolvedValue({ count: 0 } as any)
    const { removerEntradaInsumo } = await actions()
    await expect(removerEntradaInsumo('e1')).rejects.toThrow('Entrada não encontrada')
  })

  it('remove a entrada escopada ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumoEntry.deleteMany).mockResolvedValue({ count: 1 } as any)
    const { removerEntradaInsumo } = await actions()
    await removerEntradaInsumo('e1')
    expect(prisma.insumoEntry.deleteMany).toHaveBeenCalledWith({ where: { id: 'e1', userId: 'user-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/insumos')
  })
})

describe('definirMinimoInsumo', () => {
  it('lança se mínimo negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { definirMinimoInsumo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '-1')
    await expect(definirMinimoInsumo('i1', fd)).rejects.toThrow('Estoque mínimo inválido')
  })

  it('atualiza o mínimo (aceita fracionário) escopado ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.updateMany).mockResolvedValue({ count: 1 } as any)
    const { definirMinimoInsumo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '0.5')
    await definirMinimoInsumo('i1', fd)
    expect(prisma.insumo.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', userId: 'user-1' },
      data: { minStock: 0.5 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/insumos')
  })
})

describe('definirCustoInsumo', () => {
  it('lança se custo negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { definirCustoInsumo } = await actions()
    const fd = new FormData()
    fd.set('cost', '-5')
    await expect(definirCustoInsumo('i1', fd)).rejects.toThrow('Custo inválido')
  })

  it('atualiza o custo escopado ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.updateMany).mockResolvedValue({ count: 1 } as any)
    const { definirCustoInsumo } = await actions()
    const fd = new FormData()
    fd.set('cost', '32.5')
    await definirCustoInsumo('i1', fd)
    expect(prisma.insumo.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', userId: 'user-1' },
      data: { cost: 32.5 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/insumos')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/actions/insumos.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/(protected)/insumos/actions"`.

- [ ] **Step 3: Implementar `src/app/(protected)/insumos/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type InsumoActionState = { error: string } | null

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const UNIDADES = ['un', 'g', 'kg', 'ml', 'L'] as const

export async function criarInsumo(
  _prevState: InsumoActionState,
  formData: FormData
): Promise<InsumoActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const name = (formData.get('name') as string)?.trim()
  const unit = formData.get('unit') as string
  const costRaw = formData.get('cost') as string
  const minStockRaw = formData.get('minStock') as string | null

  if (!name || !unit || !costRaw) return { error: 'Campos obrigatórios ausentes' }
  if (!(UNIDADES as readonly string[]).includes(unit)) return { error: 'Unidade inválida' }

  const cost = Number(costRaw)
  if (isNaN(cost) || cost < 0) return { error: 'Custo inválido' }

  const minStock = minStockRaw ? Number(minStockRaw) : 0
  if (isNaN(minStock) || minStock < 0) return { error: 'Estoque mínimo inválido' }

  await prisma.insumo.create({
    data: { userId: session.user.id, name, unit, cost, minStock },
  })

  revalidatePath('/insumos')
  redirect('/insumos')
}

export async function registrarEntradaInsumo(
  _prevState: InsumoActionState,
  formData: FormData
): Promise<InsumoActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const insumoId = formData.get('insumoId') as string
  const dateStr = formData.get('date') as string
  const quantityRaw = formData.get('quantity') as string
  const noteRaw = formData.get('note') as string | null
  const note = noteRaw && noteRaw.trim() !== '' ? noteRaw.trim() : null

  if (!insumoId || !dateStr || !quantityRaw) {
    return { error: 'Campos obrigatórios ausentes' }
  }

  if (!ISO_RE.test(dateStr)) return { error: 'Data inválida' }
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) return { error: 'Data inválida' }

  const quantity = Number(quantityRaw)
  if (isNaN(quantity) || quantity <= 0) return { error: 'Quantidade inválida' }

  const insumo = await prisma.insumo.findFirst({
    where: { id: insumoId, userId: session.user.id },
  })
  if (!insumo) return { error: 'Insumo não encontrado' }

  await prisma.insumoEntry.create({
    data: {
      userId: session.user.id,
      insumoId,
      date: new Date(dateStr),
      quantity,
      note,
    },
  })

  revalidatePath('/insumos')
  revalidatePath('/dashboard')
  return null
}

export async function removerEntradaInsumo(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const result = await prisma.insumoEntry.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (result.count === 0) throw new Error('Entrada não encontrada ou não autorizada')

  revalidatePath('/insumos')
  revalidatePath('/dashboard')
}

export async function definirMinimoInsumo(insumoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const minStock = Number(formData.get('minStock'))
  if (isNaN(minStock) || minStock < 0) throw new Error('Estoque mínimo inválido')

  const result = await prisma.insumo.updateMany({
    where: { id: insumoId, userId: session.user.id },
    data: { minStock },
  })
  if (result.count === 0) throw new Error('Insumo não encontrado ou não autorizado')

  revalidatePath('/insumos')
  revalidatePath('/dashboard')
}

export async function definirCustoInsumo(insumoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const cost = Number(formData.get('cost'))
  if (isNaN(cost) || cost < 0) throw new Error('Custo inválido')

  const result = await prisma.insumo.updateMany({
    where: { id: insumoId, userId: session.user.id },
    data: { cost },
  })
  if (result.count === 0) throw new Error('Insumo não encontrado ou não autorizado')

  revalidatePath('/insumos')
  revalidatePath('/products')
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/actions/insumos.test.ts`
Expected: PASS (17 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/insumos/actions.ts" src/__tests__/actions/insumos.test.ts
git commit -m "feat: add insumo server actions (cadastro, entrada, mínimo, custo)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Server Actions da ficha técnica (receita)

**Files:**
- Create: `src/app/(protected)/products/[id]/actions.ts`
- Test: `src/__tests__/actions/receita.test.ts`

**Interfaces:**
- Consumes: `prisma.product.findFirst`, `prisma.insumo.findFirst`, `prisma.recipeItem.{findFirst,create,deleteMany}` (mockados na Task 1).
- Produces:
  ```ts
  type ReceitaActionState = { error: string } | null
  function adicionarItemReceita(prevState: ReceitaActionState, formData: FormData): Promise<ReceitaActionState>
  function removerItemReceita(id: string, productId: string): Promise<void>
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/__tests__/actions/receita.test.ts`:

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
  return import('@/app/(protected)/products/[id]/actions')
}

beforeEach(() => vi.clearAllMocks())

describe('adicionarItemReceita', () => {
  it('erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { adicionarItemReceita } = await actions()
    await expect(adicionarItemReceita(null, new FormData())).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('erro se quantidade <= 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0')
    await expect(adicionarItemReceita(null, fd)).resolves.toEqual({ error: 'Quantidade inválida' })
  })

  it('erro se produto não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0.2')
    await expect(adicionarItemReceita(null, fd)).resolves.toEqual({ error: 'Produto não encontrado' })
  })

  it('erro se insumo não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'p1', userId: 'user-1' } as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue(null)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0.2')
    await expect(adicionarItemReceita(null, fd)).resolves.toEqual({ error: 'Insumo não encontrado' })
  })

  it('erro se o insumo já está na ficha técnica', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'p1', userId: 'user-1' } as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue({ id: 'i1', userId: 'user-1' } as any)
    vi.mocked(prisma.recipeItem.findFirst).mockResolvedValue({ id: 'r1' } as any)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0.2')
    await expect(adicionarItemReceita(null, fd)).resolves.toEqual({ error: 'Insumo já está na ficha técnica' })
  })

  it('cria o item e revalida a página do produto', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'p1', userId: 'user-1' } as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue({ id: 'i1', userId: 'user-1' } as any)
    vi.mocked(prisma.recipeItem.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.recipeItem.create).mockResolvedValue({} as any)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0.2')
    const result = await adicionarItemReceita(null, fd)
    expect(result).toBeNull()
    expect(prisma.recipeItem.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', productId: 'p1', insumoId: 'i1', quantity: 0.2 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/products/p1')
  })
})

describe('removerItemReceita', () => {
  it('lança se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerItemReceita } = await actions()
    await expect(removerItemReceita('r1', 'p1')).rejects.toThrow('Não autorizado')
  })

  it('lança se item não encontrado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.recipeItem.deleteMany).mockResolvedValue({ count: 0 } as any)
    const { removerItemReceita } = await actions()
    await expect(removerItemReceita('r1', 'p1')).rejects.toThrow('Item não encontrado')
  })

  it('remove o item escopado ao userId e revalida a página do produto', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.recipeItem.deleteMany).mockResolvedValue({ count: 1 } as any)
    const { removerItemReceita } = await actions()
    await removerItemReceita('r1', 'p1')
    expect(prisma.recipeItem.deleteMany).toHaveBeenCalledWith({ where: { id: 'r1', userId: 'user-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/products/p1')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/actions/receita.test.ts`
Expected: FAIL — `Failed to resolve import "@/app/(protected)/products/[id]/actions"`.

- [ ] **Step 3: Implementar `src/app/(protected)/products/[id]/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type ReceitaActionState = { error: string } | null

export async function adicionarItemReceita(
  _prevState: ReceitaActionState,
  formData: FormData
): Promise<ReceitaActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const productId = formData.get('productId') as string
  const insumoId = formData.get('insumoId') as string
  const quantityRaw = formData.get('quantity') as string

  if (!productId || !insumoId || !quantityRaw) {
    return { error: 'Campos obrigatórios ausentes' }
  }

  const quantity = Number(quantityRaw)
  if (isNaN(quantity) || quantity <= 0) return { error: 'Quantidade inválida' }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
  })
  if (!product) return { error: 'Produto não encontrado' }

  const insumo = await prisma.insumo.findFirst({
    where: { id: insumoId, userId: session.user.id },
  })
  if (!insumo) return { error: 'Insumo não encontrado' }

  const existing = await prisma.recipeItem.findFirst({
    where: { productId, insumoId, userId: session.user.id },
  })
  if (existing) return { error: 'Insumo já está na ficha técnica' }

  await prisma.recipeItem.create({
    data: { userId: session.user.id, productId, insumoId, quantity },
  })

  revalidatePath(`/products/${productId}`)
  revalidatePath('/insumos')
  revalidatePath('/dashboard')
  return null
}

export async function removerItemReceita(id: string, productId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const result = await prisma.recipeItem.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (result.count === 0) throw new Error('Item não encontrado ou não autorizado')

  revalidatePath(`/products/${productId}`)
  revalidatePath('/insumos')
  revalidatePath('/dashboard')
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/actions/receita.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/products/[id]/actions.ts" src/__tests__/actions/receita.test.ts
git commit -m "feat: add ficha técnica server actions (adicionar/remover item)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Página `/insumos` + cadastro `/insumos/new`

**Files:**
- Create: `src/app/(protected)/insumos/EntradaInsumoForm.tsx`
- Create: `src/app/(protected)/insumos/MinimoInsumoForm.tsx`
- Create: `src/app/(protected)/insumos/CustoInsumoForm.tsx`
- Create: `src/app/(protected)/insumos/page.tsx`
- Create: `src/app/(protected)/insumos/new/NovoInsumoForm.tsx`
- Create: `src/app/(protected)/insumos/new/page.tsx`

**Interfaces:**
- Consumes: `calcularEstoqueInsumos` (Task 3); `criarInsumo`, `registrarEntradaInsumo`, `removerEntradaInsumo`, `definirMinimoInsumo`, `definirCustoInsumo` (Task 5); `prisma.insumo.findMany`, `prisma.insumoEntry.findMany`, `prisma.recipeItem.findMany`, `prisma.sale.findMany`; componente `DateInput`.
- Produces: rotas `/insumos` e `/insumos/new` renderizadas.

Nota: páginas/forms não têm teste unitário neste projeto (igual `/estoque`). A verificação é `npm run build` + `npm run lint` (fallback sem banco: `npx tsc --noEmit && npm run lint`).

- [ ] **Step 1: Criar `src/app/(protected)/insumos/EntradaInsumoForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { registrarEntradaInsumo } from './actions'
import { DateInput } from '@/components/DateInput'

interface Props {
  today: string
  insumos: { id: string; name: string; unit: string }[]
}

export function EntradaInsumoForm({ today, insumos }: Props) {
  const [state, formAction] = useActionState(registrarEntradaInsumo, null)

  return (
    <form
      action={formAction}
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col gap-3"
    >
      <p className="font-semibold dark:text-slate-100 text-sm">Registrar entrada (compra)</p>

      {state?.error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Insumo</label>
          <select
            name="insumoId"
            required
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Selecionar...</option>
            {insumos.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
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
            step="any"
            min="0"
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

- [ ] **Step 2: Criar `src/app/(protected)/insumos/MinimoInsumoForm.tsx`**

```tsx
'use client'

import { useActionState, useEffect, useState } from 'react'
import { definirMinimoInsumo } from './actions'

type State = { ok: true } | { ok: false; error: string } | null

interface Props {
  insumoId: string
  minimo: number
}

export function MinimoInsumoForm({ insumoId, minimo }: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      try {
        await definirMinimoInsumo(insumoId, formData)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar' }
      }
    },
    null,
  )

  const [dismissed, setDismissed] = useState<State>(null)
  const showSaved = !!state?.ok && state !== dismissed
  useEffect(() => {
    if (showSaved) {
      const t = setTimeout(() => setDismissed(state), 2000)
      return () => clearTimeout(t)
    }
  }, [showSaved, state])

  return (
    <form action={formAction} className="flex items-center gap-1">
      <label className="text-xs text-gray-400 dark:text-slate-500">mín.</label>
      <input
        type="number"
        name="minStock"
        min="0"
        step="any"
        defaultValue={minimo}
        className="w-16 border dark:border-slate-600 rounded-lg px-2 py-1 text-sm dark:bg-slate-900 dark:text-slate-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-orange-500 hover:text-orange-600 disabled:opacity-50"
      >
        {pending ? 'Salvando…' : 'Salvar'}
      </button>
      {showSaved && <span className="text-xs text-green-600">✓ salvo</span>}
      {state && !state.ok && <span className="text-xs text-red-500">{state.error}</span>}
    </form>
  )
}
```

- [ ] **Step 3: Criar `src/app/(protected)/insumos/CustoInsumoForm.tsx`**

```tsx
'use client'

import { useActionState, useEffect, useState } from 'react'
import { definirCustoInsumo } from './actions'

type State = { ok: true } | { ok: false; error: string } | null

interface Props {
  insumoId: string
  custo: number
}

export function CustoInsumoForm({ insumoId, custo }: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      try {
        await definirCustoInsumo(insumoId, formData)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar' }
      }
    },
    null,
  )

  const [dismissed, setDismissed] = useState<State>(null)
  const showSaved = !!state?.ok && state !== dismissed
  useEffect(() => {
    if (showSaved) {
      const t = setTimeout(() => setDismissed(state), 2000)
      return () => clearTimeout(t)
    }
  }, [showSaved, state])

  return (
    <form action={formAction} className="flex items-center gap-1">
      <label className="text-xs text-gray-400 dark:text-slate-500">R$</label>
      <input
        type="number"
        name="cost"
        min="0"
        step="0.01"
        defaultValue={custo}
        className="w-20 border dark:border-slate-600 rounded-lg px-2 py-1 text-sm dark:bg-slate-900 dark:text-slate-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-orange-500 hover:text-orange-600 disabled:opacity-50"
      >
        {pending ? 'Salvando…' : 'Salvar'}
      </button>
      {showSaved && <span className="text-xs text-green-600">✓ salvo</span>}
      {state && !state.ok && <span className="text-xs text-red-500">{state.error}</span>}
    </form>
  )
}
```

- [ ] **Step 4: Criar `src/app/(protected)/insumos/page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularEstoqueInsumos } from '@/lib/insumos'
import type { EstoqueStatus } from '@/lib/stockStatus'
import { removerEntradaInsumo } from './actions'
import { EntradaInsumoForm } from './EntradaInsumoForm'
import { MinimoInsumoForm } from './MinimoInsumoForm'
import { CustoInsumoForm } from './CustoInsumoForm'

const STATUS_BADGE: Record<EstoqueStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  baixo: { label: 'Baixo', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  negativo: { label: 'Negativo', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export default async function InsumosPage() {
  const session = await getServerSession(authOptions)
  const userId = session!.user.id
  const today = new Date().toISOString().slice(0, 10)

  const [insumos, entradas, receitas, sales] = await Promise.all([
    prisma.insumo.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.insumoEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.recipeItem.findMany({ where: { userId } }),
    prisma.sale.findMany({ where: { userId } }),
  ])

  const estoque = calcularEstoqueInsumos(
    insumos.map(i => ({ id: i.id, name: i.name, unit: i.unit, cost: i.cost, minStock: i.minStock })),
    entradas.map(e => ({ insumoId: e.insumoId, quantity: e.quantity })),
    receitas.map(r => ({ productId: r.productId, insumoId: r.insumoId, quantity: r.quantity })),
    sales.map(s => ({ productId: s.productId, quantity: s.quantity })),
  )

  const infoPorInsumo = new Map(insumos.map(i => [i.id, i]))
  const recentes = entradas.slice(0, 15)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold dark:text-slate-100">Insumos</h1>
        <Link
          href="/insumos/new"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Novo insumo
        </Link>
      </div>

      {insumos.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 py-8">
          Nenhum insumo cadastrado.{' '}
          <Link href="/insumos/new" className="text-orange-500">Cadastrar agora</Link>
        </p>
      ) : (
        <>
          <EntradaInsumoForm
            today={today}
            insumos={insumos.map(i => ({ id: i.id, name: i.name, unit: i.unit }))}
          />

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b dark:border-slate-700">
              <span className="font-semibold dark:text-slate-100">Saldo por insumo</span>
            </div>
            {estoque.map(item => {
              const badge = STATUS_BADGE[item.status]
              const info = infoPorInsumo.get(item.insumoId)!
              return (
                <div key={item.insumoId} className="flex flex-wrap justify-between items-center gap-3 px-4 py-3 border-b last:border-0 dark:border-slate-700">
                  <div className="min-w-[8rem]">
                    <p className="text-sm font-medium dark:text-slate-100">{item.nome}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {fmt(item.entradas)} {item.unidade} entradas · {fmt(item.consumido)} {item.unidade} consumidos
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-2xl font-bold ${item.saldo < 0 ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {fmt(item.saldo)} <span className="text-sm font-normal text-gray-400 dark:text-slate-500">{item.unidade}</span>
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                    <MinimoInsumoForm insumoId={item.insumoId} minimo={item.minimo} />
                    <CustoInsumoForm insumoId={item.insumoId} custo={info.cost} />
                  </div>
                </div>
              )
            })}
          </div>

          {recentes.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b dark:border-slate-700">
                <span className="font-semibold dark:text-slate-100">Entradas recentes</span>
              </div>
              {recentes.map(e => {
                const info = infoPorInsumo.get(e.insumoId)
                return (
                  <div key={e.id} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
                    <p className="text-sm dark:text-slate-200">
                      {e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ·{' '}
                      {info?.name ?? '—'} · +{fmt(e.quantity)} {info?.unit ?? ''}
                      {e.note ? ` · ${e.note}` : ''}
                    </p>
                    <form action={removerEntradaInsumo.bind(null, e.id)}>
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                        Remover
                      </button>
                    </form>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Criar `src/app/(protected)/insumos/new/NovoInsumoForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { criarInsumo } from '../actions'

const UNIDADES = ['un', 'g', 'kg', 'ml', 'L']

export function NovoInsumoForm() {
  const [state, formAction] = useActionState(criarInsumo, null)

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-slate-100">Nome</label>
        <input
          type="text"
          name="name"
          placeholder="Ex: Carne moída"
          required
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-slate-100">Unidade de medida</label>
        <select
          name="unit"
          required
          defaultValue=""
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="" disabled>Selecionar...</option>
          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-slate-100">Custo por unidade (R$)</label>
        <input
          type="number"
          name="cost"
          placeholder="0.00"
          step="0.01"
          min="0"
          required
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-slate-100">Estoque mínimo</label>
        <input
          type="number"
          name="minStock"
          placeholder="0"
          step="any"
          min="0"
          defaultValue="0"
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">0 = sem alerta de estoque baixo</p>
      </div>
      {state?.error && <p className="text-red-500 text-sm">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="flex-1 bg-orange-500 text-white py-4 rounded-xl font-semibold text-lg"
        >
          Salvar insumo
        </button>
        <Link href="/insumos" className="text-sm text-gray-500 dark:text-slate-400">Cancelar</Link>
      </div>
    </form>
  )
}
```

- [ ] **Step 6: Criar `src/app/(protected)/insumos/new/page.tsx`**

```tsx
import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NovoInsumoForm } from './NovoInsumoForm'

export default function NovoInsumoPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <Link href="/insumos" className="text-orange-500 text-lg">←</Link>
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Link href="/insumos" className="text-orange-500 text-lg hidden lg:inline">←</Link>
        <h1 className="text-xl font-bold dark:text-slate-100">Novo Insumo</h1>
      </div>

      <NovoInsumoForm />
    </div>
  )
}
```

- [ ] **Step 7: Verificar build e lint**

Run: `npm run build && npm run lint`
Expected: build conclui; lint sem erros. (Fallback sem banco: `npx tsc --noEmit && npm run lint`.)

- [ ] **Step 8: Commit**

```bash
git add "src/app/(protected)/insumos"
git commit -m "feat: add /insumos page and /insumos/new cadastro" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Detalhe do produto `/products/[id]` com ficha técnica e custo real

**Files:**
- Create: `src/app/(protected)/products/[id]/ReceitaForm.tsx`
- Create: `src/app/(protected)/products/[id]/page.tsx`
- Modify: `src/app/(protected)/products/page.tsx`

**Interfaces:**
- Consumes: `calcularCustoReal` (Task 4); `adicionarItemReceita`, `removerItemReceita` (Task 6); `prisma.product.findFirst`, `prisma.insumo.findMany`, `prisma.recipeItem.findMany`.
- Produces: rota `/products/[id]`; lista de produtos com link para o detalhe.

- [ ] **Step 1: Criar `src/app/(protected)/products/[id]/ReceitaForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { adicionarItemReceita } from './actions'

interface Props {
  productId: string
  insumos: { id: string; name: string; unit: string }[]
}

export function ReceitaForm({ productId, insumos }: Props) {
  const [state, formAction] = useActionState(adicionarItemReceita, null)

  if (insumos.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-slate-500">
        Cadastre insumos antes de montar a ficha técnica.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />

      {state?.error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-xs text-gray-500 dark:text-slate-400">Insumo</label>
          <select
            name="insumoId"
            required
            defaultValue=""
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="" disabled>Selecionar...</option>
            {insumos.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Qtd / unidade</label>
          <input
            type="number"
            name="quantity"
            step="any"
            min="0"
            placeholder="0"
            required
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <button
        type="submit"
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm"
      >
        Adicionar insumo
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Criar `src/app/(protected)/products/[id]/page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCustoReal, type InsumoInput } from '@/lib/insumos'
import { ThemeToggle } from '@/components/ThemeToggle'
import { removerItemReceita } from './actions'
import { ReceitaForm } from './ReceitaForm'

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const userId = session!.user.id

  const product = await prisma.product.findFirst({ where: { id, userId } })
  if (!product) notFound()

  const [insumos, receita] = await Promise.all([
    prisma.insumo.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.recipeItem.findMany({ where: { userId, productId: id } }),
  ])

  const insumosPorId = new Map<string, InsumoInput>(
    insumos.map(i => [i.id, { id: i.id, name: i.name, unit: i.unit, cost: i.cost, minStock: i.minStock }]),
  )

  const custoReal = calcularCustoReal(
    id,
    receita.map(r => ({ productId: r.productId, insumoId: r.insumoId, quantity: r.quantity })),
    insumosPorId,
  )

  const margem = product.price - custoReal.custoReal

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <Link href="/products" className="text-orange-500 text-lg">←</Link>
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-orange-500 text-lg hidden lg:inline">←</Link>
        <h1 className="text-xl font-bold dark:text-slate-100">{product.name}</h1>
      </div>

      {/* Preço, custo manual e custo real */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500">Preço</p>
          <p className="text-lg font-bold text-green-600">R$ {product.price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500">Custo manual</p>
          <p className="text-lg font-bold dark:text-slate-100">R$ {product.cost.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500">Custo real (receita)</p>
          <p className="text-lg font-bold dark:text-slate-100">R$ {custoReal.custoReal.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500">Margem real</p>
          <p className={`text-lg font-bold ${margem < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            R$ {margem.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Ficha técnica */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b dark:border-slate-700">
          <span className="font-semibold dark:text-slate-100">Ficha técnica</span>
        </div>
        {custoReal.itens.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500">
            Nenhum insumo na receita ainda.
          </p>
        ) : (
          custoReal.itens.map(item => {
            const recipeItem = receita.find(r => r.insumoId === item.insumoId)!
            return (
              <div key={item.insumoId} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
                <p className="text-sm dark:text-slate-200">
                  {item.nome} · {fmt(item.quantidade)} {item.unidade} · R$ {item.subtotal.toFixed(2)}
                </p>
                <form action={removerItemReceita.bind(null, recipeItem.id, id)}>
                  <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                    Remover
                  </button>
                </form>
              </div>
            )
          })
        )}
      </div>

      {/* Adicionar insumo à receita */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <p className="font-semibold dark:text-slate-100 text-sm mb-3">Adicionar insumo</p>
        <ReceitaForm
          productId={id}
          insumos={insumos.map(i => ({ id: i.id, name: i.name, unit: i.unit }))}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Tornar cada produto um link no `src/app/(protected)/products/page.tsx`**

Trocar o `import Link` já existe no arquivo. Substituir o bloco do `<li>` (a lista de produtos) por uma versão que envolve o conteúdo num `Link` para o detalhe. Substituir:

```tsx
        <ul className="space-y-3">
          {products.map(product => (
            <li
              key={product.id}
              className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4"
            >
              <div className="flex justify-between items-start">
                <span className="font-medium dark:text-slate-100">{product.name}</span>
                <span className="text-green-600 font-bold">
                  R$ {product.price.toFixed(2)}
                </span>
              </div>
              <span className="text-gray-400 dark:text-slate-500 text-sm">
                Custo: R$ {product.cost.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
```

por:

```tsx
        <ul className="space-y-3">
          {products.map(product => (
            <li key={product.id}>
              <Link
                href={`/products/${product.id}`}
                className="block bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4 hover:border-orange-300 dark:hover:border-orange-500/40 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <span className="font-medium dark:text-slate-100">{product.name}</span>
                  <span className="text-green-600 font-bold">
                    R$ {product.price.toFixed(2)}
                  </span>
                </div>
                <span className="text-gray-400 dark:text-slate-500 text-sm">
                  Custo: R$ {product.cost.toFixed(2)} · ficha técnica →
                </span>
              </Link>
            </li>
          ))}
        </ul>
```

- [ ] **Step 4: Verificar build e lint**

Run: `npm run build && npm run lint`
Expected: build conclui; lint sem erros. (Fallback sem banco: `npx tsc --noEmit && npm run lint`.)

- [ ] **Step 5: Commit**

```bash
git add "src/app/(protected)/products"
git commit -m "feat: add product detail page with ficha técnica and custo real" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Navegação e proteção da rota `/insumos`

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/proxy.ts`

**Interfaces:**
- Consumes: rota `/insumos` (Task 7).
- Produces: link "Insumos" na sidebar; `/insumos` protegido por auth.

- [ ] **Step 1: Adicionar o link na sidebar**

Em `src/components/Sidebar.tsx`, dentro de `<nav>`, adicionar o link **logo após** o de Estoque (mantendo a ordem Dashboard → Produtos → Estoque → Insumos → Gastos → Relatórios):

```tsx
        <Link href="/insumos" className={navClass('/insumos')}>
          Insumos
        </Link>
```

- [ ] **Step 2: Proteger a rota em `src/proxy.ts`**

Substituir o `matcher` para incluir `/insumos`:

```ts
export const config = {
  matcher: ['/dashboard/:path*', '/products/:path*', '/lancamento/:path*', '/gastos/:path*', '/relatorios/:path*', '/estoque/:path*', '/insumos/:path*'],
}
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/proxy.ts
git commit -m "feat: add Insumos link to sidebar and protect /insumos route" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Card "Insumos em falta" no dashboard

**Files:**
- Modify: `src/app/(protected)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `calcularEstoqueInsumos` (Task 3); `prisma.insumo.findMany`, `prisma.insumoEntry.findMany`, `prisma.recipeItem.findMany`, e o `todasVendas` já buscado na página.
- Produces: card de alerta listando insumos com status `baixo`/`negativo`.

- [ ] **Step 1: Importar `calcularEstoqueInsumos` no topo de `dashboard/page.tsx`**

Adicionar, junto aos imports existentes (logo abaixo de `import { calcularEstoque } from '@/lib/estoque'`):

```tsx
import { calcularEstoqueInsumos } from '@/lib/insumos'
```

- [ ] **Step 2: Buscar dados e calcular os insumos em alerta**

**Depois** do bloco que calcula `alertasEstoque` (logo antes do `return`), adicionar:

```tsx
  const [insumos, entradasInsumo, receitas] = await Promise.all([
    prisma.insumo.findMany({ where: { userId: session!.user.id } }),
    prisma.insumoEntry.findMany({ where: { userId: session!.user.id } }),
    prisma.recipeItem.findMany({ where: { userId: session!.user.id } }),
  ])

  const alertasInsumos = calcularEstoqueInsumos(
    insumos.map(i => ({ id: i.id, name: i.name, unit: i.unit, cost: i.cost, minStock: i.minStock })),
    entradasInsumo.map(e => ({ insumoId: e.insumoId, quantity: e.quantity })),
    receitas.map(r => ({ productId: r.productId, insumoId: r.insumoId, quantity: r.quantity })),
    todasVendas.map(s => ({ productId: s.productId, quantity: s.quantity })),
  ).filter(item => item.status !== 'ok')

  const fmtSaldo = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))
```

- [ ] **Step 3: Renderizar o card de alerta**

No JSX, inserir este bloco **logo após** o fechamento do bloco `{alertasEstoque.length > 0 && ( ... )}` e **antes** do bloco `{porDia.size > 0 && (...)}`:

```tsx
      {alertasInsumos.length > 0 && (
        <Link
          href="/insumos"
          className="block bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-500/40 rounded-2xl p-4 mb-6 shadow-sm"
        >
          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2">
            ⚠️ Insumos em falta ({alertasInsumos.length})
          </p>
          <div className="flex flex-col gap-1">
            {alertasInsumos.map(item => (
              <div key={item.insumoId} className="flex justify-between text-sm">
                <span className="dark:text-slate-200">{item.nome}</span>
                <span className={item.saldo < 0 ? 'text-red-500 font-semibold' : 'text-amber-600 dark:text-amber-400 font-semibold'}>
                  {fmtSaldo(item.saldo)} {item.unidade}
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
git commit -m "feat: show low insumo alert card on dashboard" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Documentação (README + CLAUDE.md) e verificação final

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: roadmap e docs atualizados.

- [ ] **Step 1: Adicionar a linha do Sprint 5 no roadmap do `README.md`**

Na tabela "## Roadmap", adicionar **abaixo** da linha do Sprint 4:

```markdown
| Sprint 5 | ✅ Concluído | Insumos e ficha técnica: cadastro de insumos com unidade e custo, estoque de insumos (entradas de compra, saldo = entradas − consumo derivado das vendas), receita insumo→produto na página do produto, custo real por produto e alerta de insumos em falta no dashboard |
```

- [ ] **Step 2: Atualizar `CLAUDE.md`**

(a) Na descrição de proteção de rotas (proxy), incluir `/insumos` na lista de rotas protegidas.

(b) No bloco "**Data model**", ajustar a linha de `Product` e adicionar as três entidades novas:

```markdown
- `Product` (name, price, cost, minStock) → `Sale[]` + `StockEntry[]` + `RecipeItem[]`
- `Insumo` — insumo/ingrediente: `name`, `unit` (un/g/kg/ml/L), `cost` (custo unitário, informativo), `minStock` (Float). Saldo derivado: `entradas (InsumoEntry) − consumo derivado das vendas via receita`.
- `InsumoEntry` — entradas de compra de insumo (só quantidade física, `Float`): `date`, `quantity`, `note?`. **Não carrega valor** (o dinheiro fica em `Expense`).
- `RecipeItem` — item da ficha técnica: liga `Product` a `Insumo` com `quantity` (consumo por unidade de produto). `@@unique([productId, insumoId])`.
```

(c) Em "**Route groups:**", adicionar:

```markdown
- `/insumos` — controle de estoque de insumos: saldo (entradas − consumo derivado via receita), status (ok/baixo/negativo), cadastro em `/insumos/new`, registro de entradas de compra e ajuste inline de mínimo e custo. Server Actions em [src/app/(protected)/insumos/actions.ts](<src/app/(protected)/insumos/actions.ts>): `criarInsumo`, `registrarEntradaInsumo`, `removerEntradaInsumo`, `definirMinimoInsumo`, `definirCustoInsumo`. Agregação pura em [src/lib/insumos.ts](src/lib/insumos.ts). Entrada de insumo é só física (sem valor); o dinheiro continua em Gastos.
- `/products/[id]` — detalhe do produto com **ficha técnica** (receita insumo→produto) e **custo real** derivado (`preço − custo real = margem real`, informativo, não altera `Product.cost` nem o relatório). Server Actions `adicionarItemReceita`, `removerItemReceita`.
```

(d) Na descrição de `src/lib`, mencionar o helper compartilhado: a regra de status de estoque (`negativo`/`baixo`/`ok`) vive em [src/lib/stockStatus.ts](src/lib/stockStatus.ts), usada por `estoque.ts` e `insumos.ts`.

- [ ] **Step 3: Rodar a suíte completa**

Run: `npm run test`
Expected: PASS — todos os testes: `stockStatus` (4), `insumos` lib (14), `insumos` actions (17), `receita` actions (9), além dos anteriores (estoque lib 10, estoque actions 12, etc.), sem regressões.

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document Sprint 5 insumos and ficha técnica" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Verificação final (após todas as tasks)

- [ ] `npm run test` → todos verdes (novos: `stockStatus` 4, `insumos` lib 14, `insumos` actions 17, `receita` actions 9; sem regressões nos anteriores).
- [ ] `npm run lint` → sem erros.
- [ ] `npm run build` → build limpo (requer `npx prisma generate`; `migrate dev` requer banco).
- [ ] Conferir manualmente: cadastrar insumo em `/insumos/new`; registrar entrada e ver saldo; ajustar mínimo e custo inline; montar ficha técnica em `/products/[id]`, ver custo real/margem e o saldo do insumo cair após vendas; card "Insumos em falta" aparecer no dashboard quando um insumo fica abaixo do mínimo ou negativo.

## Out of Scope (Sprint 6+)

- Baixa/desperdício manual de insumo (perda, validade).
- Conversão de unidades (comprar em kg, receita em g).
- Valor financeiro da compra de insumo entrando no lucro real (continua em Gastos).
- Custo real substituindo `Product.cost` ou entrando no relatório de lucro real.
- Histórico/relatório de movimentação de insumos e exportação (PDF/CSV).
- Bloquear o lançamento de vendas por falta de insumo.
