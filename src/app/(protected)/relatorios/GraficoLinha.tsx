'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

interface Props {
  dados: { semana: string; lucroReal: number }[]
}

export function GraficoLinha({ dados }: Props) {
  if (dados.length === 0) {
    return <p className="text-center text-gray-400 dark:text-slate-500 py-8">Sem movimento neste período.</p>
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
        Lucro real por semana
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#33415544" />
          <XAxis dataKey="semana" fontSize={11} />
          <YAxis fontSize={11} />
          <Tooltip formatter={(v) => typeof v === 'number' ? `R$ ${v.toFixed(2)}` : String(v)} />
          <ReferenceLine y={0} stroke="#94a3b8" />
          <Line type="monotone" dataKey="lucroReal" stroke="#22c55e" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
