import { useCallback, useMemo, useReducer } from 'react'
import type { AppState, ClassEntity, Course, Period, ScheduleUnit, Teacher } from '../lib/types'
import { pickCourseColor } from '../lib/colors'
import { uid } from '../lib/id'
import { addMinutes, clampDurationMinutes, diffMinutes, normalizeHHMM } from '../lib/time'
import { setUnitsForCell } from '../lib/schedule'

type Action =
  | { type: 'hydrate'; payload: Partial<AppState> }
  | { type: 'setLoaded'; value: boolean }
  | { type: 'setTeachers'; teachers: Teacher[] }
  | { type: 'setClasses'; classes: ClassEntity[] }
  | { type: 'setPeriods'; periods: Period[] }
  | { type: 'upsertCourseByName'; name: string }
  | { type: 'setCourses'; courses: Course[] }
  | { type: 'setSchedule'; schedule: AppState['schedule'] }
  | {
      type: 'upsertUnit'
      classId: string
      day: string
      periodId: string
      unit: ScheduleUnit
    }
  | { type: 'deleteUnit'; classId: string; day: string; periodId: string; unitId: string }
  | { type: 'clearLocalSchedule' }

export const emptyState: AppState = {
  teachers: [],
  classes: [],
  periods: [],
  courses: [],
  schedule: {},
  hasLoaded: false,
}

function normalizeState(partial: Partial<AppState>): AppState {
  const teachers = Array.isArray(partial.teachers) ? (partial.teachers as any) : []
  const classes = Array.isArray(partial.classes) ? (partial.classes as any) : []
  const periods = Array.isArray(partial.periods) ? (partial.periods as any) : []
  const courses = Array.isArray(partial.courses) ? (partial.courses as any) : []
  const schedule = partial.schedule && typeof partial.schedule === 'object' ? (partial.schedule as any) : {}
  return {
    teachers: teachers.map((t: any) => ({ id: String(t.id || uid('t')), name: String(t.name || ''), subject: String(t.subject || '') })),
    classes: classes.map((c: any) => ({ id: String(c.id || uid('c')), name: String(c.name || '') })),
    periods: periods.map((p: any) => ({
      id: String(p.id || uid('p')),
      name: String(p.name || ''),
      startTime: normalizeHHMM(String(p.startTime || '')),
      endTime: normalizeHHMM(String(p.endTime || '')),
    })),
    courses: courses.map((co: any, idx: number) => ({
      id: String(co.id || uid('co')),
      name: String(co.name || ''),
      color: String(co.color || pickCourseColor(idx)),
    })),
    schedule: schedule as any,
    hasLoaded: Boolean(partial.hasLoaded),
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate': {
      const next = normalizeState({ ...state, ...action.payload, hasLoaded: true })
      return { ...next, hasLoaded: true }
    }
    case 'setLoaded':
      return { ...state, hasLoaded: action.value }
    case 'setTeachers':
      return { ...state, teachers: action.teachers }
    case 'setClasses':
      return { ...state, classes: action.classes }
    case 'setCourses':
      return { ...state, courses: action.courses }
    case 'setPeriods':
      return { ...state, periods: action.periods }
    case 'setSchedule':
      return { ...state, schedule: action.schedule }
    case 'upsertCourseByName': {
      const name = String(action.name || '').trim()
      if (!name) return state
      const exists = state.courses.some((c) => c.name.trim().toLowerCase() === name.toLowerCase())
      if (exists) return state
      const next: Course = { id: uid('course'), name, color: pickCourseColor(state.courses.length) }
      return { ...state, courses: [...state.courses, next] }
    }
    case 'upsertUnit': {
      const keyUnits = state.schedule[`${action.classId}-${action.day}-${action.periodId}`] ?? []
      const idx = keyUnits.findIndex((u) => String(u.id) === String(action.unit.id))
      const nextUnits = idx === -1 ? [...keyUnits, action.unit] : keyUnits.map((u, i) => (i === idx ? action.unit : u))
      return {
        ...state,
        schedule: setUnitsForCell(state.schedule, action.classId, action.day, action.periodId, nextUnits),
      }
    }
    case 'deleteUnit': {
      const keyUnits = state.schedule[`${action.classId}-${action.day}-${action.periodId}`] ?? []
      const nextUnits = keyUnits.filter((u) => String(u.id) !== String(action.unitId))
      return {
        ...state,
        schedule: setUnitsForCell(state.schedule, action.classId, action.day, action.periodId, nextUnits),
      }
    }
    case 'clearLocalSchedule':
      return { ...state, schedule: {} }
    default:
      return state
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, emptyState)

  const upsertCourseByName = useCallback((name: string) => dispatch({ type: 'upsertCourseByName', name }), [])

  const helpers = useMemo(() => {
    const createNextPeriod = () => {
      const last = state.periods[state.periods.length - 1]
      const lastEnd = normalizeHHMM(String(last?.endTime || ''))
      const start = lastEnd ? addMinutes(lastEnd, 10) : '08:30'
      const end = start ? addMinutes(start, 45) : ''
      return {
        id: uid('period'),
        name: `第${state.periods.length + 1}节`,
        startTime: normalizeHHMM(start),
        endTime: normalizeHHMM(end),
      }
    }

    const updatePeriodStartTime = (periodId: string, nextStart: string) => {
      const periods = state.periods.map((p) => {
        if (String(p.id) !== String(periodId)) return p
        const duration = clampDurationMinutes(diffMinutes(p.startTime, p.endTime) || 45)
        const startTime = normalizeHHMM(String(nextStart))
        const endTime = startTime ? normalizeHHMM(addMinutes(startTime, duration)) : p.endTime
        return { ...p, startTime, endTime }
      })
      dispatch({ type: 'setPeriods', periods })
    }

    const updatePeriodEndTime = (periodId: string, nextEnd: string) => {
      const periods = state.periods.map((p) =>
        String(p.id) === String(periodId) ? { ...p, endTime: normalizeHHMM(String(nextEnd)) } : p,
      )
      dispatch({ type: 'setPeriods', periods })
    }

    return { createNextPeriod, updatePeriodStartTime, updatePeriodEndTime }
  }, [state.periods])

  return { state, dispatch, upsertCourseByName, helpers }
}
