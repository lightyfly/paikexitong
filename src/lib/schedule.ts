import type { AppState, ScheduleMapping, ScheduleUnit } from './types'

export const DAYS = [
  { id: 'mon', label: '周一' },
  { id: 'tue', label: '周二' },
  { id: 'wed', label: '周三' },
  { id: 'thu', label: '周四' },
  { id: 'fri', label: '周五' },
  { id: 'sat', label: '周六' },
  { id: 'sun', label: '周日' },
] as const

export type DayId = (typeof DAYS)[number]['id']

export function cellKey(classId: string, day: string, periodId: string) {
  return `${String(classId)}-${String(day)}-${String(periodId)}`
}

export function getUnitsForCell(schedule: ScheduleMapping, classId: string, day: string, periodId: string) {
  return schedule[cellKey(classId, day, periodId)] ?? []
}

export function setUnitsForCell(
  schedule: ScheduleMapping,
  classId: string,
  day: string,
  periodId: string,
  units: ScheduleUnit[],
) {
  const key = cellKey(classId, day, periodId)
  const next: ScheduleMapping = { ...schedule }
  if (!units || units.length === 0) delete next[key]
  else next[key] = units
  return next
}

export function findTeacherConflict(args: {
  state: Pick<AppState, 'schedule'>
  teacherId: string
  day: string
  periodId: string
  ignoreUnitId?: string
}): { key: string; unitId: string } | null {
  const teacherId = String(args.teacherId)
  if (!teacherId) return null
  for (const [key, units] of Object.entries(args.state.schedule)) {
    const parts = String(key).split('-')
    if (parts.length < 3) continue
    const day = parts[parts.length - 2]
    const periodId = parts[parts.length - 1]
    if (String(day) !== String(args.day) || String(periodId) !== String(args.periodId)) continue
    if (!Array.isArray(units)) continue
    for (const u of units) {
      if (String(u?.teacherId) !== teacherId) continue
      if (args.ignoreUnitId && String(u?.id) === String(args.ignoreUnitId)) continue
      return { key, unitId: String(u?.id) }
    }
  }
  return null
}

export function teacherLoadCount(schedule: ScheduleMapping, teacherId: string) {
  const tid = String(teacherId)
  let count = 0
  for (const units of Object.values(schedule)) {
    if (!Array.isArray(units)) continue
    for (const u of units) {
      if (String(u?.teacherId) === tid) count++
    }
  }
  return count
}
