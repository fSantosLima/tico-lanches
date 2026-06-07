'use client'

import ReactDatePicker, { registerLocale } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

registerLocale('pt-BR', ptBR)

interface DatePickerProps {
  currentDate: string  // 'YYYY-MM-DD'
  today: string        // 'YYYY-MM-DD'
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function dateToIso(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function DatePicker({ currentDate, today }: DatePickerProps) {
  const router = useRouter()

  // Wrapper div prevents ReactDatePicker's Fragment from rendering as multiple
  // flex siblings in the justify-between header, which would shift the reference
  // element to center and cause @floating-ui to misplace the calendar popup.
  return (
    <div>
      <ReactDatePicker
        locale="pt-BR"
        dateFormat="dd/MM/yyyy"
        popperPlacement="bottom-end"
        selected={isoToDate(currentDate)}
        maxDate={isoToDate(today)}
        onChange={(date: Date | null) => {
          if (date) router.push(`/lancamento?data=${dateToIso(date)}`)
        }}
        customInput={
          <button type="button" className="text-orange-500 text-sm font-medium">
            {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              .format(isoToDate(currentDate))}
          </button>
        }
      />
    </div>
  )
}
