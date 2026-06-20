'use client'

import { useRouter } from 'next/navigation'
import { DateInput } from '@/components/DateInput'
import { intervaloPreset, type Preset } from '@/lib/periodo'

interface Props {
  de: string
  ate: string
  tab: 'resumo' | 'graficos'
  max: string
}

export function FiltroPeriodo({ de, ate, tab, max }: Props) {
  const router = useRouter()

  function aplicar(novoDe: string, novoAte: string) {
    router.push(`/relatorios?de=${novoDe}&ate=${novoAte}&tab=${tab}`)
  }

  function preset(p: Preset) {
    const intervalo = intervaloPreset(p, new Date())
    aplicar(intervalo.de, intervalo.ate)
  }

  const presetBtn = 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-200 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => preset('semana')} className={presetBtn}>Esta semana</button>
        <button type="button" onClick={() => preset('mes')} className={presetBtn}>Este mês</button>
        <button type="button" onClick={() => preset('mes-passado')} className={presetBtn}>Mês passado</button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          aplicar(String(fd.get('de')), String(fd.get('ate')))
        }}
        className="flex flex-wrap gap-3 items-end"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">De</label>
          <DateInput name="de" defaultValue={de} max={max} className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-slate-400">Até</label>
          <DateInput name="ate" defaultValue={ate} max={max} className="border dark:border-slate-600 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-slate-100" />
        </div>
        <button type="submit" className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium">Filtrar</button>
      </form>
    </div>
  )
}
