import { describe, it, expect, vi, beforeEach } from 'vitest'
import { salvarLancamento } from '@/app/(protected)/lancamento/actions'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }
const mockProduct = {
  id: 'p-1', userId: 'user-1', name: 'X-Burguer', price: 18.0, cost: 9.0, createdAt: new Date(),
}

beforeEach(() => vi.clearAllMocks())

describe('salvarLancamento', () => {
  it('lança erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await expect(salvarLancamento('2026-06-06', [])).rejects.toThrow('Não autorizado')
  })

  it('rejeita data futura', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const futureDate = tomorrow.toISOString().slice(0, 10)
    await expect(salvarLancamento(futureDate, [])).rejects.toThrow('Data inválida')
  })

  it('rejeita quantidade negativa', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const itens = [{ productId: 'p-1', quantity: -1 }]
    await expect(salvarLancamento('2026-06-06', itens)).rejects.toThrow('Quantidade inválida')
  })

  it('rejeita quantidade decimal', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const itens = [{ productId: 'p-1', quantity: 1.5 }]
    await expect(salvarLancamento('2026-06-06', itens)).rejects.toThrow('Quantidade inválida')
  })

  it('faz upsert com snapshot de preço e custo para quantity > 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.upsert).mockResolvedValue({} as any)

    await salvarLancamento('2026-06-06', [{ productId: 'p-1', quantity: 12 }])

    expect(prisma.sale.upsert).toHaveBeenCalledWith({
      where: { userId_productId_date: { userId: 'user-1', productId: 'p-1', date: new Date('2026-06-06') } },
      update: { quantity: 12, unitPrice: 18.0, unitCost: 9.0 },
      create: { userId: 'user-1', productId: 'p-1', date: new Date('2026-06-06'), quantity: 12, unitPrice: 18.0, unitCost: 9.0 },
    })
  })

  it('remove linha existente quando quantity === 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.deleteMany).mockResolvedValue({ count: 1 })

    await salvarLancamento('2026-06-06', [{ productId: 'p-1', quantity: 0 }])

    expect(prisma.sale.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', productId: 'p-1', date: new Date('2026-06-06') },
    })
    expect(prisma.sale.upsert).not.toHaveBeenCalled()
  })

  it('rejeita produto que não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)

    await expect(
      salvarLancamento('2026-06-06', [{ productId: 'p-outro', quantity: 5 }])
    ).rejects.toThrow('Produto não encontrado')
  })

  it('revalida dashboard, lancamento e estoque após salvar', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.upsert).mockResolvedValue({} as any)

    await salvarLancamento('2026-06-06', [{ productId: 'p-1', quantity: 5 }])

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
    expect(revalidatePath).toHaveBeenCalledWith('/lancamento')
    expect(revalidatePath).toHaveBeenCalledWith('/estoque')
  })
})
