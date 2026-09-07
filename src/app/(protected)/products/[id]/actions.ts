'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type ReceitaActionState = { error: string } | null

export async function adicionarItemReceita(
  _prevState: ReceitaActionState,
  formData: FormData
): Promise<ReceitaActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const productId = formData.get('productId') as string
  const insumoId = formData.get('insumoId') as string
  const quantityRaw = formData.get('quantity') as string

  if (!productId || !insumoId || !quantityRaw) {
    return { error: 'Campos obrigatórios ausentes' }
  }

  const quantity = Number(quantityRaw)
  if (isNaN(quantity) || quantity <= 0) return { error: 'Quantidade inválida' }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
  })
  if (!product) return { error: 'Produto não encontrado' }

  const insumo = await prisma.insumo.findFirst({
    where: { id: insumoId, userId: session.user.id },
  })
  if (!insumo) return { error: 'Insumo não encontrado' }

  const existing = await prisma.recipeItem.findFirst({
    where: { productId, insumoId, userId: session.user.id },
  })
  if (existing) return { error: 'Insumo já está na ficha técnica' }

  await prisma.recipeItem.create({
    data: { userId: session.user.id, productId, insumoId, quantity },
  })

  revalidatePath(`/products/${productId}`)
  revalidatePath('/insumos')
  revalidatePath('/dashboard')
  return null
}

export async function removerItemReceita(id: string, productId: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const result = await prisma.recipeItem.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (result.count === 0) throw new Error('Item não encontrado ou não autorizado')

  revalidatePath(`/products/${productId}`)
  revalidatePath('/insumos')
  revalidatePath('/dashboard')
}
