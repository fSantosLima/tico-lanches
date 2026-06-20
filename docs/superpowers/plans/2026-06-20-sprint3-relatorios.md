# Sprint 3 — Relatório de Lucro Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/relatorios` page that crosses faturamento (`Sale`) with real expenses (`Expense`) to show lucro real do período, with a Resumo tab (KPIs + gastos por categoria) and a Gráficos tab (rosca + linha por semana).

**Architecture:** A Server Component page reads the period from the URL (`?de&ate&tab`), queries Prisma for `Sale` + `Expense` scoped to the user, and feeds a pure aggregation function `calcularRelatorio` (in `src/lib/`). Period parsing/presets live in another pure module `src/lib/periodo.ts`. Charts are client components using Recharts. All business logic is in pure, fully-tested functions — no DB needed in tests (Prisma is globally mocked).

**Tech Stack:** Next.js 16 (App Router, Server Components), TypeScript, Tailwind, Prisma 7, Recharts (new), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-20-relatorios-lucro-real-design.md`

---

## File Structure

**Create:**
- `src/lib/periodo.ts` — `resolverPeriodo` (URL → intervalo) + `intervaloPreset` (preset → intervalo). Pure.
- `src/lib/relatorio.ts` — `calcularRelatorio` (sales+expenses → agregados). Pure.
- `src/__tests__/lib/periodo.test.ts` — testes de período/presets.
- `src/__tests__/lib/relatorio.test.ts` — testes exaustivos de agregação.
- `src/app/(protected)/relatorios/page.tsx` — Server Component (orquestra query + render).
- `src/app/(protected)/relatorios/FiltroPeriodo.tsx` — client: presets + De/Até.
- `src/app/(protected)/relatorios/Tabs.tsx` — abas Resumo/Gráficos (links).
- `src/app/(protected)/relatorios/GraficoRosca.tsx` — client: Recharts donut.
- `src/app/(protected)/relatorios/GraficoLinha.tsx` — client: Recharts linha.

**Modify:**
- `src/proxy.ts` — adicionar `/relatorios` ao matcher.
- `src/components/Sidebar.tsx` — adicionar link "Relatórios".
- `package.json` — dependência `recharts`.
- `README.md` + `CLAUDE.md` — documentar a feature e o roadmap.

**Note on dates/timezone:** `Sale.date` e `Expense.date` são `@db.Date` (meia-noite UTC). Para o agrupamento semanal ser determinístico independente do fuso da máquina, `calcularRelatorio` e `periodo.ts` fazem toda a aritmética de data com componentes **UTC** (`getUTCFullYear/Month/Date/Day`, `Date.UTC`). Isso refina a spec (que citou `date-fns`): o resultado é o mesmo (semanas começando na segunda), mas sem dependência de fuso. Não usar `date-fns` para o agrupamento.

---

## Task 1: Adicionar dependência Recharts

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Instalar recharts**

Run:
```bash
npm install recharts
```
Expected: `package.json` passa a listar `recharts` em `dependencies`; instala sem erro. Se houver conflito de peer dep com React 19, rodar `npm install recharts --legacy-peer-deps`.

- [ ] **Step 2: Confirmar que o projeto ainda compila**

Run:
```bash
npm run build
```
Expected: build conclui sem erros (recharts apenas instalado, ainda não importado).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add recharts dependency for relatórios charts" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `periodo.ts` — resolução de período e presets (TDD)

**Files:**
- Create: `src/lib/periodo.ts`
- Test: `src/__tests__/lib/periodo.test.ts`

Referência de fuso para os testes: `hoje = new Date(Date.UTC(2026, 5, 20))` é **sábado, 20/06/2026**. A segunda-feira dessa semana é **15/06/2026**.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/__tests__/lib/periodo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resolverPeriodo, intervaloPreset } from '@/lib/periodo'

const HOJE = new Date(Date.UTC(2026, 5, 20)) // sábado 20/06/2026

describe('intervaloPreset', () => {
  it('"semana" → segunda da semana até hoje', () => {
    expect(intervaloPreset('semana', HOJE)).toEqual({ de: '2026-06-15', ate: '2026-06-20' })
  })

  it('"mes" → primeiro dia do mês até hoje', () => {
    expect(intervaloPreset('mes', HOJE)).toEqual({ de: '2026-06-01', ate: '2026-06-20' })
  })

  it('"mes-passado" → primeiro ao último dia do mês anterior', () => {
    expect(intervaloPreset('mes-passado', HOJE)).toEqual({ de: '2026-05-01', ate: '2026-05-31' })
  })

  it('"mes-passado" lida com virada de ano (janeiro → dezembro anterior)', () => {
    const jan = new Date(Date.UTC(2026, 0, 10)) // 10/01/2026
    expect(intervaloPreset('mes-passado', jan)).toEqual({ de: '2025-12-01', ate: '2025-12-31' })
  })
})

describe('resolverPeriodo', () => {
  it('sem params → este mês (default)', () => {
    expect(resolverPeriodo({}, HOJE)).toEqual({ de: '2026-06-01', ate: '2026-06-20' })
  })

  it('de e ate válidos → usados como intervalo', () => {
    expect(resolverPeriodo({ de: '2026-06-03', ate: '2026-06-10' }, HOJE))
      .toEqual({ de: '2026-06-03', ate: '2026-06-10' })
  })

  it('de > ate (invertido) → troca os dois', () => {
    expect(resolverPeriodo({ de: '2026-06-10', ate: '2026-06-03' }, HOJE))
      .toEqual({ de: '2026-06-03', ate: '2026-06-10' })
  })

  it('data malformada → cai no default sem quebrar', () => {
    expect(resolverPeriodo({ de: 'abc', ate: '2026-06-10' }, HOJE))
      .toEqual({ de: '2026-06-01', ate: '2026-06-20' })
  })

  it('apenas um param presente → cai no default', () => {
    expect(resolverPeriodo({ de: '2026-06-03' }, HOJE))
      .toEqual({ de: '2026-06-01', ate: '2026-06-20' })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/lib/periodo.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/periodo"` (módulo ainda não existe).

