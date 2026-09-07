import Link from 'next/link'
import { ThemeToggle } from '@/components/ThemeToggle'
import { NovoInsumoForm } from './NovoInsumoForm'

export default function NovoInsumoPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4 lg:hidden">
        <Link href="/insumos" className="text-orange-500 text-lg">←</Link>
        <ThemeToggle />
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Link href="/insumos" className="text-orange-500 text-lg hidden lg:inline">←</Link>
        <h1 className="text-xl font-bold dark:text-slate-100">Novo Insumo</h1>
      </div>

      <NovoInsumoForm />
    </div>
  )
}
