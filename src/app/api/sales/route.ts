import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await request.json()
  const { productId } = body

  if (!productId) {
    return NextResponse.json({ error: 'productId é obrigatório' }, { status: 400 })
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, userId: session.user.id },
  })

  if (!product) {
    return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 })
  }

  const sale = await prisma.sale.create({
    data: { productId, userId: session.user.id, value: product.price },
  })

  return NextResponse.json(sale, { status: 201 })
}