- [ ] **Step 3: Implementar `src/lib/periodo.ts`**

```ts
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type Preset = 'semana' | 'mes' | 'mes-passado'

export function intervaloPreset(preset: Preset, hoje: Date): { de: string; ate: string } {
  const y = hoje.getUTCFullYear()
  const m = hoje.getUTCMonth()
  const d = hoje.getUTCDate()
  const ate = iso(new Date(Date.UTC(y, m, d)))

  if (preset === 'semana') {
    const dow = (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7 // 0 = segunda
    return { de: iso(new Date(Date.UTC(y, m, d - dow))), ate }
  }
  if (preset === 'mes') {
    return { de: iso(new Date(Date.UTC(y, m, 1))), ate }
  }
  // mes-passado
  const primeiro = new Date(Date.UTC(y, m - 1, 1))
  const ultimo = new Date(Date.UTC(y, m, 0)) // dia 0 do mês atual = último dia do mês anterior
  return { de: iso(primeiro), ate: iso(ultimo) }
}

export function resolverPeriodo(
  params: { de?: string; ate?: string },
  hoje: Date,
): { de: string; ate: string } {
  const deOk = !!params.de && ISO_RE.test(params.de)
  const ateOk = !!params.ate && ISO_RE.test(params.ate)

  if (deOk && ateOk) {
    let de = params.de!
    let ate = params.ate!
    if (de > ate) [de, ate] = [ate, de] // strings ISO comparam lexicograficamente
    return { de, ate }
  }
  return intervaloPreset('mes', hoje)
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/lib/periodo.test.ts`
Expected: PASS — todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/periodo.ts src/__tests__/lib/periodo.test.ts
git commit -m "feat: add periodo helpers (resolverPeriodo, intervaloPreset)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `relatorio.ts` — agregação do relatório (TDD, cobertura exaustiva)

**Files:**
- Create: `src/lib/relatorio.ts`
- Test: `src/__tests__/lib/relatorio.test.ts`

Fixture de semanas: `inicio = Date.UTC(2026,5,1)` (segunda 01/06/2026) e `fim = Date.UTC(2026,5,28)` (domingo 28/06/2026) cobrem exatamente 4 semanas: 01/06, 08/06, 15/06, 22/06.

- [ ] **Step 1: Escrever o teste que falha**

