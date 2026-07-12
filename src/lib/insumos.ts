import { statusEstoque, ORDEM_STATUS, type EstoqueStatus } from './stockStatus'

export interface InsumoInput {
  id: string
  name: string
  unit: string
  cost: number
  minStock: number
}

export interface InsumoEntradaInput {
  insumoId: string
  quantity: number
}

export interface ReceitaItemInput {
  productId: string
  insumoId: string
  quantity: number
}

export interface VendaInput {
  productId: string
  quantity: number
}

export interface InsumoSaldo {
  insumoId: string
  nome: string
  unidade: string
  entradas: number
  consumido: number
  saldo: number
  minimo: number
  status: EstoqueStatus
}

export function calcularEstoqueInsumos(
  insumos: InsumoInput[],
  entradas: InsumoEntradaInput[],
  receitas: ReceitaItemInput[],
  vendas: VendaInput[],
): InsumoSaldo[] {
  // Entradas somadas por insumo
  const entradasPorInsumo = new Map<string, number>()
  for (const e of entradas) {
    entradasPorInsumo.set(e.insumoId, (entradasPorInsumo.get(e.insumoId) ?? 0) + e.quantity)
  }

  // Receita agrupada por produto
  const receitaPorProduto = new Map<string, { insumoId: string; quantity: number }[]>()
  for (const r of receitas) {
    if (!receitaPorProduto.has(r.productId)) receitaPorProduto.set(r.productId, [])
    receitaPorProduto.get(r.productId)!.push({ insumoId: r.insumoId, quantity: r.quantity })
  }

  // Consumo derivado das vendas
  const consumoPorInsumo = new Map<string, number>()
  for (const v of vendas) {
    const itens = receitaPorProduto.get(v.productId)
    if (!itens) continue
    for (const it of itens) {
      consumoPorInsumo.set(
        it.insumoId,
        (consumoPorInsumo.get(it.insumoId) ?? 0) + it.quantity * v.quantity,
      )
    }
  }

  const resultado = insumos.map((i): InsumoSaldo => {
    const entradasTot = entradasPorInsumo.get(i.id) ?? 0
    const consumido = consumoPorInsumo.get(i.id) ?? 0
    const saldo = entradasTot - consumido
    return {
      insumoId: i.id,
      nome: i.name,
      unidade: i.unit,
      entradas: entradasTot,
      consumido,
      saldo,
      minimo: i.minStock,
      status: statusEstoque(saldo, i.minStock),
    }
  })

  resultado.sort((a, b) => {
    const ds = ORDEM_STATUS[a.status] - ORDEM_STATUS[b.status]
    return ds !== 0 ? ds : a.nome.localeCompare(b.nome, 'pt-BR')
  })

  return resultado
}
