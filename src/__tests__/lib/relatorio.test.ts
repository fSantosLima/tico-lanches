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
    // O intervalo padrão (01/06–28/06) tem 4 semanas, todas zeradas.
    expect(r.lucroPorSemana).toHaveLength(4)
    expect(r.lucroPorSemana.every(w => w.faturamento === 0 && w.gastos === 0 && w.lucroReal === 0)).toBe(true)
  })

  it('ignora itens fora de [inicio, fim] (função auto-contida)', () => {
    const r = calcularRelatorio(base({
      sales: [
        { quantity: 1, unitPrice: 100, date: utc(2026, 5, 15) }, // dentro
        { quantity: 1, unitPrice: 999, date: utc(2026, 4, 31) }, // antes do início
        { quantity: 1, unitPrice: 999, date: utc(2026, 6, 1) },  // depois do fim
      ],
      expenses: [{ value: 999, category: 'Outros', date: utc(2026, 6, 1) }], // fora
    }))
    expect(r.faturamento).toBeCloseTo(100)
    expect(r.gastos).toBe(0)
    const somaSemanal = r.lucroPorSemana.reduce((s, w) => s + w.lucroReal, 0)
    expect(somaSemanal).toBeCloseTo(r.lucroReal)
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
