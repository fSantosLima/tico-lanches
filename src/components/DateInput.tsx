'use client'

import ReactDatePicker, { registerLocale } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ptBR } from 'date-fns/locale'
import { useEffect, useRef, useState } from 'react'
import { isoToDate, dateToIso } from '@/lib/dateUtils'

registerLocale('pt-BR', ptBR)

interface DateInputProps {
  name: string
  defaultValue?: string
  min?: string
  max?: string
  required?: boolean
  className?: string
}

export function DateInput({ name, defaultValue = '', min, max, required, className }: DateInputProps) {
  const [selected, setSelected] = useState<Date | null>(isoToDate(defaultValue))
  const validationRef = useRef<HTMLInputElement>(null)

  // setCustomValidity makes native form validation catch an empty required date picker,
  // since <input type="hidden"> is barred from constraint validation by the HTML spec.
  useEffect(() => {
    if (validationRef.current && required) {
      validationRef.current.setCustomValidity(selected ? '' : 'Selecione uma data')
    }
  }, [selected, required])

  return (
    <div className="relative">
      <ReactDatePicker
        locale="pt-BR"
        dateFormat="dd/MM/yyyy"
        selected={selected}
        onChange={(date: Date | null) => setSelected(date)}
        minDate={min ? isoToDate(min) ?? undefined : undefined}
        maxDate={max ? isoToDate(max) ?? undefined : undefined}
        placeholderText="dd/mm/aaaa"
        className={`cursor-pointer ${className ?? ''}`}
        autoComplete="off"
      />
      {/* Visible to constraint validation but invisible to users; type="hidden" is excluded by spec */}
      <input
        ref={validationRef}
        type="text"
        name={name}
        value={selected ? dateToIso(selected) : ''}
        onChange={() => {}}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        required={required}
        style={{ opacity: 0, position: 'absolute', pointerEvents: 'none', width: '1px', height: '1px', bottom: 0, left: 0 }}
      />
    </div>
  )
}
