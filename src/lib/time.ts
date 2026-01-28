export function addMinutes(hhmm: string, mins: number) {
  const [hStr, mStr] = (hhmm || '').split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const total = h * 60 + m + mins
  const hh = Math.floor((total + 24 * 60) % (24 * 60) / 60)
  const mm = (total + 24 * 60) % (24 * 60) % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function normalizeHHMM(input: string) {
  const s = String(input || '').trim()
  if (!s) return ''
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!m) return ''
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return ''
  if (hh < 0 || hh > 23) return ''
  if (mm < 0 || mm > 59) return ''
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function diffMinutes(start: string, end: string) {
  const [sh, sm] = (start || '').split(':').map(Number)
  const [eh, em] = (end || '').split(':').map(Number)
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0
  return (eh * 60 + em) - (sh * 60 + sm)
}

export function clampDurationMinutes(mins: number) {
  if (!Number.isFinite(mins) || mins <= 0) return 45
  return Math.max(5, Math.min(240, Math.round(mins)))
}
