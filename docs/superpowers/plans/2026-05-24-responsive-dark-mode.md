# Responsive Layout e Dark Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Tornar o app responsivo para desktop (sidebar lateral + grid expandido) e corrigir o dark mode com paleta slate, toggle manual e suporte ao sistema operacional.

**Architecture:** `next-themes` gerencia o `ThemeProvider` no layout raiz e persiste a escolha em `localStorage`, com fallback para `prefers-color-scheme`. O Tailwind v4 é configurado com `@custom-variant dark` para ativar variantes `dark:` via classe no `<html>`. Um `Sidebar` fixo aparece no desktop (`lg:`) com navegação, logout e o `ThemeToggle`.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, next-themes, NextAuth v4, TypeScript

---

## Mapa de arquivos

**Criados:**
- `src/components/ThemeToggle.tsx` — botão sol/lua, usa `useTheme()` do next-themes
- `src/components/Sidebar.tsx` — sidebar desktop com nav, logout e ThemeToggle

**Modificados:**
- `src/app/globals.css` — adiciona `@custom-variant dark`, remove variáveis CSS de dark mode
- `src/app/layout.tsx` — adiciona `ThemeProvider`, estrutura flex com `<Sidebar />`
- `src/app/dashboard/page.tsx` — remove `max-w-md`, dark mode, header mobile `lg:hidden`, grid responsivo
- `src/app/products/page.tsx` — remove `max-w-md`, dark mode nos cards, header mobile `lg:hidden`
- `src/app/products/new/page.tsx` — dark mode em inputs e labels
- `src/app/(auth)/layout.tsx` — dark mode no fundo e card central
- `src/app/(auth)/login/page.tsx` — dark mode em inputs e labels
- `src/app/(auth)/register/page.tsx` — dark mode em inputs e labels

---

## Task 1: Instalar next-themes e configurar Tailwind v4 dark mode

**Files:**
- Modify: `src/app/globals.css`

- [x] **Step 1: Instalar next-themes**

```bash
cd sistema-lanches
npm install next-themes
```

Saída esperada: pacote instalado sem erros, `next-themes` aparece em `package.json` em `dependencies`.

- [x] **Step 2: Atualizar globals.css**

Substituir o conteúdo completo do arquivo `src/app/globals.css` por:

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  font-family: Arial, Helvetica, sans-serif;
}
```

> **Por quê:** Tailwind v4 não usa `tailwind.config.js`. A diretiva `@custom-variant dark` ativa as classes `dark:` quando o elemento `<html>` tiver a classe `dark` (definida pelo next-themes). As variáveis CSS de dark mode do `:root` são removidas — o controle passa para as variantes `dark:` do Tailwind.

- [x] **Step 3: Verificar que o build não quebra**

```bash
npm run build
```

Saída esperada: build completo sem erros de CSS.

- [x] **Step 4: Commit**

```bash
git add src/app/globals.css package.json package-lock.json
git commit -m "feat: install next-themes and configure Tailwind v4 dark variant"
```

---

## Task 2: Criar ThemeToggle

**Files:**
- Create: `src/components/ThemeToggle.tsx`

- [x] **Step 1: Criar o componente**

Criar o arquivo `src/components/ThemeToggle.tsx`:

```tsx
'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="p-1 rounded text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
      aria-label="Alternar tema"
      title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
```

> **Por quê do `mounted`:** `next-themes` resolve o tema apenas no cliente (após hidratação). Renderizar o ícone no servidor causaria um mismatch de hidratação. O `useEffect` garante que o botão só aparece após o cliente saber qual tema está ativo.

- [x] **Step 2: Commit**

```bash
git add src/components/ThemeToggle.tsx
git commit -m "feat: add ThemeToggle component"
```

---

## Task 3: Criar Sidebar

**Files:**
- Create: `src/components/Sidebar.tsx`

- [x] **Step 1: Criar o componente**

Criar o arquivo `src/components/Sidebar.tsx`:

```tsx
import Link from 'next/link'
import { LogoutButton } from '@/app/dashboard/LogoutButton'
import { ThemeToggle } from './ThemeToggle'

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-52 min-h-screen bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 p-4 gap-6 shrink-0">
      <div className="flex items-center justify-between">
        <span className="font-bold text-orange-500 text-lg">🍔 Tico</span>
        <ThemeToggle />
      </div>

      <nav className="flex flex-col gap-3">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/products"
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
        >
          Produtos
        </Link>
      </nav>

      <div className="mt-auto">
        <LogoutButton />
      </div>
    </aside>
  )
}
```

> **Por quê `hidden lg:flex`:** A sidebar só aparece em telas `lg` (1024px+). No mobile, cada página tem seu próprio header inline.

- [x] **Step 2: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: add Sidebar component for desktop navigation"
```

---

