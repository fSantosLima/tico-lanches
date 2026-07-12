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
