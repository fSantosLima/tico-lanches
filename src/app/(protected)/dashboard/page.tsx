import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularResumo } from '@/lib/totals'
import { LogoutButton } from './LogoutButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const salesToday = await prisma.sale.findMany({
    where: { userId: session!.user.id, date: today },
  })
  const { faturamento: fatHoje, lucro: lucroHoje } = calcularResumo(salesToday)

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const salesPassadas = await prisma.sale.findMany({
    where: {
      userId: session!.user.id,
      date: { gte: sevenDaysAgo, lt: today },
    },
    orderBy: { date: 'desc' },
  })

  const porDia = new Map<string, typeof salesPassadas>()
  for (const s of salesPassadas) {
    const key = s.date.toISOString().slice(0, 10)
    if (!porDia.has(key)) porDia.set(key, [])
    porDia.get(key)!.push(s)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <div className="flex justify-between items-center mb-4 lg:hidden">
        <span className="text-gray-500 dark:text-slate-400 text-sm">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <div className="flex items-center gap-3">
          <Link href="/products" className="text-orange-500 text-sm font-medium">Produtos</Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mb-4 text-center shadow-sm">
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-1">Hoje</p>
        <p className="text-4xl font-bold text-green-600">R$ {fatHoje.toFixed(2)}</p>
        <p className="text-emerald-500 font-semibold mt-1">lucro R$ {lucroHoje.toFixed(2)}</p>
      </div>

      <Link
        href="/lancamento"
        className="block w-full bg-orange-500 text-white text-center py-4 rounded-xl font-bold text-lg mb-6"
      >
        Lançar vendas de hoje
      </Link>

      {porDia.size > 0 && (
        <>
          <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-3">
            Dias anteriores
          </p>
          <div className="flex flex-col gap-2">
            {Array.from(porDia.entries()).map(([dateStr, sales]) => {
              const { faturamento, lucro } = calcularResumo(sales)
              const date = new Date(dateStr + 'T00:00:00')
              const label = date.toLocaleDateString('pt-BR', {
                weekday: 'short', day: '2-digit', month: '2-digit',
              })
              const totalItens = sales.reduce((s, r) => s + r.quantity, 0)
              return (
                <Link
                  key={dateStr}
                  href={`/lancamento?data=${dateStr}`}
                  className="flex justify-between items-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="font-semibold dark:text-slate-100">{label}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{totalItens} itens</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">R$ {faturamento.toFixed(2)}</p>
                    <p className="text-xs text-emerald-500 font-semibold">lucro R$ {lucro.toFixed(2)}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
