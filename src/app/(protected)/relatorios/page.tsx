import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolverPeriodo } from '@/lib/periodo'
import { calcularRelatorio } from '@/lib/relatorio'
import { FiltroPeriodo } from './FiltroPeriodo'
import { Tabs } from './Tabs'
import { GraficoRosca } from './GraficoRosca'
import { GraficoLinha } from './GraficoLinha'

interface Props {
  searchParams: Promise<{ de?: string; ate?: string; tab?: string }>
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10)
}

export default async function RelatoriosPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  const { de, ate, tab } = await searchParams

  const periodo = resolverPeriodo({ de, ate }, new Date())
  const tabAtiva: 'resumo' | 'graficos' = tab === 'graficos' ? 'graficos' : 'resumo'

  const inicio = new Date(periodo.de)
  const fim = new Date(periodo.ate)

  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: { userId: session!.user.id, date: { gte: inicio, lte: fim } },
      select: { quantity: true, unitPrice: true, date: true },
    }),
    prisma.expense.findMany({
      where: { userId: session!.user.id, date: { gte: inicio, lte: fim } },
      select: { value: true, category: true, date: true },
    }),
  ])

  const r = calcularRelatorio({ sales, expenses, inicio, fim })

  const semanas = r.lucroPorSemana.map(w => ({
    semana: w.semanaInicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
    lucroReal: Number(w.lucroReal.toFixed(2)),
  }))

  const fmt = (n: number) => `R$ ${n.toFixed(2)}`
  const semMovimento = r.faturamento === 0 && r.gastos === 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <h1 className="text-xl font-bold dark:text-slate-100 mb-4">Relatórios</h1>

      <FiltroPeriodo de={periodo.de} ate={periodo.ate} tab={tabAtiva} max={hojeIso()} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
        <Kpi label="Faturamento" value={fmt(r.faturamento)} />
        <Kpi label="Gastos" value={fmt(r.gastos)} />
        <Kpi label="Lucro real" value={fmt(r.lucroReal)} highlight />
        <Kpi label="Margem" value={`${(r.margem * 100).toFixed(0)}%`} />
      </div>

      <Tabs tab={tabAtiva} de={periodo.de} ate={periodo.ate} />

      {semMovimento ? (
        <p className="text-center text-gray-400 dark:text-slate-500 py-8">Sem movimento neste período.</p>
      ) : tabAtiva === 'resumo' ? (
        <GastosCategoria itens={r.gastosPorCategoria} />
      ) : (
        <div className="flex flex-col gap-6 mt-4">
          <GraficoRosca dados={r.gastosPorCategoria} />
          <GraficoLinha dados={semanas} />
        </div>
      )}
    </div>
  )
}

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-green-600' : 'dark:text-slate-100'}`}>{value}</p>
    </div>
  )
}

function GastosCategoria({ itens }: { itens: { categoria: string; total: number }[] }) {
  if (itens.length === 0) {
    return <p className="text-center text-gray-400 dark:text-slate-500 py-8">Nenhum gasto no período.</p>
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mt-4">
      {itens.map(i => (
        <div key={i.categoria} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
          <span className="dark:text-slate-200">{i.categoria}</span>
          <span className="font-bold text-green-600">R$ {i.total.toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}
