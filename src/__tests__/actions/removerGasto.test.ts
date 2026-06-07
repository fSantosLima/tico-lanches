import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }
const mockExpense = {
  id: 'exp-1',
  userId: 'user-1',
  date: new Date('2026-06-07'),
  category: 'Ingredientes',
  description: 'Frango',
  quantity: 3,
  unit: 'kg',
  value: 90,
  createdAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('removerGasto', () => {
  it('lança erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await expect(removerGasto('exp-1')).rejects.toThrow('Não autorizado')
  })

  it('lança erro se gasto não encontrado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(null)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await expect(removerGasto('exp-inexistente')).rejects.toThrow('Gasto não encontrado')
  })

  it('lança erro se gasto pertence a outro usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.findFirst).mockResolvedValue({ ...mockExpense, userId: 'outro-user' } as any)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await expect(removerGasto('exp-1')).rejects.toThrow('Não autorizado')
  })

  it('deleta o gasto quando válido', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.findFirst).mockResolvedValue(mockExpense as any)
    vi.mocked(prisma.expense.delete).mockResolvedValue(mockExpense as any)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await removerGasto('exp-1')
    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'exp-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/gastos')
  })
})
