'use client'

import { useActionState } from 'react'
import { adicionarItemReceita } from './actions'

interface Props {
  productId: string
  insumos: { id: string; name: string; unit: string }[]
}

export function ReceitaForm({ productId, insumos }: Props) {
  const [state, formAction] = useActionState(adicionarItemReceita, null)

  if (insumos.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-slate-500">
        Cadastre insumos antes de montar a ficha técnica.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />

      {state?.error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 col-span-2">
          <label className="text-xs text-gray-500 dark:text-slate-400">Insumo</label>
          <select
            name="insumoId"
            required
            defaultValue=""
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="" disabled>Selecionar...</option>
            {insumos.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Qtd / unidade</label>
          <input
            type="number"
            name="quantity"
            step="any"
            min="0"
            placeholder="0"
            required
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <button
        type="submit"
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm"
      >
        Adicionar insumo
      </button>
    </form>
  )
}
