'use server'

import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function adicionarGasto(formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const date = formData.get('date') as string
  const category = formData.get('category') as string
  const description = formData.get('description') as string
  const quantityRaw = formData.get('quantity') as string
  const unit = formData.get('unit') as string
  const valueRaw = formData.get('value') as string

  if (!date || !category || !description || !quantityRaw || !unit || !valueRaw) {
    throw new Error('Campos obrigatórios ausentes')
  }

  const today = new Date().toISOString().slice(0, 10)
  if (date > today) throw new Error('Data inválida')

  const quantity = parseFloat(quantityRaw)
  if (isNaN(quantity) || quantity <= 0) throw new Error('Quantidade inválida')

  const value = parseFloat(valueRaw)
  if (isNaN(value) || value <= 0) throw new Error('Valor inválido')

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
}

export async function removerGasto(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const expense = await prisma.expense.findFirst({ where: { id } })
  if (!expense) throw new Error('Gasto não encontrado')
  if (expense.userId !== session.user.id) throw new Error('Não autorizado')

  await prisma.expense.delete({ where: { id } })
  revalidatePath('/gastos')
}