Create `src/__tests__/lib/relatorio.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularRelatorio } from '@/lib/relatorio'

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d))
const INICIO = utc(2026, 5, 1)  // seg 01/06
const FIM = utc(2026, 5, 28)    // dom 28/06

function base(over: Partial<Parameters<typeof calcularRelatorio>[0]> = {}) {
  return { sales: [], expenses: [], inicio: INICIO, fim: FIM, ...over }
}

describe('calcularRelatorio — faturamento e gastos', () => {
  it('listas vazias → tudo zero e arrays vazios', () => {
    const r = calcularRelatorio(base())
    expect(r.faturamento).toBe(0)
    expect(r.gastos).toBe(0)
    expect(r.lucroReal).toBe(0)
    expect(r.margem).toBe(0)
    expect(r.gastosPorCategoria).toEqual([])
  })

  it('só vendas → gastos 0, lucroReal = faturamento, margem 1', () => {
    const r = calcularRelatorio(base({
      sales: [{ quantity: 10, unitPrice: 5, date: utc(2026, 5, 3) }],
    }))
    expect(r.faturamento).toBeCloseTo(50)
    expect(r.gastos).toBe(0)
    expect(r.lucroReal).toBeCloseTo(50)
    expect(r.margem).toBeCloseTo(1)
  })

  it('só gastos → faturamento 0, lucroReal negativo, margem 0', () => {
    const r = calcularRelatorio(base({
      expenses: [{ value: 30, category: 'Ingredientes', date: utc(2026, 5, 3) }],
    }))
    expect(r.faturamento).toBe(0)
    expect(r.gastos).toBeCloseTo(30)
    expect(r.lucroReal).toBeCloseTo(-30)
    expect(r.margem).toBe(0)
  })

  it('faturamento soma quantity * unitPrice de múltiplos produtos', () => {
    const r = calcularRelatorio(base({
      sales: [
        { quantity: 10, unitPrice: 18, date: utc(2026, 5, 2) },
        { quantity: 5, unitPrice: 6, date: utc(2026, 5, 2) },
      ],
    }))
    expect(r.faturamento).toBeCloseTo(210)
  })

  it('venda com quantity 0 não altera faturamento', () => {
    const r = calcularRelatorio(base({
      sales: [{ quantity: 0, unitPrice: 18, date: utc(2026, 5, 2) }],
    }))
    expect(r.faturamento).toBe(0)
  })

  it('soma valores decimais (centavos) sem erro relevante', () => {
    const r = calcularRelatorio(base({
      sales: [{ quantity: 3, unitPrice: 15.99, date: utc(2026, 5, 2) }],
      expenses: [{ value: 10.10, category: 'Outros', date: utc(2026, 5, 2) }],
    }))
    expect(r.faturamento).toBeCloseTo(47.97)
    expect(r.gastos).toBeCloseTo(10.10)
    expect(r.lucroReal).toBeCloseTo(37.87)
  })
})

describe('calcularRelatorio — lucro real', () => {
  it('lucro real positivo', () => {
    const r = calcularRelatorio(base({
      sales: [{ quantity: 10, unitPrice: 10, date: utc(2026, 5, 2) }],
      expenses: [{ value: 30, category: 'Outros', date: utc(2026, 5, 2) }],
    }))
    expect(r.lucroReal).toBeCloseTo(70)
  })

  it('lucro real negativo (não clampa em zero)', () => {
    const r = calcularRelatorio(base({
      sales: [{ quantity: 1, unitPrice: 10, date: utc(2026, 5, 2) }],
      expenses: [{ value: 30, category: 'Outros', date: utc(2026, 5, 2) }],
    }))
    expect(r.lucroReal).toBeCloseTo(-20)
  })

  it('lucro real exatamente zero (faturamento = gastos)', () => {
    const r = calcularRelatorio(base({
      sales: [{ quantity: 1, unitPrice: 30, date: utc(2026, 5, 2) }],
      expenses: [{ value: 30, category: 'Outros', date: utc(2026, 5, 2) }],
    }))
    expect(r.lucroReal).toBe(0)
  })
})

describe('calcularRelatorio — margem (divisão por zero)', () => {
  it('faturamento 0 e gastos > 0 → margem 0', () => {
    const r = calcularRelatorio(base({
      expenses: [{ value: 30, category: 'Outros', date: utc(2026, 5, 2) }],
    }))
    expect(r.margem).toBe(0)
  })

  it('faturamento 0 e gastos 0 → margem 0', () => {
    expect(calcularRelatorio(base()).margem).toBe(0)
  })

  it('margem fracionária correta', () => {
    const r = calcularRelatorio(base({
      sales: [{ quantity: 1, unitPrice: 4200, date: utc(2026, 5, 2) }],
      expenses: [{ value: 1350, category: 'Outros', date: utc(2026, 5, 2) }],
    }))
    expect(r.margem).toBeCloseTo(2850 / 4200, 5)
  })

  it('margem negativa quando lucroReal < 0', () => {
    const r = calcularRelatorio(base({
      sales: [{ quantity: 1, unitPrice: 10, date: utc(2026, 5, 2) }],
      expenses: [{ value: 30, category: 'Outros', date: utc(2026, 5, 2) }],
    }))
    expect(r.margem).toBeCloseTo(-2)
  })
})

describe('calcularRelatorio — gastos por categoria', () => {
  it('agrupa e soma por categoria', () => {
    const r = calcularRelatorio(base({
      expenses: [
        { value: 100, category: 'Ingredientes', date: utc(2026, 5, 2) },
        { value: 50, category: 'Descartáveis', date: utc(2026, 5, 2) },
      ],
    }))
    expect(r.gastosPorCategoria).toContainEqual({ categoria: 'Ingredientes', total: 100 })
    expect(r.gastosPorCategoria).toContainEqual({ categoria: 'Descartáveis', total: 50 })
  })

  it('mesma categoria em datas diferentes soma numa entrada', () => {
    const r = calcularRelatorio(base({
      expenses: [
        { value: 100, category: 'Ingredientes', date: utc(2026, 5, 2) },
        { value: 80, category: 'Ingredientes', date: utc(2026, 5, 10) },
      ],
    }))
    expect(r.gastosPorCategoria).toEqual([{ categoria: 'Ingredientes', total: 180 }])
  })

  it('ordena por total decrescente', () => {
    const r = calcularRelatorio(base({
      expenses: [
        { value: 50, category: 'Descartáveis', date: utc(2026, 5, 2) },
        { value: 300, category: 'Ingredientes', date: utc(2026, 5, 2) },
        { value: 100, category: 'Outros', date: utc(2026, 5, 2) },
      ],
    }))
    expect(r.gastosPorCategoria.map(c => c.categoria)).toEqual(['Ingredientes', 'Outros', 'Descartáveis'])
  })

  it('categoria sem gasto não aparece', () => {
    const r = calcularRelatorio(base({
      expenses: [{ value: 50, category: 'Outros', date: utc(2026, 5, 2) }],
    }))
    expect(r.gastosPorCategoria.map(c => c.categoria)).toEqual(['Outros'])
  })
})

describe('calcularRelatorio — lucro por semana', () => {
  it('uma única semana quando tudo cabe nela', () => {
    const r = calcularRelatorio(base({
      inicio: utc(2026, 5, 1), fim: utc(2026, 5, 7),
      sales: [{ quantity: 2, unitPrice: 10, date: utc(2026, 5, 3) }],
    }))
    expect(r.lucroPorSemana).toHaveLength(1)
    expect(r.lucroPorSemana[0].faturamento).toBeCloseTo(20)
  })

  it('uma entrada por semana, em ordem crescente, incl. semanas vazias', () => {
    const r = calcularRelatorio(base({
      sales: [
        { quantity: 10, unitPrice: 5, date: utc(2026, 5, 3) },  // W1 (01/06)
        { quantity: 4, unitPrice: 5, date: utc(2026, 5, 10) },  // W2 (08/06)
      ],
      expenses: [
        { value: 30, category: 'Outros', date: utc(2026, 5, 3) },  // W1
        { value: 15, category: 'Outros', date: utc(2026, 5, 22) }, // W4 (22/06)
      ],
    }))
    expect(r.lucroPorSemana).toHaveLength(4)
    const inicios = r.lucroPorSemana.map(w => w.semanaInicio.toISOString().slice(0, 10))
    expect(inicios).toEqual(['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22'])
    expect(r.lucroPorSemana[0]).toMatchObject({ faturamento: 50, gastos: 30, lucroReal: 20 }) // W1
    expect(r.lucroPorSemana[1]).toMatchObject({ faturamento: 20, gastos: 0, lucroReal: 20 })  // W2
    expect(r.lucroPorSemana[2]).toMatchObject({ faturamento: 0, gastos: 0, lucroReal: 0 })    // W3 vazia
    expect(r.lucroPorSemana[3]).toMatchObject({ faturamento: 0, gastos: 15, lucroReal: -15 }) // W4
  })

  it('semanaInicio é sempre uma segunda-feira', () => {
    const r = calcularRelatorio(base())
    for (const w of r.lucroPorSemana) {
      expect(w.semanaInicio.getUTCDay()).toBe(1) // 1 = segunda
    }
  })

  it('limite de semana: domingo e segunda caem em semanas distintas', () => {
    const r = calcularRelatorio(base({
      inicio: utc(2026, 5, 1), fim: utc(2026, 5, 14),
      sales: [
        { quantity: 1, unitPrice: 10, date: utc(2026, 5, 7) },  // domingo → W1
        { quantity: 1, unitPrice: 20, date: utc(2026, 5, 8) },  // segunda → W2
      ],
    }))
    expect(r.lucroPorSemana[0].faturamento).toBeCloseTo(10) // W1 (01/06)
    expect(r.lucroPorSemana[1].faturamento).toBeCloseTo(20) // W2 (08/06)
  })

  it('soma dos lucros semanais == lucroReal total', () => {
    const r = calcularRelatorio(base({
      sales: [
        { quantity: 10, unitPrice: 5, date: utc(2026, 5, 3) },
        { quantity: 4, unitPrice: 5, date: utc(2026, 5, 10) },
      ],
      expenses: [
        { value: 30, category: 'Outros', date: utc(2026, 5, 3) },
        { value: 15, category: 'Outros', date: utc(2026, 5, 22) },
      ],
    }))
    const somaSemanal = r.lucroPorSemana.reduce((s, w) => s + w.lucroReal, 0)
    expect(somaSemanal).toBeCloseTo(r.lucroReal)
  })

  it('intervalo que cruza virada de mês gera semanas contíguas', () => {
    const r = calcularRelatorio(base({
      inicio: utc(2026, 5, 29), fim: utc(2026, 6, 12), // 29/06 a 12/07
    }))
    const inicios = r.lucroPorSemana.map(w => w.semanaInicio.toISOString().slice(0, 10))
    expect(inicios).toEqual(['2026-06-29', '2026-07-06'])
  })

  it('inicio e fim no mesmo dia → uma única semana', () => {
    const r = calcularRelatorio(base({
      inicio: utc(2026, 5, 3), fim: utc(2026, 5, 3),
      sales: [{ quantity: 2, unitPrice: 10, date: utc(2026, 5, 3) }],
    }))
    expect(r.lucroPorSemana).toHaveLength(1)
    expect(r.lucroPorSemana[0].faturamento).toBeCloseTo(20)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/lib/relatorio.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/relatorio"`.

