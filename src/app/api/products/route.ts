import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(products)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { name, price, cost } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  }
  if (!price || price <= 0) {
    return NextResponse.json({ error: 'Preço deve ser maior que zero' }, { status: 400 })
  }
  if (cost === undefined || cost < 0) {
    return NextResponse.json({ error: 'Custo inválido' }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: { name: name.trim(), price, cost, userId: session.user.id },
  })

  return NextResponse.json(product, { status: 201 })
}
