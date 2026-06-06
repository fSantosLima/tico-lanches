import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { LancamentoForm } from './LancamentoForm'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ data?: string }>
}

export default async function LancamentoPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  const { data: dataParam } = await searchParams

  const today = new Date().toISOString().slice(0, 10)
  const dateStr = dataParam ?? today

  const date = new Date(dateStr)
  const isToday = dateStr === today

  const [produtos, salesExistentes] = await Promise.all([
    prisma.product.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.sale.findMany({
      where: { userId: session!.user.id, date },
    }),
  ])

  const initialQtds: Record<string, number> = {}
  for (const s of salesExistentes) {
    initialQtds[s.productId] = s.quantity
  }

  const dateLabel = isToday
    ? 'Hoje'
    : date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      {/* Header mobile */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <Link href="/dashboard" className="text-orange-500 text-sm">← Voltar</Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold dark:text-slate-100">
          Vendas · {dateLabel}
        </h1>
        <Link href="#" className="text-orange-500 text-sm font-medium">trocar data</Link>
      </div>

      {produtos.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-slate-400 mb-4">Nenhum produto cadastrado.</p>
          <Link
            href="/products/new"
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Cadastrar produto
          </Link>
        </div>
      ) : (
        <LancamentoForm
          produtos={produtos}
          dateStr={dateStr}
          initialQtds={initialQtds}
        />
      )}
    </div>
  )
}
