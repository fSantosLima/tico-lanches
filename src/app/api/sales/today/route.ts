import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { calcularResumo } from '@/lib/totals'

export async function GET(_req?: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const sales = await prisma.sale.findMany({
    where: { userId: session.user.id, date: today },
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const { faturamento, lucro } = calcularResumo(sales)
  return NextResponse.json({ sales, faturamento, lucro })
}
