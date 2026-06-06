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
