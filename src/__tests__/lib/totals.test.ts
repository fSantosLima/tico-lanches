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
