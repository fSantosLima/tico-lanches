import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  const products = await prisma.product.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Produtos</h1>
        <Link
          href="/products/new"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Novo
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Nenhum produto cadastrado.{' '}
          <Link href="/products/new" className="text-orange-500">
            Criar agora
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {products.map(product => (
            <li key={product.id} className="bg-white border rounded-xl p-4">
              <div className="flex justify-between items-start">
                <span className="font-medium">{product.name}</span>
                <span className="text-green-600 font-bold">
                  R$ {product.price.toFixed(2)}
                </span>
              </div>
              <span className="text-gray-400 text-sm">
                Custo: R$ {product.cost.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Link href="/dashboard" className="text-orange-500 text-sm">
          ← Voltar ao dashboard
        </Link>
      </div>
    </div>
  )
}
