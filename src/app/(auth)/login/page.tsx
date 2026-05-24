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
