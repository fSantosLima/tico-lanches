export interface EstoqueProductInput {
  id: string
  name: string
  minStock: number
}

export interface EstoqueEntry {
  productId: string
  quantity: number
}

export interface EstoqueSale {
  productId: string
  quantity: number
}

export type EstoqueStatus = 'ok' | 'baixo' | 'negativo'

export interface EstoqueProduto {
  productId: string
  nome: string
  entradas: number
  vendido: number
  saldo: number
  minimo: number
  status: EstoqueStatus
}

function statusDe(saldo: number, minimo: number): EstoqueStatus {
  if (saldo < 0) return 'negativo'
  if (minimo > 0 && saldo <= minimo) return 'baixo'
  return 'ok'
}

const ORDEM_STATUS: Record<EstoqueStatus, number> = { negativo: 0, baixo: 1, ok: 2 }

function somarPorProduto(itens: { productId: string; quantity: number }[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const i of itens) m.set(i.productId, (m.get(i.productId) ?? 0) + i.quantity)
  return m
}

export function calcularEstoque(
  products: EstoqueProductInput[],
  entries: EstoqueEntry[],
  sales: EstoqueSale[],
): EstoqueProduto[] {
  const entradasPorProduto = somarPorProduto(entries)
  const vendidoPorProduto = somarPorProduto(sales)

  const resultado = products.map((p): EstoqueProduto => {
    const entradas = entradasPorProduto.get(p.id) ?? 0
    const vendido = vendidoPorProduto.get(p.id) ?? 0
    const saldo = entradas - vendido
    return {
      productId: p.id,
      nome: p.name,
      entradas,
      vendido,
      saldo,
      minimo: p.minStock,
      status: statusDe(saldo, p.minStock),
    }
  })

  resultado.sort((a, b) => {
    const ds = ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]
    return ds !== 0 ? ds : a.nome.localeCompare(b.nome, 'pt-BR')
  })

  return resultado
}