- [ ] **Step 3: Implementar `src/lib/relatorio.ts`**

```ts
export interface RelatorioSale {
  quantity: number
  unitPrice: number
  date: Date
}

export interface RelatorioExpense {
  value: number
  category: string
  date: Date
}

export interface RelatorioInput {
  sales: RelatorioSale[]
  expenses: RelatorioExpense[]
  inicio: Date
  fim: Date
}

export interface GastoCategoria {
  categoria: string
  total: number
}

export interface LucroSemana {
  semanaInicio: Date // segunda-feira (meia-noite UTC) da semana
  faturamento: number
  gastos: number
  lucroReal: number
}

export interface Relatorio {
  faturamento: number
  gastos: number
  lucroReal: number
  margem: number
  gastosPorCategoria: GastoCategoria[]
  lucroPorSemana: LucroSemana[]
}

// Segunda-feira (UTC) da semana de `d`, à meia-noite UTC.
function inicioSemanaUTC(d: Date): Date {
  const dow = (d.getUTCDay() + 6) % 7 // 0 = segunda
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow))
}

function chave(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function calcularRelatorio(input: RelatorioInput): Relatorio {
  const { sales, expenses, inicio, fim } = input

  const faturamento = sales.reduce((s, v) => s + v.quantity * v.unitPrice, 0)
  const gastos = expenses.reduce((s, e) => s + e.value, 0)
  const lucroReal = faturamento - gastos
  const margem = faturamento === 0 ? 0 : lucroReal / faturamento

  // Gastos por categoria (ordenado desc).
  const catMap = new Map<string, number>()
  for (const e of expenses) {
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.value)
  }
  const gastosPorCategoria = [...catMap.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)

  // Gera todas as semanas do intervalo [inicio, fim], inclusive vazias.
  const semanas = new Map<string, LucroSemana>()
  let cursor = inicioSemanaUTC(inicio)
  const ultimaSemana = inicioSemanaUTC(fim)
  while (cursor.getTime() <= ultimaSemana.getTime()) {
    semanas.set(chave(cursor), {
      semanaInicio: new Date(cursor.getTime()),
      faturamento: 0,
      gastos: 0,
      lucroReal: 0,
    })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 7))
  }

  for (const v of sales) {
    const w = semanas.get(chave(inicioSemanaUTC(v.date)))
    if (w) w.faturamento += v.quantity * v.unitPrice
  }
  for (const e of expenses) {
    const w = semanas.get(chave(inicioSemanaUTC(e.date)))
    if (w) w.gastos += e.value
  }
  for (const w of semanas.values()) {
    w.lucroReal = w.faturamento - w.gastos
  }

  const lucroPorSemana = [...semanas.values()].sort(
    (a, b) => a.semanaInicio.getTime() - b.semanaInicio.getTime(),
  )

  return { faturamento, gastos, lucroReal, margem, gastosPorCategoria, lucroPorSemana }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/lib/relatorio.test.ts`
