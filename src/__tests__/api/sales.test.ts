import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/sales/route'
import { GET } from '@/app/api/sales/today/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

beforeEach(() => vi.clearAllMocks())

describe('POST /api/sales', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const req = new Request('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify({ productId: 'p1' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('retorna 400 se productId estiver ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 404 se produto não existir ou não pertencer ao usuário', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.findFirst).mockResolvedValue(null)

    const req = new Request('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify({ productId: 'p-inexistente' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(404)
  })

  it('registra venda com snapshot do preço e retorna 201', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockProduct = { id: 'p1', name: 'X-Burguer', price: 12.0, cost: 5.0, userId: 'user-1' }
    const mockSale = { id: 's1', productId: 'p1', userId: 'user-1', value: 12.0, createdAt: new Date() }
    vi.mocked(prisma.product.findFirst).mockResolvedValue(mockProduct as any)
    vi.mocked(prisma.sale.create).mockResolvedValue(mockSale as any)

    const req = new Request('http://localhost/api/sales', {
      method: 'POST',
      body: JSON.stringify({ productId: 'p1' }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.value).toBe(12.0)
    expect(prisma.sale.create).toHaveBeenCalledWith({
      data: { productId: 'p1', userId: 'user-1', value: 12.0 },
    })
  })
})

describe('GET /api/sales/today', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/sales/today'))
    expect(res.status).toBe(401)
  })

  it('retorna vendas de hoje e total', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const today = new Date()
    const mockSales = [
      { id: 's1', value: 12.0, createdAt: today, product: { name: 'X-Burguer' } },
      { id: 's2', value: 8.0, createdAt: today, product: { name: 'Suco' } },
    ]
    vi.mocked(prisma.sale.findMany).mockResolvedValue(mockSales as any)

    const res = await GET(new Request('http://localhost/api/sales/today'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.total).toBe(20.0)
    expect(data.sales).toHaveLength(2)
  })
})
