// Seed de massa de dados para testes — vendas e gastos de jan/2026 até hoje.
//
// Características:
//  - Determinístico: usa um PRNG semeado por data/produto, então rodar de novo
//    gera exatamente os mesmos números (sem "ruído" aleatório a cada execução).
//  - Idempotente: apaga vendas e gastos do usuário no intervalo semeado antes de
//    inserir, então pode ser executado quantas vezes quiser sem duplicar.
//  - Realista: loja fecha aos domingos, movimento maior sex/sáb, crescimento mês
//    a mês, e gastos operacionais (reposição) por categoria toda semana.
//
// Uso:
//   node --env-file=.env prisma/seed.mjs

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

// ---------- PRNG determinístico (FNV-1a + mulberry32) ----------
function hashStr(s) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = (...keys) => mulberry32(hashStr(keys.join('|')))
// fator de ruído ±pct determinístico
const noise = (r, pct) => 1 + (r() * 2 - 1) * pct

// ---------- datas ----------
const utc = (y, m, d) => new Date(Date.UTC(y, m, d))
const iso = (d) => d.toISOString().slice(0, 10)
const start = utc(2026, 0, 1) // 1 jan 2026
const now = new Date()
const today = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

// ---------- parâmetros de venda por produto ----------
// quantidade-base diária por nome de produto (fallback = 6)
const BASE_QTY = {
  Coxinha: 15,
  Kibe: 12,
  Hamburguer: 10,
  Empadão: 8,
  'Mini Pizza': 6,
  'Bolo variados': 4,
  'Bolinho de Aipim': 7,
  Café: 22,
  'Sacolé Sabores': 8,
}
// multiplicador por dia da semana (0=dom ... 6=sáb)
const WEEKDAY_MULT = [0, 0.9, 0.9, 1.0, 1.0, 1.3, 1.5]
// crescimento mensal acumulado (jan=0): ~3,5% ao mês
const monthIndex = (d) => (d.getUTCFullYear() - 2026) * 12 + d.getUTCMonth()
const growthFor = (d) => 1 + 0.035 * monthIndex(d)

async function main() {
  const user = await prisma.user.findFirst({
    where: { products: { some: {} } },
    include: { products: { orderBy: { name: 'asc' } } },
  })
  if (!user) throw new Error('Nenhum usuário com produtos cadastrados encontrado.')
  console.log(`Semeando dados para: ${user.name} <${user.email}>`)
  console.log(`Produtos: ${user.products.map((p) => p.name).join(', ')}`)
  console.log(`Intervalo: ${iso(start)} → ${iso(today)}\n`)

  // limpa o intervalo semeado (idempotência)
  const delSales = await prisma.sale.deleteMany({
    where: { userId: user.id, date: { gte: start, lte: today } },
  })
  const delExp = await prisma.expense.deleteMany({
    where: { userId: user.id, date: { gte: start, lte: today } },
  })
  console.log(`Limpeza: ${delSales.count} vendas e ${delExp.count} gastos antigos removidos no intervalo.`)

  const sales = []
  const expenses = []

  for (let d = new Date(start); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = new Date(d)
    const dow = day.getUTCDay()
    const ds = iso(day)

    // fechado aos domingos
    if (dow === 0) continue
    // feriado/folga eventual (~4% dos dias úteis), determinístico
    if (rng(ds, 'aberto')() < 0.04) continue

    const growth = growthFor(day)
    const wmult = WEEKDAY_MULT[dow]

    // ----- vendas do dia -----
    for (const p of user.products) {
      const base = BASE_QTY[p.name] ?? 6
      const r = rng(ds, p.name, 'qtd')
      // produtos eventualmente não vendem em um dia fraco
      if (wmult <= 0.9 && r() < 0.08) continue
      const qty = Math.max(0, Math.round(base * wmult * growth * noise(r, 0.25)))
      if (qty <= 0) continue
      sales.push({
        productId: p.id,
        userId: user.id,
        date: day,
        quantity: qty,
        unitPrice: p.price,
        unitCost: p.cost,
      })
    }

    // ----- gastos operacionais (reposição) -----
    // concentrados nas segundas-feiras
    if (dow === 1) {
      const g = growth
      const push = (category, description, quantity, unit, value) =>
        expenses.push({
          userId: user.id,
          date: day,
          category,
          description,
          quantity: Math.round(quantity * 100) / 100,
          unit,
          value: Math.round(value * 100) / 100,
        })

      // Ingredientes (toda segunda)
      push('Ingredientes', 'Massa de mandioca', 18 * g, 'kg', 150 * g * noise(rng(ds, 'mandioca'), 0.15))
      push('Ingredientes', 'Frango', 14 * g, 'kg', 230 * g * noise(rng(ds, 'frango'), 0.15))
      push('Ingredientes', 'Farinha de trigo', 9 * g, 'kg', 55 * g * noise(rng(ds, 'farinha'), 0.15))
      push('Ingredientes', 'Óleo de soja', 8, 'L', 84 * noise(rng(ds, 'oleo'), 0.15))
      push('Ingredientes', 'Queijo / recheios', 6 * g, 'kg', 130 * g * noise(rng(ds, 'queijo'), 0.15))

      // Descartáveis (toda segunda)
      push('Descartáveis', 'Embalagens / sacos', 400 * g, 'un', 120 * g * noise(rng(ds, 'emb'), 0.2))
      push('Descartáveis', 'Guardanapos', 16, 'pct', 48 * noise(rng(ds, 'guard'), 0.2))

      const weekOfMonth = Math.floor((day.getUTCDate() - 1) / 7) + 1
      // Salgados prontos (2ª e 4ª segunda do mês)
      if (weekOfMonth === 2 || weekOfMonth === 4) {
        push('Salgados prontos', 'Coxinha congelada (cento)', 1, 'cento', 150 * g * noise(rng(ds, 'congelado'), 0.1))
      }
      // Outros (1ª segunda do mês): gás + limpeza
      if (weekOfMonth === 1) {
        push('Outros', 'Gás de cozinha (botijão)', 1, 'un', 120 * noise(rng(ds, 'gas'), 0.08))
        push('Outros', 'Material de limpeza', 1, 'kit', 45 * noise(rng(ds, 'limpeza'), 0.2))
      }
    }
  }

  // inserção em massa
  const insSales = await prisma.sale.createMany({ data: sales })
  const insExp = await prisma.expense.createMany({ data: expenses })

  // ----- resumo -----
  const faturamento = sales.reduce((s, x) => s + x.quantity * x.unitPrice, 0)
  const custoProdutos = sales.reduce((s, x) => s + x.quantity * x.unitCost, 0)
  const gastos = expenses.reduce((s, x) => s + x.value, 0)
  const fmt = (n) => 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  console.log(`\nInserido: ${insSales.count} vendas (linhas dia/produto) e ${insExp.count} gastos.`)
  console.log('\n--- Resumo do período semeado ---')
  console.log(`Faturamento:        ${fmt(faturamento)}`)
  console.log(`Gastos reais:       ${fmt(gastos)}`)
  console.log(`Lucro real:         ${fmt(faturamento - gastos)}  (faturamento − gastos)`)
  console.log(`Custo de produtos:  ${fmt(custoProdutos)}  (snapshot unitCost, p/ referência)`)

  // faturamento por mês (sanity)
  const porMes = {}
  for (const x of sales) {
    const k = iso(x.date).slice(0, 7)
    porMes[k] = (porMes[k] || 0) + x.quantity * x.unitPrice
  }
  console.log('\nFaturamento por mês:')
  for (const k of Object.keys(porMes).sort()) console.log(`  ${k}: ${fmt(porMes[k])}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
