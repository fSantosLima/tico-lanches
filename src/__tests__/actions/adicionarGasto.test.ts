import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

async function importAction() {
  const { adicionarGasto } = await import('@/app/(protected)/gastos/actions')
  return adicionarGasto
}

beforeEach(() => vi.clearAllMocks())

describe('adicionarGasto', () => {
  it('retorna erro se não autenticado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    await expect(adicionarGasto(null, fd)).resolves.toEqual({ error: 'Não autorizado' })
  })

  it('retorna erro se data é futura', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const fd = new FormData()
    fd.set('date', tomorrow.toISOString().slice(0, 10))
    fd.set('category', 'Ingredientes')
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    await expect(adicionarGasto(null, fd)).resolves.toEqual({ error: 'Data inválida' })
  })

  it('retorna erro se category inválida', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    fd.set('category', 'Categoria Inválida')
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    await expect(adicionarGasto(null, fd)).resolves.toEqual({ error: 'Categoria inválida' })
  })

  it('retorna erro se value <= 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    fd.set('category', 'Ingredientes')
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '0')
    await expect(adicionarGasto(null, fd)).resolves.toEqual({ error: 'Valor inválido' })
  })

  it('retorna erro se quantity <= 0', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    fd.set('category', 'Ingredientes')
    fd.set('description', 'Frango')
    fd.set('quantity', '0')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    await expect(adicionarGasto(null, fd)).resolves.toEqual({ error: 'Quantidade inválida' })
  })

  it('retorna erro se campo obrigatório ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    // category ausente
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    await expect(adicionarGasto(null, fd)).resolves.toEqual({ error: 'Campos obrigatórios ausentes' })
  })

  it('persiste o gasto com userId da sessão e retorna null', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.expense.create).mockResolvedValue({} as any)
    const adicionarGasto = await importAction()
    const fd = new FormData()
    fd.set('date', '2026-06-07')
    fd.set('category', 'Ingredientes')
    fd.set('description', 'Frango')
    fd.set('quantity', '3')
    fd.set('unit', 'kg')
    fd.set('value', '90')
    const result = await adicionarGasto(null, fd)
    expect(result).toBeNull()
    expect(prisma.expense.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        date: new Date('2026-06-07'),
        category: 'Ingredientes',
        description: 'Frango',
        quantity: 3,
        unit: 'kg',
        value: 90,
      },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/gastos')
  })
})