## Task 4: Atualizar layout raiz com ThemeProvider e Sidebar

**Files:**
- Modify: `src/app/layout.tsx`

- [x] **Step 1: Atualizar layout.tsx**

Substituir o conteúdo completo de `src/app/layout.tsx` por:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Sidebar } from '@/components/Sidebar'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Tico Lanches',
  description: 'Sistema de vendas',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-w-0">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

> **Por quê `suppressHydrationWarning` no `<html>`:** `next-themes` modifica a classe do elemento `<html>` após a hidratação do React (para aplicar o tema correto sem flash). Sem esse atributo, o React emite um warning de mismatch de hidratação.
>
> **Por quê `min-w-0` no `<main>`:** Evita que o `flex-1` estoure a largura quando o conteúdo interno for mais largo que o espaço disponível.

- [x] **Step 2: Verificar o build**

```bash
npm run build
```

Saída esperada: build sem erros. A sidebar ainda não mostra links ativos porque as páginas ainda têm `max-w-md` — será corrigido nas tarefas seguintes.

- [x] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add ThemeProvider and Sidebar to root layout"
```

---

## Task 5: Atualizar dashboard — responsivo e dark mode

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [x] **Step 1: Substituir o conteúdo de dashboard/page.tsx**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularTotalDia } from '@/lib/totals'
import { ProductButton } from './ProductButton'
import { LogoutButton } from './LogoutButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const [products, sales] = await Promise.all([
    prisma.product.findMany({
      where: { userId: session!.user.id },
      orderBy: { name: 'asc' },
    }),
    prisma.sale.findMany({
      where: {
        userId: session!.user.id,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
  ])

  const totalDia = calcularTotalDia(sales)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      {/* Header mobile — oculto no desktop (sidebar assume a navegação) */}
      <div className="flex justify-between items-center mb-4 lg:hidden">
        <span className="text-gray-500 dark:text-slate-400 text-sm">
          {session?.user?.name ?? session?.user?.email}
        </span>
        <div className="flex items-center gap-3">
          <Link href="/products" className="text-orange-500 text-sm font-medium">
            Produtos
          </Link>
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 mb-6 text-center shadow-sm">
        <p className="text-gray-500 dark:text-slate-400 text-sm mb-1">Total de hoje</p>
        <p className="text-4xl font-bold text-green-600">
          R$ {totalDia.toFixed(2)}
        </p>
        <p className="text-gray-400 dark:text-slate-500 text-sm mt-1">
          {sales.length} venda{sales.length !== 1 ? 's' : ''}
        </p>
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-slate-400 mb-4">Nenhum produto cadastrado ainda.</p>
          <Link
            href="/products/new"
            className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Cadastrar primeiro produto
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {products.map(product => (
            <ProductButton
              key={product.id}
              id={product.id}
              name={product.name}
              price={product.price}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [x] **Step 2: Rodar os testes para garantir que nada quebrou**

```bash
npm run test
```

Saída esperada: todos os testes passam (os testes existentes são de API/lib, não de componentes).

- [x] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: make dashboard responsive and add dark mode"
```

---

## Task 6: Atualizar página de produtos — responsivo e dark mode

**Files:**
- Modify: `src/app/products/page.tsx`

