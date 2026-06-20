'use client'

import ReactDatePicker, { registerLocale } from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { isoToDate, dateToIso } from '@/lib/dateUtils'

registerLocale('pt-BR', ptBR)

interface DatePickerProps {
  currentDate: string  // 'YYYY-MM-DD'
  today: string        // 'YYYY-MM-DD'
}

export function DatePicker({ currentDate, today }: DatePickerProps) {
  const router = useRouter()

  // Wrapper div prevents ReactDatePicker's Fragment from rendering as multiple
  // flex siblings in the justify-between header, which would shift the reference
  // element to center and cause @floating-ui to misplace the calendar popup.
  const selectedDate = isoToDate(currentDate)
  const maxDateLimit = isoToDate(today)

  return (
    <div>
      <ReactDatePicker
        locale="pt-BR"
        dateFormat="dd/MM/yyyy"
        popperPlacement="bottom-end"
        selected={selectedDate || undefined}
        maxDate={maxDateLimit || undefined}
        onChange={(date: Date | null) => {
          if (date) router.push(`/lancamento?data=${dateToIso(date)}`)
        }}
        customInput={
          <button type="button" className="text-orange-500 text-sm font-medium">
            {new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              .format(selectedDate!)}
          </button>
        }
      />
    </div>
  )
}
