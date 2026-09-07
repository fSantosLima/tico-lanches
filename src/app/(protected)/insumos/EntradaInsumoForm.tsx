'use client'

import { useActionState } from 'react'
import { registrarEntradaInsumo } from './actions'
import { DateInput } from '@/components/DateInput'

interface Props {
  today: string
  insumos: { id: string; name: string; unit: string }[]
}

export function EntradaInsumoForm({ today, insumos }: Props) {
  const [state, formAction] = useActionState(registrarEntradaInsumo, null)

  return (
    <form
      action={formAction}
      className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col gap-3"
    >
      <p className="font-semibold dark:text-slate-100 text-sm">Registrar entrada (compra)</p>

      {state?.error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Insumo</label>
          <select
            name="insumoId"
            required
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Selecionar...</option>
            {insumos.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Data</label>
          <DateInput
            name="date"
            defaultValue={today}
            max={today}
            required
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Qtd</label>
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
        <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Observação</label>
          <input
            type="text"
            name="note"
            placeholder="opcional"
            className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
      <button
        type="submit"
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold text-sm mt-1"
      >
        Registrar entrada
      </button>
    </form>
  )
}
