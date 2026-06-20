const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Valida formato ISO E data de calendário real (rejeita 2026-13-99, 2026-02-30, etc.).
// O round-trip via toISOString pega rollovers silenciosos do construtor Date.
function dataValida(s: string | undefined): s is string {
  if (!s || !ISO_RE.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && iso(d) === s
}

export type Preset = 'semana' | 'mes' | 'mes-passado'

export function intervaloPreset(preset: Preset, hoje: Date): { de: string; ate: string } {
  const y = hoje.getUTCFullYear()
  const m = hoje.getUTCMonth()
  const d = hoje.getUTCDate()
  const hojeUTC = new Date(Date.UTC(y, m, d))
  const ate = iso(hojeUTC)

  if (preset === 'semana') {
    // 'semana' vai da segunda-feira da semana corrente até HOJE (não até o domingo).
    const dow = (hojeUTC.getUTCDay() + 6) % 7 // 0 = segunda
    return { de: iso(new Date(Date.UTC(y, m, d - dow))), ate }
  }
  if (preset === 'mes') {
    return { de: iso(new Date(Date.UTC(y, m, 1))), ate }
  }
  // mes-passado
  const primeiro = new Date(Date.UTC(y, m - 1, 1))
  const ultimo = new Date(Date.UTC(y, m, 0)) // dia 0 do mês atual = último dia do mês anterior
  return { de: iso(primeiro), ate: iso(ultimo) }
}

export function resolverPeriodo(
  params: { de?: string; ate?: string },
  hoje: Date,
): { de: string; ate: string } {
  if (dataValida(params.de) && dataValida(params.ate)) {
    let de = params.de
    let ate = params.ate
    if (de > ate) [de, ate] = [ate, de] // strings ISO comparam lexicograficamente
    return { de, ate }
  }
  return intervaloPreset('mes', hoje)
}
