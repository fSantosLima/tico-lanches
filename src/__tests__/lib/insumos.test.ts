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
