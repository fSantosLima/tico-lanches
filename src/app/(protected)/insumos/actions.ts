'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type InsumoActionState = { error: string } | null

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const UNIDADES = ['un', 'g', 'kg', 'ml', 'L'] as const

export async function criarInsumo(
  _prevState: InsumoActionState,
  formData: FormData
): Promise<InsumoActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const name = (formData.get('name') as string)?.trim()
  const unit = formData.get('unit') as string
  const costRaw = formData.get('cost') as string
  const minStockRaw = formData.get('minStock') as string | null

  if (!name || !unit || !costRaw) return { error: 'Campos obrigatórios ausentes' }
  if (!(UNIDADES as readonly string[]).includes(unit)) return { error: 'Unidade inválida' }

  const cost = Number(costRaw)
  if (isNaN(cost) || cost < 0) return { error: 'Custo inválido' }

  const minStock = minStockRaw ? Number(minStockRaw) : 0
  if (isNaN(minStock) || minStock < 0) return { error: 'Estoque mínimo inválido' }

  await prisma.insumo.create({
    data: { userId: session.user.id, name, unit, cost, minStock },
  })

  revalidatePath('/insumos')
  redirect('/insumos')
}

export async function registrarEntradaInsumo(
  _prevState: InsumoActionState,
  formData: FormData
): Promise<InsumoActionState> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return { error: 'Não autorizado' }

  const insumoId = formData.get('insumoId') as string
  const dateStr = formData.get('date') as string
  const quantityRaw = formData.get('quantity') as string
  const noteRaw = formData.get('note') as string | null
  const note = noteRaw && noteRaw.trim() !== '' ? noteRaw.trim() : null

  if (!insumoId || !dateStr || !quantityRaw) {
    return { error: 'Campos obrigatórios ausentes' }
  }

  if (!ISO_RE.test(dateStr)) return { error: 'Data inválida' }
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr > today) return { error: 'Data inválida' }

  const quantity = Number(quantityRaw)
  if (isNaN(quantity) || quantity <= 0) return { error: 'Quantidade inválida' }

  const insumo = await prisma.insumo.findFirst({
    where: { id: insumoId, userId: session.user.id },
  })
  if (!insumo) return { error: 'Insumo não encontrado' }

  await prisma.insumoEntry.create({
    data: {
      userId: session.user.id,
      insumoId,
      date: new Date(dateStr),
      quantity,
      note,
    },
  })

  revalidatePath('/insumos')
  revalidatePath('/dashboard')
  return null
}

export async function removerEntradaInsumo(id: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const result = await prisma.insumoEntry.deleteMany({
    where: { id, userId: session.user.id },
  })
  if (result.count === 0) throw new Error('Entrada não encontrada ou não autorizada')

  revalidatePath('/insumos')
  revalidatePath('/dashboard')
}

export async function definirMinimoInsumo(insumoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const minStock = Number(formData.get('minStock'))
  if (isNaN(minStock) || minStock < 0) throw new Error('Estoque mínimo inválido')

  const result = await prisma.insumo.updateMany({
    where: { id: insumoId, userId: session.user.id },
    data: { minStock },
  })
  if (result.count === 0) throw new Error('Insumo não encontrado ou não autorizado')

  revalidatePath('/insumos')
  revalidatePath('/dashboard')
}

export async function definirCustoInsumo(insumoId: string, formData: FormData) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new Error('Não autorizado')

  const cost = Number(formData.get('cost'))
  if (isNaN(cost) || cost < 0) throw new Error('Custo inválido')

  const result = await prisma.insumo.updateMany({
    where: { id: insumoId, userId: session.user.id },
    data: { cost },
  })
  if (result.count === 0) throw new Error('Insumo não encontrado ou não autorizado')

  revalidatePath('/insumos')
  revalidatePath('/products')
}
