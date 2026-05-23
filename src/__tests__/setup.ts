import { vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    sale: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))
