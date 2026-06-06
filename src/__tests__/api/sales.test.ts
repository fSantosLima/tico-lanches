import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/sales/today/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

beforeEach(() => vi.clearAllMocks())

describe('GET /api/sales/today', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/sales/today'))
    expect(res.status).toBe(401)
  })

  it('retorna faturamento e lucro calculados das vendas de hoje', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockSales = [
      { id: 's1', quantity: 10, unitPrice: 18.0, unitCost: 9.0, date: new Date(), product: { name: 'X-Burguer' } },
      { id: 's2', quantity: 5,  unitPrice: 6.0,  unitCost: 2.0, date: new Date(), product: { name: 'Refri' } },
    ]
    vi.mocked(prisma.sale.findMany).mockResolvedValue(mockSales as any)

    const res = await GET(new Request('http://localhost/api/sales/today'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.faturamento).toBeCloseTo(210.0)
    expect(data.lucro).toBeCloseTo(110.0)
    expect(data.sales).toHaveLength(2)
  })

  it('retorna zeros quando não há vendas hoje', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.sale.findMany).mockResolvedValue([])

    const res = await GET(new Request('http://localhost/api/sales/today'))
    const data = await res.json()

    expect(data.faturamento).toBe(0)
    expect(data.lucro).toBe(0)
  })
})
