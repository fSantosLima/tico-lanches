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
