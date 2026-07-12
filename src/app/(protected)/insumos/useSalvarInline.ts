'use client'

import { useActionState, useEffect, useState } from 'react'

export type SalvarInlineState = { ok: true } | { ok: false; error: string } | null

export function useSalvarInline(salvar: (formData: FormData) => Promise<void>) {
  const [state, formAction, pending] = useActionState(
    async (_prev: SalvarInlineState, formData: FormData): Promise<SalvarInlineState> => {
      try {
        await salvar(formData)
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar' }
      }
    },
    null,
  )

  const [dismissed, setDismissed] = useState<SalvarInlineState>(null)
  const showSaved = !!state?.ok && state !== dismissed
  useEffect(() => {
    if (showSaved) {
      const t = setTimeout(() => setDismissed(state), 2000)
      return () => clearTimeout(t)
    }
  }, [showSaved, state])

  return { state, formAction, pending, showSaved }
}
