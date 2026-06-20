import Link from 'next/link'

interface Props {
  tab: 'resumo' | 'graficos'
  de: string
  ate: string
}

export function Tabs({ tab, de, ate }: Props) {
  function cls(t: string) {
    return t === tab
      ? 'px-4 py-2 text-sm font-medium border-b-2 border-orange-500 text-orange-500'
      : 'px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
  }
  return (
    <div className="flex border-b dark:border-slate-700">
      <Link href={`/relatorios?de=${de}&ate=${ate}&tab=resumo`} className={cls('resumo')}>Resumo</Link>
      <Link href={`/relatorios?de=${de}&ate=${ate}&tab=graficos`} className={cls('graficos')}>Gráficos</Link>
    </div>
  )
}
