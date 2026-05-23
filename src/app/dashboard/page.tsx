import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularTotalDia } from '@/lib/totals'
import { ProductButton } from './ProductButton'
import { LogoutButton } from './LogoutButton'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const [products, sales] = await Promise.all([
    prisma.product.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.sale.findMany({
      where: {
        userId: session!.user.id,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
  ])

  const totalDia = calcularTotalDia(sales)

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-500 text-sm">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <div className="flex items-center gap-3">
          <Link href="/products" className="text-orange-500 text-sm font-medium">
            Produtos
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 mb-6 text-center shadow-sm">
        <p className="text-gray-500 text-sm mb-1">Total de hoje</p>
        <p className="text-4xl font-bold text-green-600">
          R$ {totalDia.toFixed(2)}
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {sales.length} venda{sales.length !== 1 ? 's' : ''}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">Nenhum produto cadastrado ainda.</p>
          <Link
            href="/products/new"
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Cadastrar primeiro produto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {products.map(product => (
            <ProductButton
              key={product.id}
              id={product.id}
              name={product.name}
              price={product.price}
            />
          ))}
        </div>
      )}
    </div>
  )
}
