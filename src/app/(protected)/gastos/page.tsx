import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adicionarGasto, removerGasto } from './actions'

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>
}

const CATEGORY_ORDER = ['Ingredientes', 'Descartáveis', 'Salgados prontos', 'Outros'] as const

function defaultDe() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function defaultAte() {
  return new Date().toISOString().slice(0, 10)
}

export default async function GastosPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  const { de, ate } = await searchParams

  const deStr = de ?? defaultDe()
  const ateStr = ate ?? defaultAte()

  const today = defaultAte()

  const expenses = await prisma.expense.findMany({
    where: {
      userId: session!.user.id,
      date: {
        gte: new Date(deStr),
        lte: new Date(ateStr),
      },
    },
    orderBy: { date: 'desc' },
  })

  // Group by category
  const byCategory = new Map<string, typeof expenses>()
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, [])
  for (const e of expenses) {
    const key = (CATEGORY_ORDER as readonly string[]).includes(e.category) ? e.category : 'Outros'
    byCategory.get(key)!.push(e)
  }

  const totalGeral = expenses.reduce((s, e) => s + e.value, 0)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <h1 className="text-xl font-bold dark:text-slate-100 mb-4">Gastos</h1>

      {/* Date filter */}
      <form method="GET" className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">De</label>
          <input
            type="date"
            name="de"
            defaultValue={deStr}
            max={today}
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Até</label>
          <input
            type="date"
            name="ate"
            defaultValue={ateStr}
            max={today}
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <button
          type="submit"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Filtrar
        </button>
      </form>

      {/* Add expense form */}
      <form
        action={adicionarGasto}
        className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col gap-3"
      >
        <p className="font-semibold dark:text-slate-100 text-sm">Novo gasto</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Data</label>
            <input
              type="date"
              name="date"
              defaultValue={today}
              max={today}
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Categoria</label>
            <select
              name="category"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Selecionar...</option>
              {CATEGORY_ORDER.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Descrição</label>
            <input
              type="text"
              name="description"
              placeholder="ex: Frango"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Qtd</label>
            <input
              type="number"
              name="quantity"
              step="0.01"
              min="0.01"
              placeholder="0"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Unidade</label>
            <input
              type="text"
              name="unit"
              placeholder="ex: kg"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 dark:text-slate-400">Valor (R$)</label>
            <input
              type="number"
              name="value"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              required
              className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
        <button
          type="submit"
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm mt-1"
        >
          Adicionar gasto
        </button>
      </form>

      {/* Grouped list */}
      {expenses.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 py-8">
          Nenhum gasto registrado no período.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {CATEGORY_ORDER.map(cat => {
            const items = byCategory.get(cat)!
            if (items.length === 0) return null
            const totalCat = items.reduce((s, e) => s + e.value, 0)
            return (
              <div key={cat} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex justify-between items-center px-4 py-3 border-b dark:border-slate-700">
                  <span className="font-semibold dark:text-slate-100">{cat}</span>
                  <span className="font-bold text-green-600">R$ {totalCat.toFixed(2)}</span>
                </div>
                {items.map(e => (
                  <div key={e.id} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
                    <div>
                      <p className="text-sm dark:text-slate-200">
                        {e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {e.description} · {e.quantity}{e.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold dark:text-slate-200">R$ {e.value.toFixed(2)}</span>
                      <form action={removerGasto.bind(null, e.id)}>
                        <button
                          type="submit"
                          className="text-xs text-red-400 hover:text-red-600 transition-colors"
                        >
                          Remover
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          <div className="flex justify-between items-center px-4 py-3 bg-gray-100 dark:bg-slate-800 rounded-xl">
            <span className="font-semibold dark:text-slate-200">Total do período</span>
            <span className="font-bold text-green-600 text-lg">R$ {totalGeral.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
