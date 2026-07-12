import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

async function actions() {
  return import('@/app/(protected)/products/[id]/actions')
}

beforeEach(() => vi.clearAllMocks())

describe('adicionarItemReceita', () => {
  it('erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { adicionarItemReceita } = await actions()
    await expect(adicionarItemReceita(null, new FormData())).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('erro se quantidade <= 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0')
    await expect(adicionarItemReceita(null, fd)).resolves.toEqual({ error: 'Quantidade inválida' })
  })

  it('erro se produto não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0.2')
    await expect(adicionarItemReceita(null, fd)).resolves.toEqual({ error: 'Produto não encontrado' })
  })

  it('erro se insumo não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'p1', userId: 'user-1' } as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue(null)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0.2')
    await expect(adicionarItemReceita(null, fd)).resolves.toEqual({ error: 'Insumo não encontrado' })
  })

  it('erro se o insumo já está na ficha técnica', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'p1', userId: 'user-1' } as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue({ id: 'i1', userId: 'user-1' } as any)
    vi.mocked(prisma.recipeItem.findFirst).mockResolvedValue({ id: 'r1' } as any)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0.2')
    await expect(adicionarItemReceita(null, fd)).resolves.toEqual({ error: 'Insumo já está na ficha técnica' })
  })

  it('cria o item e revalida a página do produto', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'p1', userId: 'user-1' } as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue({ id: 'i1', userId: 'user-1' } as any)
    vi.mocked(prisma.recipeItem.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.recipeItem.create).mockResolvedValue({} as any)
    const { adicionarItemReceita } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('insumoId', 'i1')
    fd.set('quantity', '0.2')
    const result = await adicionarItemReceita(null, fd)
    expect(result).toBeNull()
    expect(prisma.recipeItem.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', productId: 'p1', insumoId: 'i1', quantity: 0.2 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/products/p1')
  })
})

describe('removerItemReceita', () => {
  it('lança se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerItemReceita } = await actions()
    await expect(removerItemReceita('r1', 'p1')).rejects.toThrow('Não autorizado')
  })

  it('lança se item não encontrado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.recipeItem.deleteMany).mockResolvedValue({ count: 0 } as any)
    const { removerItemReceita } = await actions()
    await expect(removerItemReceita('r1', 'p1')).rejects.toThrow('Item não encontrado')
  })

  it('remove o item escopado ao userId e revalida a página do produto', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.recipeItem.deleteMany).mockResolvedValue({ count: 1 } as any)
    const { removerItemReceita } = await actions()
    await removerItemReceita('r1', 'p1')
    expect(prisma.recipeItem.deleteMany).toHaveBeenCalledWith({ where: { id: 'r1', userId: 'user-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/products/p1')
  })
})
