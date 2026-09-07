export type EstoqueStatus = 'ok' | 'baixo' | 'negativo'

export function statusEstoque(saldo: number, minimo: number): EstoqueStatus {
  if (saldo < 0) return 'negativo'
  if (minimo > 0 && saldo <= minimo) return 'baixo'
  return 'ok'
}

export const ORDEM_STATUS: Record<EstoqueStatus, number> = { negativo: 0, baixo: 1, ok: 2 }
