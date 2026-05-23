import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '@/app/api/register/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// POST /api/register is a public endpoint — no session mock needed

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}))

beforeEach(() => vi.clearAllMocks())

function makeRequest(body: object) {
  return new Request('http://localhost/api/register', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

describe('POST /api/register', () => {
  it('retorna 400 se email estiver ausente', async () => {
    const res = await POST(makeRequest({ password: 'senha123' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('retorna 400 se password estiver ausente', async () => {
    const res = await POST(makeRequest({ email: 'a@a.com' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('retorna 400 se senha tiver menos de 6 caracteres', async () => {
    const res = await POST(makeRequest({ email: 'a@a.com', password: '123' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toMatch(/6/)
  })

  it('retorna 409 se email já estiver cadastrado', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'u1', email: 'a@a.com', name: null, password: 'hash', createdAt: new Date(),
    } as any)

    const res = await POST(makeRequest({ email: 'a@a.com', password: 'senha123' }))
    expect(res.status).toBe(409)
    const data = await res.json()
    expect(data.error).toBeDefined()
  })

  it('cria usuário com senha hasheada e retorna 201 com id e email', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'u1', email: 'novo@a.com', name: 'Novo', password: 'hashed_password', createdAt: new Date(),
    } as any)

    const res = await POST(makeRequest({ email: 'novo@a.com', password: 'senha123', name: 'Novo' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.id).toBe('u1')
    expect(data.email).toBe('novo@a.com')
    expect(data.password).toBeUndefined()
  })

  it('não expõe a senha hasheada na resposta', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'u1', email: 'novo@a.com', name: null, password: 'hashed_password', createdAt: new Date(),
    } as any)

    const res = await POST(makeRequest({ email: 'novo@a.com', password: 'senha123' }))
    const data = await res.json()
    expect(data.password).toBeUndefined()
  })

  it('armazena a senha hasheada (não o texto puro)', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
    vi.mocked(bcrypt.hash).mockResolvedValue('hashed_password' as never)
    vi.mocked(prisma.user.create).mockResolvedValue({
      id: 'u1', email: 'novo@a.com', name: null, password: 'hashed_password', createdAt: new Date(),
    } as any)

    await POST(makeRequest({ email: 'novo@a.com', password: 'senha123' }))

    expect(bcrypt.hash).toHaveBeenCalledWith('senha123', 10)
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ password: 'hashed_password' }),
    })
  })
})