Expected: PASS — todos verdes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/relatorio.ts src/__tests__/lib/relatorio.test.ts
git commit -m "feat: add calcularRelatorio aggregation with exhaustive tests" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Componentes de gráfico (Recharts, client)

Recharts não é testado em unidade (segue o padrão do projeto — só `lib/` e actions têm testes). Verificação é via `npm run build` + `npm run lint`.

**Files:**
- Create: `src/app/(protected)/relatorios/GraficoRosca.tsx`
- Create: `src/app/(protected)/relatorios/GraficoLinha.tsx`

- [ ] **Step 1: Criar `GraficoRosca.tsx`**

```tsx
'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const CORES = ['#38bdf8', '#f87171', '#facc15', '#a78bfa', '#34d399', '#fb923c']

interface Props {
  dados: { categoria: string; total: number }[]
}

export function GraficoRosca({ dados }: Props) {
  if (dados.length === 0) {
    return <p className="text-center text-gray-400 dark:text-slate-500 py-8">Nenhum gasto no período.</p>
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
        Gastos por categoria
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={dados} dataKey="total" nameKey="categoria" innerRadius={60} outerRadius={90} paddingAngle={2}>
            {dados.map((_, i) => (
              <Cell key={i} fill={CORES[i % CORES.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 2: Criar `GraficoLinha.tsx`**

```tsx
'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

