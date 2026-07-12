'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { criarInsumo } from '../actions'

const UNIDADES = ['un', 'g', 'kg', 'ml', 'L']

export function NovoInsumoForm() {
  const [state, formAction] = useActionState(criarInsumo, null)

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-slate-100">Nome</label>
        <input
          type="text"
          name="name"
          placeholder="Ex: Carne moída"
          required
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-slate-100">Unidade de medida</label>
        <select
          name="unit"
          required
          defaultValue=""
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="" disabled>Selecionar...</option>
          {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-slate-100">Custo por unidade (R$)</label>
        <input
          type="number"
          name="cost"
          placeholder="0.00"
          step="0.01"
          min="0"
          required
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 dark:text-slate-100">Estoque mínimo</label>
        <input
          type="number"
          name="minStock"
          placeholder="0"
          step="any"
          min="0"
          defaultValue="0"
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-3 text-base bg-white dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">0 = sem alerta de estoque baixo</p>
      </div>
      {state?.error && <p className="text-red-500 text-sm">{state.error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="flex-1 bg-orange-500 text-white py-4 rounded-xl font-semibold text-lg"
        >
          Salvar insumo
        </button>
        <Link href="/insumos" className="text-sm text-gray-500 dark:text-slate-400">Cancelar</Link>
      </div>
    </form>
  )
}
