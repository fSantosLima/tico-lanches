'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function salvarLancamento(
  dateStr: string,
  itens: { productId: string; quantity: number }[]
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  // Validate date first (format check + must be today or in the past)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('Data inválida')
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) throw new Error('Data inválida')

  // Validate all quantities before processing
  for (const item of itens) {
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
      throw new Error('Quantidade inválida')
    }
  }

  for (const item of itens) {
    const product = await prisma.product.findFirst({
      where: { id: item.productId, userId: session.user.id },
    })
    if (!product) throw new Error('Produto não encontrado')

    const saleDate = new Date(dateStr)

    if (item.quantity === 0) {
      await prisma.sale.deleteMany({
        where: { userId: session.user.id, productId: item.productId, date: saleDate },
      })
    } else {
      await prisma.sale.upsert({
        where: {
          userId_productId_date: {
            userId: session.user.id,
            productId: item.productId,
            date: saleDate,
          },
        },
        update: { quantity: item.quantity, unitPrice: product.price, unitCost: product.cost },
        create: {
          userId: session.user.id,
          productId: item.productId,
          date: saleDate,
          quantity: item.quantity,
          unitPrice: product.price,
          unitCost: product.cost,
        },
      })
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/lancamento')
}
