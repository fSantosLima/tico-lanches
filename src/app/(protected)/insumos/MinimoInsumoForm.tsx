'use client'

import { definirMinimoInsumo } from './actions'
import { useSalvarInline } from './useSalvarInline'

interface Props {
  insumoId: string
  minimo: number
}

export function MinimoInsumoForm({ insumoId, minimo }: Props) {
  const { state, formAction, pending, showSaved } = useSalvarInline(fd => definirMinimoInsumo(insumoId, fd))

  return (
    <form action={formAction} className="flex items-center gap-1">
      <label className="text-xs text-gray-400 dark:text-slate-500">mín.</label>
      <input
        type="number"
        name="minStock"
        min="0"
        step="any"
        defaultValue={minimo}
        className="w-16 border dark:border-slate-600 rounded-lg px-2 py-1 text-sm dark:bg-slate-900 dark:text-slate-100"
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
