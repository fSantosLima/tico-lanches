'use client'

import ReactDatePicker, { registerLocale } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ptBR } from 'date-fns/locale'
import { useState } from 'react'

registerLocale('pt-BR', ptBR)

interface DateInputProps {
  name: string
  defaultValue?: string
  max?: string
  required?: boolean
  className?: string
}

function isoToDate(iso: string): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dateToIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DateInput({ name, defaultValue = '', max, required, className }: DateInputProps) {
  const [selected, setSelected] = useState<Date | null>(isoToDate(defaultValue))

  return (
    <div className="relative">
      <ReactDatePicker
        locale="pt-BR"
        dateFormat="dd/MM/yyyy"
        selected={selected}
        onChange={(date: Date | null) => setSelected(date)}
        maxDate={max ? isoToDate(max) ?? undefined : undefined}
        placeholderText="dd/mm/aaaa"
        className={`cursor-pointer ${className ?? ''}`}
        autoComplete="off"
      />
      <input
        type="hidden"
        name={name}
        value={selected ? dateToIso(selected) : ''}
        required={required}
      />
    </div>
  )
}
