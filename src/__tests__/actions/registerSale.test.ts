import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerSale } from '@/app/(protected)/dashboard/actions'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }
const mockProduct = { id: 'product-1', userId: 'user-1', name: 'X-Burguer', price: 18.0, cost: 10.0, createdAt: new Date() }

beforeEach(() => vi.clearAllMocks())

describe('registerSale', () => {
  it('lança erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)

    await expect(registerSale('product-1')).rejects.toThrow('Não autorizado')
  })

  it('lança erro se produto não existir ou não pertencer ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)

    await expect(registerSale('product-1')).rejects.toThrow('Produto não encontrado')
  })

  it('busca produto filtrando por userId para garantir isolamento de dados', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)

    await expect(registerSale('product-1')).rejects.toThrow()

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 'product-1', userId: 'user-1' },
    })
  })

  it('cria venda com snapshot do preço do produto no momento da venda', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.create).mockResolvedValue({} as any)

    await registerSale('product-1')

    expect(prisma.sale.create).toHaveBeenCalledWith({
      data: { productId: 'product-1', userId: 'user-1', value: 18.0 },
    })
  })

  it('revalida o cache do dashboard após registrar venda', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.create).mockResolvedValue({} as any)

    await registerSale('product-1')

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard')
  })

  it('propaga erro do banco ao criar venda', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.create).mockRejectedValue(new Error('DB error'))

    await expect(registerSale('product-1')).rejects.toThrow('DB error')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
