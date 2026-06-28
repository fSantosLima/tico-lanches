import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST } from '@/app/api/products/route'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const mockSession = { user: { id: 'user-1', email: 'test@test.com' } }

beforeEach(() => vi.clearAllMocks())

describe('GET /api/products', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/products'))
    expect(res.status).toBe(401)
  })

  it('retorna produtos do usuário logado', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockProducts = [
      { id: 'p1', name: 'X-Burguer', price: 12.0, cost: 5.0, userId: 'user-1' },
    ]
    vi.mocked(prisma.product.findMany).mockResolvedValue(mockProducts as any)

    const res = await GET(new Request('http://localhost/api/products'))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual(mockProducts)
    expect(prisma.product.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('POST /api/products', () => {
  it('retorna 401 sem sessão', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12, cost: 5 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('retorna 400 se name estiver ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ price: 12, cost: 5 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 400 se cost estiver ausente', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 400 se cost for negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12, cost: -1 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 400 se price for zero ou negativo', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 0, cost: 5 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('cria produto e retorna 201 (minStock default 0)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const mockProduct = { id: 'p1', name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 0, userId: 'user-1' }
    vi.mocked(prisma.product.create).mockResolvedValue(mockProduct as any)

    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12.0, cost: 5.0 }),
    })
    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data).toEqual(mockProduct)
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: { name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 0, userId: 'user-1' },
    })
  })

  it('aceita minStock inteiro e o persiste', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    vi.mocked(prisma.product.create).mockResolvedValue({} as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 10 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(prisma.product.create).toHaveBeenCalledWith({
      data: { name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 10, userId: 'user-1' },
    })
  })

  it('retorna 400 se minStock for negativo ou não inteiro', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: -3 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('retorna 400 se minStock não for inteiro', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession as any)
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'X-Burguer', price: 12.0, cost: 5.0, minStock: 1.5 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