interface Props {
  dados: { semana: string; lucroReal: number }[]
}

export function GraficoLinha({ dados }: Props) {
  if (dados.length === 0) {
    return <p className="text-center text-gray-400 dark:text-slate-500 py-8">Sem movimento neste período.</p>
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
        Lucro real por semana
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#33415544" />
          <XAxis dataKey="semana" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Line type="monotone" dataKey="lucroReal" stroke="#22c55e" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

- [ ] **Step 3: Confirmar que lint e build passam**

Run: `npm run lint && npm run build`
Expected: sem erros (componentes ainda não importados em página, mas devem compilar isoladamente).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/relatorios/GraficoRosca.tsx" "src/app/(protected)/relatorios/GraficoLinha.tsx"
git commit -m "feat: add Recharts donut and line chart components" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Abas e filtro de período (client/UI)

**Files:**
- Create: `src/app/(protected)/relatorios/Tabs.tsx`
- Create: `src/app/(protected)/relatorios/FiltroPeriodo.tsx`

- [ ] **Step 1: Criar `Tabs.tsx`** (componente de servidor — só links, sem hooks)

```tsx
import Link from 'next/link'

interface Props {
  tab: 'resumo' | 'graficos'
  de: string
  ate: string
}

export function Tabs({ tab, de, ate }: Props) {
  function cls(t: string) {
    return t === tab
      ? 'px-4 py-2 text-sm font-medium border-b-2 border-orange-500 text-orange-500'
      : 'px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
  }
  return (
    <div className="flex border-b dark:border-slate-700">
      <Link href={`/relatorios?de=${de}&ate=${ate}&tab=resumo`} className={cls('resumo')}>Resumo</Link>
      <Link href={`/relatorios?de=${de}&ate=${ate}&tab=graficos`} className={cls('graficos')}>Gráficos</Link>
    </div>
  )
}
```

- [ ] **Step 2: Criar `FiltroPeriodo.tsx`** (client — presets + De/Até)

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { DateInput } from '@/components/DateInput'
import { intervaloPreset, type Preset } from '@/lib/periodo'

interface Props {
  de: string
  ate: string
  tab: 'resumo' | 'graficos'
  max: string
}

export function FiltroPeriodo({ de, ate, tab, max }: Props) {
  const router = useRouter()

  function aplicar(novoDe: string, novoAte: string) {
    router.push(`/relatorios?de=${novoDe}&ate=${novoAte}&tab=${tab}`)
  }

  function preset(p: Preset) {
    const intervalo = intervaloPreset(p, new Date())
    aplicar(intervalo.de, intervalo.ate)
  }

  const presetBtn = 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => preset('semana')} className={presetBtn}>Esta semana</button>
        <button type="button" onClick={() => preset('mes')} className={presetBtn}>Este mês</button>
        <button type="button" onClick={() => preset('mes-passado')} className={presetBtn}>Mês passado</button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          aplicar(String(fd.get('de')), String(fd.get('ate')))
        }}
        className="flex flex-wrap gap-3 items-end"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">De</label>
          <DateInput name="de" defaultValue={de} max={max} className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Até</label>
          <DateInput name="ate" defaultValue={ate} max={max} className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Filtrar</button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Confirmar lint/build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(protected)/relatorios/Tabs.tsx" "src/app/(protected)/relatorios/FiltroPeriodo.tsx"
