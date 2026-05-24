'use client'

import { signOut } from 'next-auth/react'

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="text-gray-400 hover:text-gray-200 dark:text-slate-400 dark:hover:text-slate-200 text-xs underline"
    >
      Sair
    </button>
  )
}
