'use client'

import { useState, useTransition } from 'react'
import { salvarLancamento } from './actions'
import { calcularResumo } from '@/lib/totals'

interface Produto {
  id: string
  name: string
  price: number
  cost: number
}

interface LancamentoFormProps {
  produtos: Produto[]
  dateStr: string        // 'YYYY-MM-DD'
  initialQtds: Record<string, number>  // productId → quantity already saved
}

export function LancamentoForm({ produtos, dateStr, initialQtds }: LancamentoFormProps) {
  const [qtds, setQtds] = useState<Record<string, number>>(initialQtds)
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  function getQtd(id: string) { return qtds[id] ?? 0 }

  function setQtd(id: string, val: number) {
    const safe = Math.max(0, Math.floor(val))
    setQtds(prev => ({ ...prev, [id]: safe }))
  }

  function handleInput(id: string, raw: string) {
    const n = parseInt(raw.replace(/\D/g, ''), 10)
    setQtd(id, isNaN(n) ? 0 : n)
  }

  const salesForCalc = produtos.map(p => ({
    quantity: getQtd(p.id),
    unitPrice: p.price,
    unitCost: p.cost,
  }))
  const { faturamento, lucro } = calcularResumo(salesForCalc)

  function handleSalvar() {
    startTransition(async () => {
      try {
        const itens = produtos.map(p => ({ productId: p.id, quantity: getQtd(p.id) }))
        await salvarLancamento(dateStr, itens)
        setStatus('success')
        setTimeout(() => setStatus('idle'), 2000)
      } catch {
        setStatus('error')
        setTimeout(() => setStatus('idle'), 2000)
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {produtos.map(p => (
        <div
          key={p.id}
          className="flex items-center justify-between bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl px-4 py-3"
        >
          <div>
            <p className="font-semibold dark:text-slate-100">{p.name}</p>
            <p className="text-sm text-gray-400 dark:text-slate-500">R$ {p.price.toFixed(2)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQtd(p.id, getQtd(p.id) - 1)}
              disabled={getQtd(p.id) === 0}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-xl disabled:opacity-30"
            >
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={getQtd(p.id)}
              onChange={e => handleInput(p.id, e.target.value)}
              className="w-14 h-9 rounded-lg border dark:border-slate-600 bg-white dark:bg-slate-900 text-center font-bold text-lg dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={() => setQtd(p.id, getQtd(p.id) + 1)}
              className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 font-bold text-xl"
            >
              +
            </button>
          </div>
        </div>
      ))}

      <div className="bg-gray-50 dark:bg-slate-900 border dark:border-slate-700 rounded-xl px-4 py-3 mt-1">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-gray-500 dark:text-slate-400">Faturamento</span>
          <span className="text-2xl font-bold text-green-600">R$ {faturamento.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-baseline mt-1">
          <span className="text-sm text-gray-500 dark:text-slate-400">Lucro estimado</span>
          <span className="text-base font-semibold text-emerald-500">R$ {lucro.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={handleSalvar}
        disabled={isPending}
        className={`w-full py-4 rounded-xl font-bold text-lg text-white transition-all disabled:opacity-50 ${
          status === 'success' ? 'bg-green-500' :
          status === 'error'   ? 'bg-red-500' :
                                 'bg-orange-500'
        }`}
      >
        {isPending       ? 'Salvando...' :
         status === 'success' ? '✓ Salvo!' :
         status === 'error'   ? '✗ Erro ao salvar' :
                                'Salvar dia'}
      </button>
    </div>
  )
}
