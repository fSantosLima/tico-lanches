'use client'

import { useActionState, useEffect, useState } from 'react'
import { definirEstoqueMinimo } from './actions'

type State = { ok: true } | { ok: false; error: string } | null

interface Props {
  productId: string
  minimo: number
}

export function MinimoForm({ productId, minimo }: Props) {
  const [state, formAction, pending] = useActionState(
    async (_prev: State, formData: FormData): Promise<State> => {
      try {
        await definirEstoqueMinimo(productId, formData)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar' }
      }
    },
    null,
  )

  // Confirmação transitória de "salvo" (some após 2s). Derivamos a visibilidade
  // do estado + um marcador "dispensado" para não chamar setState de forma
  // síncrona dentro do efeito (só dentro do timeout).
  const [dismissed, setDismissed] = useState<State>(null)
  const showSaved = !!state?.ok && state !== dismissed
  useEffect(() => {
    if (showSaved) {
      const t = setTimeout(() => setDismissed(state), 2000)
      return () => clearTimeout(t)
    }
  }, [showSaved, state])

  return (
    <form action={formAction} className="flex items-center gap-1">
      <label className="text-xs text-gray-400 dark:text-slate-500">mín.</label>
      <input
        type="number"
        name="minStock"
        min="0"
        step="1"
        defaultValue={minimo}
        className="w-14 border dark:border-slate-600 rounded-lg px-2 py-1 text-sm dark:bg-slate-900 dark:text-slate-100"
      />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-orange-500 hover:text-orange-600 disabled:opacity-50"
      >
        {pending ? 'Salvando…' : 'Salvar'}
      </button>
      {showSaved && <span className="text-xs text-green-600">✓ salvo</span>}
      {state && !state.ok && <span className="text-xs text-red-500">{state.error}</span>}
    </form>
  )
}
