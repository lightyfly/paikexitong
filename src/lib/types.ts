export type Teacher = {
  id: string
  name: string
  subject: string
}

export type ClassEntity = {
  id: string
  name: string
}

export type Period = {
  id: string
  name: string
  startTime: string // HH:MM
  endTime: string // HH:MM
}

export type Course = {
  id: string
  name: string
  color: string // hex
}

export type ScheduleUnit = {
  id: string
  teacherId: string
  groupName: string
}

export type ScheduleMapping = Record<string, ScheduleUnit[]>

export type AppState = {
  teachers: Teacher[]
  classes: ClassEntity[]
  periods: Period[]
  courses: Course[]
  schedule: ScheduleMapping
  hasLoaded: boolean
}
