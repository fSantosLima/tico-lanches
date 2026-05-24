import Link from 'next/link'
import { LogoutButton } from '@/app/dashboard/LogoutButton'
import { ThemeToggle } from './ThemeToggle'

export function Sidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-52 min-h-screen bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 p-4 gap-6 shrink-0">
      <div className="flex items-center justify-between">
        <span className="font-bold text-orange-500 text-lg">🍔 Tico</span>
        <ThemeToggle />
      </div>

      <nav className="flex flex-col gap-3">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/products"
          className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 transition-colors"
        >
          Produtos
        </Link>
      </nav>

      <div className="mt-auto">
        <LogoutButton />
      </div>
    </aside>
  )
}
