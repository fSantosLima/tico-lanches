import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

async function actions() {
  return import('@/app/(protected)/estoque/actions')
}

beforeEach(() => vi.clearAllMocks())

describe('registrarEntrada', () => {
  it('erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { registrarEntrada } = await actions()
    await expect(registrarEntrada(null, new FormData())).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('erro se campo obrigatório ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntrada } = await actions()
    const fd = new FormData()
    fd.set('date', '2026-06-28')
    fd.set('quantity', '10')
    // productId ausente
    await expect(registrarEntrada(null, fd)).resolves.toEqual({ error: 'Campos obrigatórios ausentes' })
  })

  it('erro se data é futura', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntrada } = await actions()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('date', tomorrow.toISOString().slice(0, 10))
    fd.set('quantity', '10')
    await expect(registrarEntrada(null, fd)).resolves.toEqual({ error: 'Data inválida' })
  })

  it('erro se quantity não é inteiro positivo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntrada } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('date', '2026-06-28')
    fd.set('quantity', '2.5')
    await expect(registrarEntrada(null, fd)).resolves.toEqual({ error: 'Quantidade inválida' })
  })

  it('erro se produto não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)
    const { registrarEntrada } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('date', '2026-06-28')
    fd.set('quantity', '10')
    await expect(registrarEntrada(null, fd)).resolves.toEqual({ error: 'Produto não encontrado' })
  })

  it('persiste a entrada e retorna null', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue({ id: 'p1', userId: 'user-1' } as any)
    vi.mocked(prisma.stockEntry.create).mockResolvedValue({} as any)
    const { registrarEntrada } = await actions()
    const fd = new FormData()
    fd.set('productId', 'p1')
    fd.set('date', '2026-06-28')
    fd.set('quantity', '10')
    fd.set('note', 'Reposição')
    const result = await registrarEntrada(null, fd)
    expect(result).toBeNull()
    expect(prisma.stockEntry.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', productId: 'p1', date: new Date('2026-06-28'), quantity: 10, note: 'Reposição' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/estoque')
  })
})

describe('removerEntrada', () => {
  it('lança se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerEntrada } = await actions()
    await expect(removerEntrada('e1')).rejects.toThrow('Não autorizado')
  })

  it('lança se entrada não encontrada para o usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.stockEntry.deleteMany).mockResolvedValue({ count: 0 } as any)
    const { removerEntrada } = await actions()
    await expect(removerEntrada('e1')).rejects.toThrow('Entrada não encontrada')
  })

  it('remove a entrada escopada ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.stockEntry.deleteMany).mockResolvedValue({ count: 1 } as any)
    const { removerEntrada } = await actions()
    await removerEntrada('e1')
    expect(prisma.stockEntry.deleteMany).toHaveBeenCalledWith({ where: { id: 'e1', userId: 'user-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/estoque')
  })
})

describe('definirEstoqueMinimo', () => {
  it('lança se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { definirEstoqueMinimo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '5')
    await expect(definirEstoqueMinimo('p1', fd)).rejects.toThrow('Não autorizado')
  })

  it('lança se mínimo é negativo ou não inteiro', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { definirEstoqueMinimo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '-1')
    await expect(definirEstoqueMinimo('p1', fd)).rejects.toThrow('Estoque mínimo inválido')
  })

  it('atualiza o mínimo escopado ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as any)
    const { definirEstoqueMinimo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '8')
    await definirEstoqueMinimo('p1', fd)
    expect(prisma.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', userId: 'user-1' },
      data: { minStock: 8 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/estoque')
  })
})
