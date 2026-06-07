'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DatePickerProps {
  currentDate: string  // 'YYYY-MM-DD'
  today: string        // 'YYYY-MM-DD'
}

export function DatePicker({ currentDate, today }: DatePickerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (!val) return
    setOpen(false)
    router.push(`/lancamento?data=${val}`)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-orange-500 text-sm font-medium"
      >
        trocar data
      </button>
    )
  }

  return (
    <input
      type="date"
      defaultValue={currentDate}
      max={today}
      autoFocus
      onChange={handleChange}
      onBlur={() => setOpen(false)}
      className="text-sm border border-orange-400 rounded-lg px-2 py-1 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-400"
    />
  )
}
