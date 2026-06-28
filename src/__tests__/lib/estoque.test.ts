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