git commit -m "feat: add Tabs and FiltroPeriodo for relatórios" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Página `/relatorios` (Server Component)

**Files:**
- Create: `src/app/(protected)/relatorios/page.tsx`

- [ ] **Step 1: Criar `page.tsx`**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolverPeriodo } from '@/lib/periodo'
import { calcularRelatorio } from '@/lib/relatorio'
import { FiltroPeriodo } from './FiltroPeriodo'
import { Tabs } from './Tabs'
import { GraficoRosca } from './GraficoRosca'
import { GraficoLinha } from './GraficoLinha'

interface Props {
  searchParams: Promise<{ de?: string; ate?: string; tab?: string }>
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

export default async function RelatoriosPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  const { de, ate, tab } = await searchParams

  const periodo = resolverPeriodo({ de, ate }, new Date())
  const tabAtiva: 'resumo' | 'graficos' = tab === 'graficos' ? 'graficos' : 'resumo'

  const inicio = new Date(periodo.de)
  const fim = new Date(periodo.ate)

  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { userId: session!.user.id, date: { gte: inicio, lte: fim } },
      select: { quantity: true, unitPrice: true, date: true },
    }),
    prisma.expense.findMany({
      where: { userId: session!.user.id, date: { gte: inicio, lte: fim } },
      select: { value: true, category: true, date: true },
    }),
  ])

  const r = calcularRelatorio({ sales, expenses, inicio, fim })

  const semanas = r.lucroPorSemana.map(w => ({
    semana: w.semanaInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
    lucroReal: Number(w.lucroReal.toFixed(2)),
  }))

  const fmt = (n: number) => `R$ ${n.toFixed(2)}`
  const semMovimento = r.faturamento === 0 && r.gastos === 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <h1 className="text-xl font-bold dark:text-slate-100 mb-4">Relatórios</h1>

      <FiltroPeriodo de={periodo.de} ate={periodo.ate} tab={tabAtiva} max={hojeIso()} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
        <Kpi label="Faturamento" value={fmt(r.faturamento)} />
        <Kpi label="Gastos" value={fmt(r.gastos)} />
        <Kpi label="Lucro real" value={fmt(r.lucroReal)} highlight />
        <Kpi label="Margem" value={`${(r.margem * 100).toFixed(0)}%`} />
      </div>

      <Tabs tab={tabAtiva} de={periodo.de} ate={periodo.ate} />

      {semMovimento ? (
        <p className="text-center text-gray-400 dark:text-slate-500 py-8">Sem movimento neste período.</p>
      ) : tabAtiva === 'resumo' ? (
        <GastosCategoria itens={r.gastosPorCategoria} />
      ) : (
        <div className="flex flex-col gap-6 mt-4">
          <GraficoRosca dados={r.gastosPorCategoria} />
          <GraficoLinha dados={semanas} />
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-green-600' : 'dark:text-slate-100'}`}>{value}</p>
    </div>
  )
}

