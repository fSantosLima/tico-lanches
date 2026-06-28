'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type EstoqueActionState = { error: string } | null

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export async function registrarEntrada(
  _prevState: EstoqueActionState,
  formData: FormData
): Promise<EstoqueActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const productId = formData.get('productId') as string
  const dateStr = formData.get('date') as string
  const quantityRaw = formData.get('quantity') as string
  const noteRaw = formData.get('note') as string | null
  const note = noteRaw && noteRaw.trim() !== '' ? noteRaw.trim() : null

  if (!productId || !dateStr || !quantityRaw) {
    return { error: 'Campos obrigatórios ausentes' }
  }

  if (!ISO_RE.test(dateStr)) return { error: 'Data inválida' }
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) return { error: 'Data inválida' }

  const quantity = Number(quantityRaw)
  if (!Number.isInteger(quantity) || quantity <= 0) return { error: 'Quantidade inválida' }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
  })
  if (!product) return { error: 'Produto não encontrado' }

  await prisma.stockEntry.create({
    data: {
      userId: session.user.id,
      productId,
      date: new Date(dateStr),
      quantity,
      note,
    },
  })

  revalidatePath('/estoque')
  revalidatePath('/dashboard')
  return null
}

export async function removerEntrada(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const result = await prisma.stockEntry.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (result.count === 0) throw new Error('Entrada não encontrada ou não autorizada')

  revalidatePath('/estoque')
  revalidatePath('/dashboard')
}

export async function definirEstoqueMinimo(productId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const minStock = Number(formData.get('minStock'))
  if (!Number.isInteger(minStock) || minStock < 0) throw new Error('Estoque mínimo inválido')

  const result = await prisma.product.updateMany({
    where: { id: productId, userId: session.user.id },
    data: { minStock },
  })
  if (result.count === 0) throw new Error('Produto não encontrado ou não autorizado')

  revalidatePath('/estoque')
  revalidatePath('/dashboard')
}
