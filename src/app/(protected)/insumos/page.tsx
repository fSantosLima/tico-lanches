import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularEstoqueInsumos } from '@/lib/insumos'
import type { EstoqueStatus } from '@/lib/stockStatus'
import { removerEntradaInsumo } from './actions'
import { EntradaInsumoForm } from './EntradaInsumoForm'
import { MinimoInsumoForm } from './MinimoInsumoForm'
import { CustoInsumoForm } from './CustoInsumoForm'

const STATUS_BADGE: Record<EstoqueStatus, { label: string; className: string }> = {
  ok: { label: 'OK', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  baixo: { label: 'Baixo', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  negativo: { label: 'Negativo', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export default async function InsumosPage() {
  const session = await getServerSession(authOptions)
  const userId = session!.user.id
  const today = new Date().toISOString().slice(0, 10)

  const [insumos, entradas, receitas, sales] = await Promise.all([
    prisma.insumo.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.insumoEntry.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
    prisma.recipeItem.findMany({ where: { userId } }),
    prisma.sale.findMany({ where: { userId } }),
  ])

  const estoque = calcularEstoqueInsumos(
    insumos.map(i => ({ id: i.id, name: i.name, unit: i.unit, cost: i.cost, minStock: i.minStock })),
    entradas.map(e => ({ insumoId: e.insumoId, quantity: e.quantity })),
    receitas.map(r => ({ productId: r.productId, insumoId: r.insumoId, quantity: r.quantity })),
    sales.map(s => ({ productId: s.productId, quantity: s.quantity })),
  )

  const infoPorInsumo = new Map(insumos.map(i => [i.id, i]))
  const recentes = entradas.slice(0, 15)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold dark:text-slate-100">Insumos</h1>
        <Link
          href="/insumos/new"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Novo insumo
        </Link>
      </div>

      {insumos.length === 0 ? (
        <p className="text-center text-gray-400 dark:text-slate-500 py-8">
          Nenhum insumo cadastrado.{' '}
          <Link href="/insumos/new" className="text-orange-500">Cadastrar agora</Link>
        </p>
      ) : (
        <>
          <EntradaInsumoForm
            today={today}
            insumos={insumos.map(i => ({ id: i.id, name: i.name, unit: i.unit }))}
          />

          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b dark:border-slate-700">
              <span className="font-semibold dark:text-slate-100">Saldo por insumo</span>
            </div>
            {estoque.map(item => {
              const badge = STATUS_BADGE[item.status]
              const info = infoPorInsumo.get(item.insumoId)!
              return (
                <div key={item.insumoId} className="flex flex-wrap justify-between items-center gap-3 px-4 py-3 border-b last:border-0 dark:border-slate-700">
                  <div className="min-w-[8rem]">
                    <p className="text-sm font-medium dark:text-slate-100">{item.nome}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {fmt(item.entradas)} {item.unidade} entradas · {fmt(item.consumido)} {item.unidade} consumidos
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`text-2xl font-bold ${item.saldo < 0 ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'}`}>
                      {fmt(item.saldo)} <span className="text-sm font-normal text-gray-400 dark:text-slate-500">{item.unidade}</span>
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.className}`}>
                      {badge.label}
                    </span>
                    <MinimoInsumoForm insumoId={item.insumoId} minimo={item.minimo} />
                    <CustoInsumoForm insumoId={item.insumoId} custo={info.cost} />
                  </div>
                </div>
              )
            })}
          </div>

          {recentes.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b dark:border-slate-700">
                <span className="font-semibold dark:text-slate-100">Entradas recentes</span>
              </div>
              {recentes.map(e => {
                const info = infoPorInsumo.get(e.insumoId)
                return (
                  <div key={e.id} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
                    <p className="text-sm dark:text-slate-200">
                      {e.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ·{' '}
                      {info?.name ?? '—'} · +{fmt(e.quantity)} {info?.unit ?? ''}
                      {e.note ? ` · ${e.note}` : ''}
                    </p>
                    <form action={removerEntradaInsumo.bind(null, e.id)}>
                      <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                        Remover
                      </button>
                    </form>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
