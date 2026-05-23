import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { calcularTotalDia } from '@/lib/totals'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const sales = await prisma.sale.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ sales, total: calcularTotalDia(sales) })
}
