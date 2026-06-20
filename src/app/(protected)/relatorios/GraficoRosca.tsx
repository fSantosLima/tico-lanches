'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

const CORES = ['#38bdf8', '#f87171', '#facc15', '#a78bfa', '#34d399', '#fb923c']

interface Props {
  dados: { categoria: string; total: number }[]
}

export function GraficoRosca({ dados }: Props) {
  if (dados.length === 0) {
    return <p className="text-center text-gray-400 dark:text-slate-500 py-8">Nenhum gasto no período.</p>
  }
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400 mb-2">
        Gastos por categoria
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={dados} dataKey="total" nameKey="categoria" innerRadius={60} outerRadius={90} paddingAngle={2}>
            {dados.map((_, i) => (
              <Cell key={i} fill={CORES[i % CORES.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => typeof v === 'number' ? `R$ ${v.toFixed(2)}` : String(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
