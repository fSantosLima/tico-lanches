'use client'

import { useState, useTransition } from 'react'
import { registerSale } from './actions'

interface ProductButtonProps {
  id: string
  name: string
  price: number
}

export function ProductButton({ id, name, price }: ProductButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<'idle' | 'success' | 'error'>('idle')

  function handleClick() {
    startTransition(async () => {
      try {
        await registerSale(id)
        setFeedback('success')
        setTimeout(() => setFeedback('idle'), 1500)
      } catch {
        setFeedback('error')
        setTimeout(() => setFeedback('idle'), 1500)
      }
    })
  }

  const colorClass =
    feedback === 'success' ? 'bg-green-500 text-white' :
    feedback === 'error'   ? 'bg-red-500 text-white' :
                             'bg-orange-500 text-white'

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`w-full py-6 rounded-2xl font-bold text-xl transition-all active:scale-95 disabled:opacity-50 ${colorClass}`}
    >
      <span className="block">{name}</span>
      <span className="block text-base font-normal mt-1">
        {feedback === 'success' ? '✓ Registrado!' :
         feedback === 'error'   ? '✗ Erro' :
                                  `R$ ${price.toFixed(2)}`}
      </span>
    </button>
  )
}
