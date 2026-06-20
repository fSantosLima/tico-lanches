export interface RelatorioSale {
  quantity: number
  unitPrice: number
  date: Date
}

export interface RelatorioExpense {
  value: number
  category: string
  date: Date
}

export interface RelatorioInput {
  sales: RelatorioSale[]
  expenses: RelatorioExpense[]
  inicio: Date
  fim: Date
}

export interface GastoCategoria {
  categoria: string
  total: number
}

export interface LucroSemana {
  semanaInicio: Date // segunda-feira (meia-noite UTC) da semana
  faturamento: number
  gastos: number
  lucroReal: number
}

export interface Relatorio {
  faturamento: number
  gastos: number
  lucroReal: number
  margem: number
  gastosPorCategoria: GastoCategoria[]
  lucroPorSemana: LucroSemana[]
}

// Segunda-feira (UTC) da semana de `d`, à meia-noite UTC.
function inicioSemanaUTC(d: Date): Date {
  // getUTCDay() usa domingo=0; re-indexa para segunda=0 ... domingo=6.
  const dow = (d.getUTCDay() + 6) % 7
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow))
}

function chave(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function calcularRelatorio(input: RelatorioInput): Relatorio {
  const { inicio, fim } = input

  // Considera apenas itens dentro de [inicio, fim]. Torna a função auto-contida:
  // os totais e a soma das semanas ficam sempre consistentes, mesmo que o
  // chamador passe dados fora do período.
  const dentro = (d: Date) => d.getTime() >= inicio.getTime() && d.getTime() <= fim.getTime()
  const sales = input.sales.filter(v => dentro(v.date))
  const expenses = input.expenses.filter(e => dentro(e.date))

  const faturamento = sales.reduce((s, v) => s + v.quantity * v.unitPrice, 0)
  const gastos = expenses.reduce((s, e) => s + e.value, 0)
  const lucroReal = faturamento - gastos
  const margem = faturamento === 0 ? 0 : lucroReal / faturamento

  // Gastos por categoria (ordenado desc).
  const catMap = new Map<string, number>()
  for (const e of expenses) {
    catMap.set(e.category, (catMap.get(e.category) ?? 0) + e.value)
  }
  const gastosPorCategoria = [...catMap.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)

  // Gera todas as semanas do intervalo [inicio, fim], inclusive vazias.
  const semanas = new Map<string, LucroSemana>()
  let cursor = inicioSemanaUTC(inicio)
  const ultimaSemana = inicioSemanaUTC(fim)
  while (cursor.getTime() <= ultimaSemana.getTime()) {
    semanas.set(chave(cursor), {
      semanaInicio: new Date(cursor.getTime()),
      faturamento: 0,
      gastos: 0,
      lucroReal: 0,
    })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 7))
  }

  for (const v of sales) {
    const w = semanas.get(chave(inicioSemanaUTC(v.date)))
    if (w) w.faturamento += v.quantity * v.unitPrice
  }
  for (const e of expenses) {
    const w = semanas.get(chave(inicioSemanaUTC(e.date)))
    if (w) w.gastos += e.value
  }
  for (const w of semanas.values()) {
    w.lucroReal = w.faturamento - w.gastos
  }

  const lucroPorSemana = [...semanas.values()].sort(
    (a, b) => a.semanaInicio.getTime() - b.semanaInicio.getTime(),
  )

  return { faturamento, gastos, lucroReal, margem, gastosPorCategoria, lucroPorSemana }
}
