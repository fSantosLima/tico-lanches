'use client'

import { definirCustoInsumo } from './actions'
import { useSalvarInline } from './useSalvarInline'

interface Props {
  insumoId: string
  custo: number
}

export function CustoInsumoForm({ insumoId, custo }: Props) {
  const { state, formAction, pending, showSaved } = useSalvarInline(fd => definirCustoInsumo(insumoId, fd))

  return (
    <form action={formAction} className="flex items-center gap-1">
      <label className="text-xs text-gray-400 dark:text-slate-500">R$</label>
      <input
        type="number"
        name="cost"
        min="0"
        step="0.01"
        defaultValue={custo}
        className="w-20 border dark:border-slate-600 rounded-lg px-2 py-1 text-sm dark:bg-slate-900 dark:text-slate-100"
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
