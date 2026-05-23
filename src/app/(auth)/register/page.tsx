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
      <h1 className="text-2xl font-bold text-center mb-6">Criar Conta</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome (opcional)</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
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
      <p className="text-center text-sm mt-4">
        Já tem conta?{' '}
        <Link href="/login" className="text-orange-500 font-medium">
          Entrar
        </Link>
      </p>
    </>
  )
}