function GastosCategoria({ itens }: { itens: { categoria: string; total: number }[] }) {
  if (itens.length === 0) {
    return <p className="text-center text-gray-400 dark:text-slate-500 py-8">Nenhum gasto no período.</p>
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mt-4">
      {itens.map(i => (
        <div key={i.categoria} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
          <span className="dark:text-slate-200">{i.categoria}</span>
          <span className="font-bold text-green-600">R$ {i.total.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Confirmar lint/build**

Run: `npm run lint && npm run build`
Expected: build conclui; rota `/relatorios` aparece na listagem de rotas do Next.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/relatorios/page.tsx"
git commit -m "feat: add /relatorios page wiring period, KPIs, tabs and charts" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Proteção de rota + link na Sidebar

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Adicionar `/relatorios` ao matcher do proxy**

Em `src/proxy.ts`, trocar a linha do `matcher` por:

```ts
  matcher: ['/dashboard/:path*', '/products/:path*', '/lancamento/:path*', '/gastos/:path*', '/relatorios/:path*'],
```

- [ ] **Step 2: Adicionar o link "Relatórios" na Sidebar**

Em `src/components/Sidebar.tsx`, dentro de `<nav>`, logo após o `<Link>` de Gastos, adicionar:

```tsx
        <Link href="/relatorios" className={navClass('/relatorios')}>
          Relatórios
        </Link>
```

- [ ] **Step 3: Confirmar lint/build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/proxy.ts src/components/Sidebar.tsx
git commit -m "feat: protect /relatorios route and add sidebar link" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Documentação (README + CLAUDE.md)

**Files:**
- Modify: `README.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Atualizar o Roadmap no README**

Em `README.md`, na tabela de Roadmap, adicionar a linha do Sprint 3 abaixo do Sprint 2:

```markdown
| Sprint 3 | ✅ Concluído | Relatório de lucro real em `/relatorios`: cruza faturamento × gastos reais por período (presets + intervalo livre), com aba Resumo (KPIs + gastos por categoria) e aba Gráficos (rosca + linha por semana, Recharts) |
```

Adicionar `recharts` à tabela de Tech Stack:

```markdown
| Gráficos | Recharts |
```

- [ ] **Step 2: Documentar a rota em CLAUDE.md**

Em `CLAUDE.md`, na seção **Route groups**, adicionar após a linha de `/products`:

```markdown
- `/relatorios` — period report crossing revenue (`Sale`) with real expenses (`Expense`): KPIs (faturamento, gastos, lucro real, margem), gastos por categoria, and charts (donut + weekly line via Recharts). Period from URL (`?de&ate&tab`); pure aggregation in [src/lib/relatorio.ts](src/lib/relatorio.ts), period parsing in [src/lib/periodo.ts](src/lib/periodo.ts). **Lucro real = faturamento − gastos reais** (does not subtract product `unitCost`, to avoid double counting). Week math uses UTC components (Monday-start), not date-fns, for timezone determinism.
```

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document Sprint 3 relatórios feature and roadmap" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Verificação final

- [ ] **Step 1: Rodar a suíte completa de testes**

Run: `npm test`
Expected: todos os arquivos passam, incluindo os novos `periodo.test.ts` e `relatorio.test.ts` (contagem total sobe ~26 testes).

- [ ] **Step 2: Lint + build de produção**

Run: `npm run lint && npm run build`
Expected: zero erros; a rota `/relatorios` listada no output do build.

- [ ] **Step 3: Smoke test manual (opcional, requer banco)**

Run: `npm run dev`, logar, abrir `/relatorios`. Verificar: presets trocam o período; alternar abas Resumo/Gráficos; gráficos renderizam; estado "Sem movimento" quando o período não tem dados.

---

## Self-Review (executado pelo autor do plano)

**1. Cobertura da spec:**
- Período presets + intervalo livre → Task 2 (`intervaloPreset`/`resolverPeriodo`) + Task 5 (`FiltroPeriodo`). ✅
- Lucro real = faturamento − gastos (sem dupla contagem) → Task 3 (`calcularRelatorio`), sem uso de `unitCost`. ✅
- Rota `/relatorios` + sidebar + proxy → Tasks 6 e 7. ✅
- Aba Resumo (KPIs + gastos por categoria) → Task 6. ✅
- Aba Gráficos rosca + linha por semana com Recharts → Tasks 1, 4, 6. ✅
- Agrupamento por semana → Task 3 (`inicioSemanaUTC`). ✅
- Cobertura máxima de testes (35 cenários da spec) → Task 3 cobre faturamento/gastos/lucro/margem/categoria/semana; Task 2 cobre os cenários 31-35 de `resolverPeriodo` + presets. ✅
- Sem migration → confirmado, nenhuma task toca o schema. ✅

**2. Placeholders:** nenhum "TBD/TODO"; todos os steps têm código/comandos reais.

**3. Consistência de tipos:** `calcularRelatorio` recebe `{ sales, expenses, inicio, fim }` e devolve `{ faturamento, gastos, lucroReal, margem, gastosPorCategoria, lucroPorSemana }`; a página consome exatamente esses campos. `intervaloPreset(preset, hoje)`/`resolverPeriodo({de,ate}, hoje)` retornam `{ de, ate }`, usados igual no `FiltroPeriodo` e na página. Props dos gráficos (`dados`) batem com o que a página passa.
