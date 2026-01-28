export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function formatYMD(d: Date) {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  return `${y}-${pad2(m)}-${pad2(day)}`
}

export function parseYMD(ymd: string) {
  const s = String(ymd || '').trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (Number.isNaN(dt.getTime())) return null
  return dt
}

export function addDays(d: Date, days: number) {
  const dt = new Date(d)
  dt.setDate(dt.getDate() + days)
  return dt
}

export function weekStartMonday(d: Date) {
  // JS: 0=Sun..6=Sat. We use Mon as week start.
  const day = d.getDay()
  const delta = day === 0 ? -6 : 1 - day
  const start = addDays(d, delta)
  start.setHours(0, 0, 0, 0)
  return start
}

export function weekStartFromYMD(ymd: string) {
  const dt = parseYMD(ymd)
  if (!dt) return null
  return weekStartMonday(dt)
}

export function weekRangeLabel(weekStart: Date) {
  const end = addDays(weekStart, 6)
  return `${formatYMD(weekStart)} ~ ${formatYMD(end)}`
}
