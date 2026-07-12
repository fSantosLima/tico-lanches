import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

async function actions() {
  return import('@/app/(protected)/insumos/actions')
}

beforeEach(() => vi.clearAllMocks())

describe('criarInsumo', () => {
  it('erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { criarInsumo } = await actions()
    await expect(criarInsumo(null, new FormData())).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('erro se campo obrigatório ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { criarInsumo } = await actions()
    const fd = new FormData()
    fd.set('name', 'Carne')
    // unit e cost ausentes
    await expect(criarInsumo(null, fd)).resolves.toEqual({ error: 'Campos obrigatórios ausentes' })
  })

  it('erro se unidade inválida', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { criarInsumo } = await actions()
    const fd = new FormData()
    fd.set('name', 'Carne')
    fd.set('unit', 'toneladas')
    fd.set('cost', '30')
    await expect(criarInsumo(null, fd)).resolves.toEqual({ error: 'Unidade inválida' })
  })

  it('erro se custo negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { criarInsumo } = await actions()
    const fd = new FormData()
    fd.set('name', 'Carne')
    fd.set('unit', 'kg')
    fd.set('cost', '-1')
    await expect(criarInsumo(null, fd)).resolves.toEqual({ error: 'Custo inválido' })
  })

  it('cria insumo e redireciona para /insumos', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.create).mockResolvedValue({} as any)
    const { criarInsumo } = await actions()
    const fd = new FormData()
    fd.set('name', 'Carne')
    fd.set('unit', 'kg')
    fd.set('cost', '30')
    fd.set('minStock', '2')
    await criarInsumo(null, fd)
    expect(prisma.insumo.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', name: 'Carne', unit: 'kg', cost: 30, minStock: 2 },
    })
    expect(redirect).toHaveBeenCalledWith('/insumos')
  })
})

describe('registrarEntradaInsumo', () => {
  it('erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { registrarEntradaInsumo } = await actions()
    await expect(registrarEntradaInsumo(null, new FormData())).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('erro se quantidade <= 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntradaInsumo } = await actions()
    const fd = new FormData()
    fd.set('insumoId', 'i1')
    fd.set('date', '2026-07-12')
    fd.set('quantity', '0')
    await expect(registrarEntradaInsumo(null, fd)).resolves.toEqual({ error: 'Quantidade inválida' })
  })

  it('erro se data é futura', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { registrarEntradaInsumo } = await actions()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const fd = new FormData()
    fd.set('insumoId', 'i1')
    fd.set('date', tomorrow.toISOString().slice(0, 10))
    fd.set('quantity', '5')
    await expect(registrarEntradaInsumo(null, fd)).resolves.toEqual({ error: 'Data inválida' })
  })

  it('erro se insumo não pertence ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue(null)
    const { registrarEntradaInsumo } = await actions()
    const fd = new FormData()
    fd.set('insumoId', 'i1')
    fd.set('date', '2026-07-12')
    fd.set('quantity', '5')
    await expect(registrarEntradaInsumo(null, fd)).resolves.toEqual({ error: 'Insumo não encontrado' })
  })

  it('aceita quantidade fracionária e persiste', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.findFirst).mockResolvedValue({ id: 'i1', userId: 'user-1' } as any)
    vi.mocked(prisma.insumoEntry.create).mockResolvedValue({} as any)
    const { registrarEntradaInsumo } = await actions()
    const fd = new FormData()
    fd.set('insumoId', 'i1')
    fd.set('date', '2026-07-12')
    fd.set('quantity', '1.5')
    fd.set('note', 'Compra atacado')
    const result = await registrarEntradaInsumo(null, fd)
    expect(result).toBeNull()
    expect(prisma.insumoEntry.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', insumoId: 'i1', date: new Date('2026-07-12'), quantity: 1.5, note: 'Compra atacado' },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/insumos')
  })
})

describe('removerEntradaInsumo', () => {
  it('lança se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const { removerEntradaInsumo } = await actions()
    await expect(removerEntradaInsumo('e1')).rejects.toThrow('Não autorizado')
  })

  it('lança se entrada não encontrada', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumoEntry.deleteMany).mockResolvedValue({ count: 0 } as any)
    const { removerEntradaInsumo } = await actions()
    await expect(removerEntradaInsumo('e1')).rejects.toThrow('Entrada não encontrada')
  })

  it('remove a entrada escopada ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumoEntry.deleteMany).mockResolvedValue({ count: 1 } as any)
    const { removerEntradaInsumo } = await actions()
    await removerEntradaInsumo('e1')
    expect(prisma.insumoEntry.deleteMany).toHaveBeenCalledWith({ where: { id: 'e1', userId: 'user-1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/insumos')
  })
})

describe('definirMinimoInsumo', () => {
  it('lança se mínimo negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { definirMinimoInsumo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '-1')
    await expect(definirMinimoInsumo('i1', fd)).rejects.toThrow('Estoque mínimo inválido')
  })

  it('atualiza o mínimo (aceita fracionário) escopado ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.updateMany).mockResolvedValue({ count: 1 } as any)
    const { definirMinimoInsumo } = await actions()
    const fd = new FormData()
    fd.set('minStock', '0.5')
    await definirMinimoInsumo('i1', fd)
    expect(prisma.insumo.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', userId: 'user-1' },
      data: { minStock: 0.5 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/insumos')
  })
})

describe('definirCustoInsumo', () => {
  it('lança se custo negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const { definirCustoInsumo } = await actions()
    const fd = new FormData()
    fd.set('cost', '-5')
    await expect(definirCustoInsumo('i1', fd)).rejects.toThrow('Custo inválido')
  })

  it('atualiza o custo escopado ao userId', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.insumo.updateMany).mockResolvedValue({ count: 1 } as any)
    const { definirCustoInsumo } = await actions()
    const fd = new FormData()
    fd.set('cost', '32.5')
    await definirCustoInsumo('i1', fd)
    expect(prisma.insumo.updateMany).toHaveBeenCalledWith({
      where: { id: 'i1', userId: 'user-1' },
      data: { cost: 32.5 },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/insumos')
  })
})
