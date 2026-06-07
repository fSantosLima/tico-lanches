'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_CATEGORIES = ['Ingredientes', 'Descartáveis', 'Salgados prontos', 'Outros'] as const

export type GastoActionState = { error: string } | null

export async function adicionarGasto(
  _prevState: GastoActionState,
  formData: FormData
): Promise<GastoActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const date = formData.get('date') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const quantityRaw = formData.get('quantity') as string
  const unit = formData.get('unit') as string
  const valueRaw = formData.get('value') as string

  if (!date || !category || !description || !quantityRaw || !unit || !valueRaw) {
    return { error: 'Campos obrigatórios ausentes' }
  }

  if (!(VALID_CATEGORIES as readonly string[]).includes(category)) {
    return { error: 'Categoria inválida' }
  }

  const today = new Date().toISOString().slice(0, 10)
  if (date > today) return { error: 'Data inválida' }

  const quantity = parseFloat(quantityRaw)
  if (isNaN(quantity) || quantity <= 0) return { error: 'Quantidade inválida' }

  const value = parseFloat(valueRaw)
  if (isNaN(value) || value <= 0) return { error: 'Valor inválido' }

  await prisma.expense.create({
    data: {
      userId: session.user.id,
      date: new Date(date),
      category,
      description,
      quantity,
      unit,
      value,
    },
  })

  revalidatePath('/gastos')
  return null
}

export async function removerGasto(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const result = await prisma.expense.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (result.count === 0) throw new Error('Gasto não encontrado ou não autorizado')

  revalidatePath('/gastos')
}
