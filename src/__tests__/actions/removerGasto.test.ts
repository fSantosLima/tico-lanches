import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

beforeEach(() => vi.clearAllMocks())

describe('removerGasto', () => {
  it('lança erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await expect(removerGasto('exp-1')).rejects.toThrow('Não autorizado')
  })

  it('lança erro se gasto não encontrado ou de outro usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.deleteMany).mockResolvedValue({ count: 0 })
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await expect(removerGasto('exp-inexistente')).rejects.toThrow('Gasto não encontrado ou não autorizado')
  })

  it('deleta o gasto quando válido usando deleteMany com userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.deleteMany).mockResolvedValue({ count: 1 })
    const { removerGasto } = await import('@/app/(protected)/gastos/actions')
    await removerGasto('exp-1')
    expect(prisma.expense.deleteMany).toHaveBeenCalledWith({
      where: { id: 'exp-1', userId: 'user-1' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/gastos')
  })
})
