import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularEstoque, type EstoqueStatus } from '@/lib/estoque'
import { removerEntrada, definirEstoqueMinimo } from './actions'
import { EntradaForm } from './EntradaForm'

const STATUS_BADGE: Record<EstoqueStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  baixo: { label: 'Baixo', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  negativo: { label: 'Negativo', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default async function EstoquePage() {
  const session = await getServerSession(authOptions)
  const userId = session!.user.id
  const today = new Date().toISOString().slice(0, 10)

  const [products, entries, sales] = await Promise.all([
    prisma.product.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.stockEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.sale.findMany({ where: { userId } }),
  ])

  const estoque = calcularEstoque(
    products.map(p => ({ id: p.id, name: p.name, minStock: p.minStock })),
    entries.map(e => ({ productId: e.productId, quantity: e.quantity })),
    sales.map(s => ({ productId: s.productId, quantity: s.quantity })),
  )

  const nomePorProduto = new Map(products.map(p => [p.id, p.name]))
  const recentes = entries.slice(0, 15)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <h1 className="text-xl font-bold dark:text-slate-100 mb-4">Estoque</h1>

      <EntradaForm today={today} products={products.map(p => ({ id: p.id, name: p.name }))} />

      {/* Saldo por produto */}
      {estoque.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 py-8">
          Nenhum produto cadastrado.
        </p>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6">
          <div className="flex justify-between items-center px-4 py-3 border-b dark:border-slate-700">
            <span className="font-semibold dark:text-slate-100">Saldo por produto</span>
          </div>
          {estoque.map(item => {
            const badge = STATUS_BADGE[item.status]
            return (
              <div key={item.productId} className="flex flex-wrap justify-between items-center gap-3 px-4 py-3 border-b last:border-0 dark:border-slate-700">
                <div className="min-w-[8rem]">
                  <p className="text-sm font-medium dark:text-slate-100">{item.nome}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {item.entradas} entradas · {item.vendido} vendidos
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-2xl font-bold ${item.saldo < 0 ? 'text-red-500' : 'dark:text-slate-100'}`}>
                    {item.saldo}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.className}`}>
                    {badge.label}
                  </span>
                  <form action={definirEstoqueMinimo.bind(null, item.productId)} className="flex items-center gap-1">
                    <label className="text-xs text-gray-400 dark:text-slate-500">mín.</label>
                    <input
                      type="number"
                      name="minStock"
                      min="0"
                      step="1"
                      defaultValue={item.minimo}
                      className="w-14 border dark:border-slate-600 rounded-lg px-2 py-1 text-sm dark:bg-slate-900 dark:text-slate-100"
                    />
                    <button type="submit" className="text-xs text-orange-500 hover:text-orange-600">
                      Salvar
                    </button>
                  </form>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Entradas recentes */}
      {recentes.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b dark:border-slate-700">
            <span className="font-semibold dark:text-slate-100">Entradas recentes</span>
          </div>
          {recentes.map(e => (
            <div key={e.id} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
              <p className="text-sm dark:text-slate-200">
                {e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ·{' '}
                {nomePorProduto.get(e.productId) ?? '—'} · +{e.quantity}
                {e.note ? ` · ${e.note}` : ''}
              </p>
              <form action={removerEntrada.bind(null, e.id)}>
                <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                  Remover
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
