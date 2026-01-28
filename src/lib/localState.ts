import type { Course, Period, ScheduleMapping, Teacher, ClassEntity } from './types'
import { getAppId } from './appId'

function keyConfig(appId: string) {
  return `paikexitong_config_${appId}`
}

function keySchedule(appId: string, weekStartYmd: string) {
  return `paikexitong_schedule_${appId}_${String(weekStartYmd)}`
}

function keyLastDate(appId: string) {
  return `paikexitong_last_date_${appId}`
}

export type LocalConfig = {
  teachers: Teacher[]
  classes: ClassEntity[]
  periods: Period[]
  courses: Course[]
}

function sanitizeScheduleMapping(raw: any): ScheduleMapping {
  const out: ScheduleMapping = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw)) {
    if (!Array.isArray(v)) continue
    out[String(k)] = v
      .filter((x) => x && typeof x === 'object')
      .map((u: any) => ({
        id: String(u.id || ''),
        teacherId: String(u.teacherId || ''),
        groupName: String(u.groupName || ''),
      }))
  }
  return out
}

function parseCellKey(key: string): { classId: string; day: string; periodId: string } | null {
  const parts = String(key || '').split('-')
  if (parts.length < 3) return null
  const day = parts[parts.length - 2]
  const periodId = parts[parts.length - 1]
  const classId = parts.slice(0, parts.length - 2).join('-')
  return { classId, day, periodId }
}

export type WeekArchiveSample = {
  classId: string
  day: string
  periodId: string
  teacherId: string
  groupName: string
}

export type WeekArchivePreview = {
  weekStartYmd: string
  updatedAt: number
  unitCount: number
  samples: WeekArchiveSample[]
}

export function listWeekArchives(appId = getAppId()): WeekArchivePreview[] {
  const prefix = `paikexitong_schedule_${appId}_`
  const out: WeekArchivePreview[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k || !k.startsWith(prefix)) continue
    const weekStartYmd = k.slice(prefix.length)
    try {
      const raw = localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const updatedAt = Number((parsed as any)?.updatedAt || 0)
      const sched = (parsed as any)?.schedule ? sanitizeScheduleMapping((parsed as any).schedule) : sanitizeScheduleMapping(parsed)

      let unitCount = 0
      const samples: WeekArchiveSample[] = []
      for (const [cellKeyStr, units] of Object.entries(sched)) {
        if (!Array.isArray(units)) continue
        const parsedKey = parseCellKey(cellKeyStr)
        if (!parsedKey) continue
        unitCount += units.length
        for (const u of units) {
          if (samples.length >= 5) break
          samples.push({
            classId: parsedKey.classId,
            day: parsedKey.day,
            periodId: parsedKey.periodId,
            teacherId: String((u as any)?.teacherId || ''),
            groupName: String((u as any)?.groupName || ''),
          })
        }
        if (samples.length >= 5) break
      }

      out.push({ weekStartYmd, updatedAt, unitCount, samples })
    } catch {
      // ignore corrupted entries
    }
  }
  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return out
}

export function loadLocalConfig(appId = getAppId()): Partial<LocalConfig> | null {
  try {
    const raw = localStorage.getItem(keyConfig(appId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Partial<LocalConfig>
  } catch {
    return null
  }
}

export function saveLocalConfig(config: LocalConfig, appId = getAppId()) {
  localStorage.setItem(keyConfig(appId), JSON.stringify({ ...config, updatedAt: Date.now() }))
}

export function loadWeekSchedule(weekStartYmd: string, appId = getAppId()): ScheduleMapping | null {
  try {
    const raw = localStorage.getItem(keySchedule(appId, weekStartYmd))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    // New format: { schedule, updatedAt }
    if ((parsed as any).schedule) return sanitizeScheduleMapping((parsed as any).schedule)
    // Legacy/compat: schedule mapping stored directly (may include stray keys like updatedAt)
    return sanitizeScheduleMapping(parsed)
  } catch {
    return null
  }
}

export function saveWeekSchedule(weekStartYmd: string, schedule: ScheduleMapping, appId = getAppId()) {
  localStorage.setItem(keySchedule(appId, weekStartYmd), JSON.stringify({ schedule, updatedAt: Date.now() }))
}

export function deleteWeekArchive(weekStartYmd: string, appId = getAppId()) {
  localStorage.removeItem(keySchedule(appId, weekStartYmd))
}

export function loadLastSelectedDate(appId = getAppId()) {
  return String(localStorage.getItem(keyLastDate(appId)) || '')
}

export function saveLastSelectedDate(ymd: string, appId = getAppId()) {
  localStorage.setItem(keyLastDate(appId), String(ymd))
}