- [x] **Step 1: Substituir o conteúdo de products/page.tsx**

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ThemeToggle } from '@/components/ThemeToggle'
import Link from 'next/link'

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  const products = await prisma.product.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="p-4 lg:p-6">
      {/* Header mobile — oculto no desktop */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <Link href="/dashboard" className="text-orange-500 text-sm">
          ← Dashboard
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold dark:text-slate-100">Produtos</h1>
        <Link
          href="/products/new"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          + Novo
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-gray-500 dark:text-slate-400 text-center py-8">
          Nenhum produto cadastrado.{' '}
          <Link href="/products/new" className="text-orange-500">
            Criar agora
          </Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {products.map(product => (
            <li
              key={product.id}
              className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-4"
            >
              <div className="flex justify-between items-start">
                <span className="font-medium dark:text-slate-100">{product.name}</span>
                <span className="text-green-600 font-bold">
                  R$ {product.price.toFixed(2)}
                </span>
              </div>
              <span className="text-gray-400 dark:text-slate-500 text-sm">
                Custo: R$ {product.cost.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 hidden lg:block">
        <Link href="/dashboard" className="text-orange-500 text-sm">
          ← Voltar ao dashboard
        </Link>
      </div>
    </div>
  )
}
```

- [x] **Step 2: Rodar os testes**

```bash
npm run test
```

Saída esperada: todos os testes passam.

- [x] **Step 3: Commit**

```bash
git add src/app/products/page.tsx
git commit -m "feat: make products page responsive and add dark mode"
```

---

## Task 7: Atualizar formulário de novo produto — dark mode

**Files:**
- Modify: `src/app/products/new/page.tsx`

- [x] **Step 1: Substituir o conteúdo de products/new/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeToggle } from '@/components/ThemeToggle'
import Link from 'next/link'

export default function NewProductPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        price: parseFloat(price),
        cost: parseFloat(cost),
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erro ao salvar produto')
      setLoading(false)
      return
    }

    router.push('/products')
  }

  return (
    <div className="p-4 lg:p-6">
      {/* Header mobile — oculto no desktop */}
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <Link href="/products" className="text-orange-500 text-lg">←</Link>
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-orange-500 text-lg hidden lg:inline">←</Link>
        <h1 className="text-xl font-bold dark:text-slate-100">Novo Produto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-200">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: X-Burguer"
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-200">Preço de venda (R$)</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-200">Custo (R$)</label>
          <input
            type="number"
            value={cost}
            onChange={e => setCost(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-4 rounded-xl font-semibold text-lg disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Produto'}
        </button>
      </form>
    </div>
  )
}
```

- [x] **Step 2: Commit**

```bash
git add src/app/products/new/page.tsx
git commit -m "feat: add dark mode to new product form"
```

---

## Task 8: Atualizar páginas de autenticação — dark mode

**Files:**
- Modify: `src/app/(auth)/layout.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`

- [x] **Step 1: Atualizar (auth)/layout.tsx**

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-md p-6">
        {children}
      </div>
    </div>
  )
}
```

- [x] **Step 2: Atualizar (auth)/login/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    if (result?.error) {
      setError('Email ou senha incorretos')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-center mb-6 dark:text-slate-100">Entrar</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-200">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-200">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="text-center text-sm mt-4 dark:text-slate-400">
        Não tem conta?{' '}
        <Link href="/register" className="text-orange-500 font-medium">
          Cadastrar
        </Link>
      </p>
    </>
  )
}
```

- [x] **Step 3: Atualizar (auth)/register/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Erro ao criar conta')
      setLoading(false)
      return
    }

    router.push('/login')
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-center mb-6 dark:text-slate-100">Criar Conta</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-200">Nome (opcional)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-200">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-slate-200">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
            minLength={6}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-base disabled:opacity-50"
        >
          {loading ? 'Criando conta...' : 'Criar Conta'}
        </button>
      </form>
      <p className="text-center text-sm mt-4 dark:text-slate-400">
        Já tem conta?{' '}
        <Link href="/login" className="text-orange-500 font-medium">
          Entrar
        </Link>
      </p>
    </>
  )
}
```

- [x] **Step 4: Rodar os testes**

```bash
npm run test
```

Saída esperada: todos os testes passam.

- [x] **Step 5: Commit final**

```bash
git add src/app/(auth)/layout.tsx src/app/(auth)/login/page.tsx src/app/(auth)/register/page.tsx
git commit -m "feat: add dark mode to auth pages"
```

---

## Correções pós-implementação (2026-05-24)

- **ThemeToggle:** Substituído `theme` por `resolvedTheme` — quando `defaultTheme="system"`, `theme` retorna `"system"` e nunca ativa o branch dark. `resolvedTheme` resolve a preferência do SO corretamente.
- **proxy.ts:** Next.js 16 deprecou a convenção `middleware.ts` em favor de `proxy.ts`. Arquivo renomeado sem alterações de conteúdo; warning eliminado do `npm run dev`.
- **Testes adicionados:** `registerSale.test.ts` com 6 casos (auth, produto não encontrado, isolamento por userId, snapshot de preço, revalidação de cache, propagação de erro do banco). Dois testes novos no `products.test.ts` (`cost` ausente, `cost` negativo).

---

## Verificação final

- [x] **Iniciar o servidor de desenvolvimento**

```bash
npm run dev
```

- [x] **Verificar no navegador (desktop, largura > 1024px)**

Abrir `http://localhost:3000`. Verificar:
- Sidebar aparece à esquerda com links Dashboard e Produtos
- Botão 🌙/☀️ visível no topo da sidebar
- Clicar no toggle alterna entre dark e light
- Recarregar a página mantém o tema escolhido
- Em dark mode: fundo slate-900, cards slate-800, textos claros

- [x] **Verificar no navegador (mobile, redimensionar < 1024px)**

- Sidebar desaparece
- Header inline aparece em cada página com links e toggle
- Layout em coluna única, igual ao original

- [x] **Verificar preferência do sistema**

- Mudar o tema do SO para dark → abrir o app em nova aba → deve carregar em dark mode automaticamente
- Clicar no toggle → muda manualmente → recarregar → mantém a escolha manual

- [x] **Commit de verificação (se necessário)**

Se algum ajuste fino for feito durante a verificação:

```bash
git add -p
git commit -m "fix: visual adjustments after manual verification"
```
