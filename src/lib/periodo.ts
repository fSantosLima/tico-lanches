const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type Preset = 'semana' | 'mes' | 'mes-passado'

export function intervaloPreset(preset: Preset, hoje: Date): { de: string; ate: string } {
  const y = hoje.getUTCFullYear()
  const m = hoje.getUTCMonth()
  const d = hoje.getUTCDate()
  const ate = iso(new Date(Date.UTC(y, m, d)))

  if (preset === 'semana') {
    const dow = (new Date(Date.UTC(y, m, d)).getUTCDay() + 6) % 7 // 0 = segunda
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
  const deOk = !!params.de && ISO_RE.test(params.de)
  const ateOk = !!params.ate && ISO_RE.test(params.ate)

  if (deOk && ateOk) {
    let de = params.de!
    let ate = params.ate!
    if (de > ate) [de, ate] = [ate, de] // strings ISO comparam lexicograficamente
    return { de, ate }
  }
  return intervaloPreset('mes', hoje)
}
