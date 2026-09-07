import { getServerSession } from 'next-auth'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCustoReal, type InsumoInput } from '@/lib/insumos'
import { ThemeToggle } from '@/components/ThemeToggle'
import { removerItemReceita } from './actions'
import { ReceitaForm } from './ReceitaForm'

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  const userId = session!.user.id

  const product = await prisma.product.findFirst({ where: { id, userId } })
  if (!product) notFound()

  const [insumos, receita] = await Promise.all([
    prisma.insumo.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.recipeItem.findMany({ where: { userId, productId: id } }),
  ])

  const insumosPorId = new Map<string, InsumoInput>(
    insumos.map(i => [i.id, { id: i.id, name: i.name, unit: i.unit, cost: i.cost, minStock: i.minStock }]),
  )

  const custoReal = calcularCustoReal(
    id,
    receita.map(r => ({ productId: r.productId, insumoId: r.insumoId, quantity: r.quantity })),
    insumosPorId,
  )

  const margem = product.price - custoReal.custoReal

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <Link href="/products" className="text-orange-500 text-lg">←</Link>
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-orange-500 text-lg hidden lg:inline">←</Link>
        <h1 className="text-xl font-bold dark:text-slate-100">{product.name}</h1>
      </div>

      {/* Preço, custo manual e custo real */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500">Preço</p>
          <p className="text-lg font-bold text-green-600">R$ {product.price.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500">Custo manual</p>
          <p className="text-lg font-bold dark:text-slate-100">R$ {product.cost.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500">Custo real (receita)</p>
          <p className="text-lg font-bold dark:text-slate-100">R$ {custoReal.custoReal.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-slate-500">Margem real</p>
          <p className={`text-lg font-bold ${margem < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
            R$ {margem.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Ficha técnica */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b dark:border-slate-700">
          <span className="font-semibold dark:text-slate-100">Ficha técnica</span>
        </div>
        {custoReal.itens.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400 dark:text-slate-500">
            Nenhum insumo na receita ainda.
          </p>
        ) : (
          custoReal.itens.map(item => {
            const recipeItem = receita.find(r => r.insumoId === item.insumoId)!
            return (
              <div key={item.insumoId} className="flex justify-between items-center px-4 py-3 border-b last:border-0 dark:border-slate-700">
                <p className="text-sm dark:text-slate-200">
                  {item.nome} · {fmt(item.quantidade)} {item.unidade} · R$ {item.subtotal.toFixed(2)}
                </p>
                <form action={removerItemReceita.bind(null, recipeItem.id, id)}>
                  <button type="submit" className="text-xs text-red-400 hover:text-red-600 transition-colors">
                    Remover
                  </button>
                </form>
              </div>
            )
          })
        )}
      </div>

      {/* Adicionar insumo à receita */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
        <p className="font-semibold dark:text-slate-100 text-sm mb-3">Adicionar insumo</p>
        <ReceitaForm
          productId={id}
          insumos={insumos.map(i => ({ id: i.id, name: i.name, unit: i.unit }))}
        />
      </div>
    </div>
  )
}
