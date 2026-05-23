'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function registerSale(productId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
  })
  if (!product) throw new Error('Produto não encontrado')

  await prisma.sale.create({
    data: { productId, userId: session.user.id, value: product.price },
  })

  revalidatePath('/dashboard')
}
