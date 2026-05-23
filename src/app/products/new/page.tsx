'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
    <div className="p-4 max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/products" className="text-orange-500 text-lg">←</Link>
        <h1 className="text-xl font-bold">Novo Produto</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nome</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: X-Burguer"
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Preço de venda (R$)</label>
          <input
            type="number"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0.01"
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Custo (R$)</label>
          <input
            type="number"
            value={cost}
            onChange={e => setCost(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            className="w-full border rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-400"
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
