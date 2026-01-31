import { useMemo, useState, type CSSProperties } from 'react'
import { BookOpen, Users } from 'lucide-react'
import type { AppState, ScheduleUnit } from '../lib/types'
import { DAYS, findTeacherConflict, teacherLoadCount, getUnitsForCell } from '../lib/schedule'
import { uid } from '../lib/id'
import { addDays, formatYMD, weekStartFromYMD } from '../lib/week'
import { Modal } from './Modal'
import { Button, Pill, Select } from './ui'
import { useToast } from './Toast'

type Mode = 'class' | 'teacher'

function courseColorForTeacher(state: AppState, teacherId: string) {
  const t = state.teachers.find((x) => String(x.id) === String(teacherId))
  const subject = String(t?.subject || '').trim()
  const course = state.courses.find((c) => c.name.trim().toLowerCase() === subject.toLowerCase())
  return String(course?.color || '#0ea5e9')
}

function teacherName(state: AppState, teacherId: string) {
  const t = state.teachers.find((x) => String(x.id) === String(teacherId))
  return String(t?.name || '未命名老师')
}

function className(state: AppState, classId: string) {
  const c = state.classes.find((x) => String(x.id) === String(classId))
  return String(c?.name || '未命名班级')
}

function parseCellKey(key: string): { classId: string; day: string; periodId: string } | null {
  const parts = String(key || '').split('-')
  if (parts.length < 3) return null
  const day = parts[parts.length - 2]
  const periodId = parts[parts.length - 1]
  const classId = parts.slice(0, parts.length - 2).join('-')
  return { classId, day, periodId }
}

export function ScheduleLab(props: {
  state: AppState
  onUpsertUnit: (args: { classId: string; day: string; periodId: string; unit: ScheduleUnit }) => void
  onDeleteUnit: (args: { classId: string; day: string; periodId: string; unitId: string }) => void
  courseNames: string[]
  weekStartYmd: string
  ensureTempClassId: () => string
}) {
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('class')
  const [activeClassId, setActiveClassId] = useState<string>('')
  const [activeTeacherId, setActiveTeacherId] = useState<string>('')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorCtx, setEditorCtx] = useState<{ classId: string; day: string; periodId: string } | null>(null)
  const [editingUnitId, setEditingUnitId] = useState<string>('')
  const [draftTeacherId, setDraftTeacherId] = useState<string>('')

  const [hoverDropKey, setHoverDropKey] = useState<string>('')
  const [dragKind, setDragKind] = useState<'' | 'teacher' | 'unit'>('')

  const DND_MIME = 'application/x-paikexitong-dnd'

  const [swapOpen, setSwapOpen] = useState(false)
  const [swapConfirmOpen, setSwapConfirmOpen] = useState(false)
  const [swapSrc, setSwapSrc] = useState<{
    classId: string
    day: string
    periodId: string
    unit: ScheduleUnit
  } | null>(null)
  const [swapTargetTeacherId, setSwapTargetTeacherId] = useState<string>('')

  const [swapPlan, setSwapPlan] = useState<null | {
    src: { classId: string; day: string; periodId: string; unit: ScheduleUnit }
    tgt: { classId: string; day: string; periodId: string; unit: ScheduleUnit }
  }>(null)

  const [slotActionsOpen, setSlotActionsOpen] = useState(false)
  const [slotActionsCtx, setSlotActionsCtx] = useState<null | { day: string; periodId: string }>(null)
  const [slotActionsPickSrcUnitId, setSlotActionsPickSrcUnitId] = useState<string>('')
  const [addPickClassId, setAddPickClassId] = useState<string>('')

  const [transientHighlights, setTransientHighlights] = useState<Record<string, number>>({})

  const classId = activeClassId || props.state.classes[0]?.id || ''
  const teacherId = activeTeacherId || props.state.teachers[0]?.id || ''

  const teacherLoads = useMemo(() => {
    return props.state.teachers
      .map((t) => ({ teacherId: t.id, count: teacherLoadCount(props.state.schedule, t.id) }))
      .sort((a, b) => b.count - a.count)
  }, [props.state.schedule, props.state.teachers])

  const gridStyle = useMemo(() => {
    return {
      gridTemplateColumns: `220px repeat(${DAYS.length}, minmax(0, 1fr))`,
    } as CSSProperties
  }, [])

  const dayDateLabel = useMemo(() => {
    const ws = weekStartFromYMD(props.weekStartYmd)
    if (!ws) {
      return Object.fromEntries(DAYS.map((d) => [d.id, ''])) as Record<string, string>
    }
    const out: Record<string, string> = {}
    DAYS.forEach((d, idx) => {
      const ymd = formatYMD(addDays(ws, idx))
      out[d.id] = ymd.slice(5) // MM-DD
    })
    return out
  }, [props.weekStartYmd])

  const maxLoad = 15
  const loadCount = teacherId ? teacherLoadCount(props.state.schedule, teacherId) : 0
  const loadPct = Math.min(100, Math.round((loadCount / maxLoad) * 100))

  const openCellEditor = (ctx: { classId: string; day: string; periodId: string }, unit?: ScheduleUnit) => {
    setEditorCtx(ctx)
    setEditingUnitId(unit ? String(unit.id) : '')
    setDraftTeacherId(unit ? String(unit.teacherId) : '')
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditorCtx(null)
    setEditingUnitId('')
    setDraftTeacherId('')
  }

  const openSwapModal = (src: { classId: string; day: string; periodId: string; unit: ScheduleUnit }) => {
    setSwapSrc(src)
    setSwapTargetTeacherId('')
    setSwapPlan(null)
    setSwapConfirmOpen(false)
    setSwapOpen(true)
  }

  const closeSwapModal = () => {
    setSwapOpen(false)
    setSwapConfirmOpen(false)
    setSwapSrc(null)
    setSwapTargetTeacherId('')
    setSwapPlan(null)
  }

  const closeSwapConfirm = () => {
    setSwapConfirmOpen(false)
    setSwapPlan(null)
  }

  const quickAddLessonForSlot = (day: string, periodId: string, classId: string) => {
    const d = String(day)
    const pid = String(periodId)
    const cid = String(classId)
    if (!teacherId) {
      toast.push({ type: 'error', title: '请选择老师', detail: '教师视图需要先选中一个老师' })
      return
    }
    if (!d || !pid || !cid) return

    // class conflict: class already has any course at this slot
    if (isClassSlotOccupied(cid, d, pid)) {
      toast.push({ type: 'error', title: '班级冲突', detail: '该班级在该时间点已安排课程，无法加课' })
      return
    }

    const conflict = findTeacherConflict({ state: props.state, teacherId, day: d, periodId: pid })
    if (conflict) {
      toast.push({ type: 'error', title: '老师冲突', detail: '该老师在同一时间已安排其他课程' })
      return
    }

    const existing = getUnitsForCell(props.state.schedule, cid, d, pid)
    if (existing.some((u) => String(u.teacherId) === String(teacherId))) {
      toast.push({ type: 'error', title: '不可重复排课', detail: '该老师已在该班级此节次安排过课程' })
      return
    }

    const unit: ScheduleUnit = {
      id: uid('unit'),
      teacherId: String(teacherId),
      groupName: autoGroupNameFromTeacher(teacherId),
    }
    props.onUpsertUnit({ classId: cid, day: d, periodId: pid, unit })
    toast.push({ type: 'success', title: '加课成功', detail: `已为 ${String(className(props.state, cid))} 添加课程` })
  }

  const isHighlighted = (unitId: string) => {
    const until = transientHighlights[String(unitId)]
    return Boolean(until && until > Date.now())
  }

  const addHighlights = (unitIds: string[], ms = 25000) => {
    const until = Date.now() + ms
    setTransientHighlights((prev) => {
      const next = { ...prev }
      for (const id of unitIds) next[String(id)] = until
      return next
    })
    window.setTimeout(() => {
      setTransientHighlights((prev) => {
        const now = Date.now()
        const next: Record<string, number> = {}
        for (const [k, v] of Object.entries(prev)) {
          if (v > now) next[k] = v
        }
        return next
      })
    }, ms + 50)
  }

  const closeSlotActions = () => {
    setSlotActionsOpen(false)
    setSlotActionsCtx(null)
    setSlotActionsPickSrcUnitId('')
    setAddPickClassId('')
  }

  const isClassSlotOccupied = (classId: string, day: string, periodId: string) => {
    return getUnitsForCell(props.state.schedule, classId, day, periodId).length > 0
  }

  const lessonsByTeacher = useMemo(() => {
    const out = new Map<string, Array<{ classId: string; day: string; periodId: string; unit: ScheduleUnit }>>()
    for (const [k, units] of Object.entries(props.state.schedule)) {
      const parsed = parseCellKey(k)
      if (!parsed) continue
      if (!Array.isArray(units)) continue
      for (const u of units) {
        const tid = String((u as any)?.teacherId || '')
        if (!tid) continue
        const arr = out.get(tid) ?? []
        arr.push({ classId: parsed.classId, day: parsed.day, periodId: parsed.periodId, unit: u })
        out.set(tid, arr)
      }
    }
    return out
  }, [props.state.schedule])

  const selectedTargetLessons = useMemo(() => {
    const tid = String(swapTargetTeacherId)
    if (!tid) return []
    return lessonsByTeacher.get(tid) ?? []
  }, [lessonsByTeacher, swapTargetTeacherId])

  const sortedTargetLessons = useMemo(() => {
    const dayIndex = new Map<string, number>(DAYS.map((d, i) => [d.id, i]))
    const periodIndex = new Map<string, number>(props.state.periods.map((p, i) => [p.id, i]))
    return [...selectedTargetLessons].sort((a, b) => {
      const da = dayIndex.get(String(a.day)) ?? 99
      const db = dayIndex.get(String(b.day)) ?? 99
      if (da !== db) return da - db
      const pa = periodIndex.get(String(a.periodId)) ?? 999
      const pb = periodIndex.get(String(b.periodId)) ?? 999
      return pa - pb
    })
  }, [props.state.periods, selectedTargetLessons])

  const targetLessonsByDay = useMemo(() => {
    const dayIndex = new Map<string, number>(DAYS.map((d, i) => [d.id, i]))
    const periodIndex = new Map<string, number>(props.state.periods.map((p, i) => [p.id, i]))
    const groups = new Map<string, Array<{ classId: string; day: string; periodId: string; unit: ScheduleUnit }>>()
    for (const l of selectedTargetLessons) {
      const arr = groups.get(String(l.day)) ?? []
      arr.push(l)
      groups.set(String(l.day), arr)
    }
    const entries = Array.from(groups.entries())
      .sort((a, b) => (dayIndex.get(a[0]) ?? 99) - (dayIndex.get(b[0]) ?? 99))
      .map(([day, lessons]) => ({
        day,
        lessons: lessons.sort((a, b) => (periodIndex.get(String(a.periodId)) ?? 999) - (periodIndex.get(String(b.periodId)) ?? 999)),
      }))
    return entries
  }, [props.state.periods, selectedTargetLessons])

  const canSwapWith = useMemo(() => {
    const cache = new Map<string, { ok: boolean; reason?: string }>()

    return (tgt: { classId: string; day: string; periodId: string; unit: ScheduleUnit }): { ok: boolean; reason?: string } => {
      if (!swapSrc) return { ok: false, reason: '未选择源课程' }
      const key = `${String(swapSrc.unit.id)}__${String(tgt.unit.id)}`
      const hit = cache.get(key)
      if (hit) return hit

      if (String(tgt.day) === String(swapSrc.day) && String(tgt.periodId) === String(swapSrc.periodId)) {
        const res = { ok: false, reason: '同一时间点，无法调课' }
        cache.set(key, res)
        return res
      }

      // remove both units, then test if teachers conflict at new slots
      const tempSchedule = { ...props.state.schedule }
      const srcUnits = getUnitsForCell(tempSchedule, swapSrc.classId, swapSrc.day, swapSrc.periodId).filter(
        (u) => String(u.id) !== String(swapSrc.unit.id),
      )
      tempSchedule[`${swapSrc.classId}-${swapSrc.day}-${swapSrc.periodId}`] = srcUnits

      const tgtUnits = getUnitsForCell(tempSchedule, tgt.classId, tgt.day, tgt.periodId).filter(
        (u) => String(u.id) !== String(tgt.unit.id),
      )
      tempSchedule[`${tgt.classId}-${tgt.day}-${tgt.periodId}`] = tgtUnits

      const srcTeacherConflict = findTeacherConflict({
        state: { schedule: tempSchedule } as any,
        teacherId: swapSrc.unit.teacherId,
        day: tgt.day,
        periodId: tgt.periodId,
      })
      if (srcTeacherConflict) {
        const res = { ok: false, reason: '当前老师在目标时间点已有安排' }
        cache.set(key, res)
        return res
      }

      const tgtTeacherConflict = findTeacherConflict({
        state: { schedule: tempSchedule } as any,
        teacherId: tgt.unit.teacherId,
        day: swapSrc.day,
        periodId: swapSrc.periodId,
      })
      if (tgtTeacherConflict) {
        const res = { ok: false, reason: '目标老师在原时间点已有安排' }
        cache.set(key, res)
        return res
      }

      const res: { ok: boolean; reason?: string } = { ok: true }
      cache.set(key, res)
      return res
    }
  }, [props.state.schedule, swapSrc])

  const executeSwapPlan = (plan: { src: { classId: string; day: string; periodId: string; unit: ScheduleUnit }; tgt: { classId: string; day: string; periodId: string; unit: ScheduleUnit } }) => {
    const src = plan.src
    const tgt = plan.tgt

    // delete originals
    props.onDeleteUnit({ classId: src.classId, day: src.day, periodId: src.periodId, unitId: src.unit.id })
    props.onDeleteUnit({ classId: tgt.classId, day: tgt.day, periodId: tgt.periodId, unitId: tgt.unit.id })

    // swap their time slots
    props.onUpsertUnit({ classId: src.classId, day: tgt.day, periodId: tgt.periodId, unit: src.unit })
    props.onUpsertUnit({ classId: tgt.classId, day: src.day, periodId: src.periodId, unit: tgt.unit })

    addHighlights([String(src.unit.id), String(tgt.unit.id)])
    toast.push({ type: 'success', title: '调课完成', detail: '已交换两节课的时间' })
    closeSwapModal()
  }

  // add lesson is now a one-click action from the slot actions modal

  const lessonsForTeacherAt = useMemo(() => {
    // helper for slot actions modal
    if (!slotActionsCtx || !teacherId) return [] as Array<{ classId: string; day: string; periodId: string; unit: ScheduleUnit }>
    const out: Array<{ classId: string; day: string; periodId: string; unit: ScheduleUnit }> = []
    for (const c of props.state.classes) {
      const key = `${c.id}-${slotActionsCtx.day}-${slotActionsCtx.periodId}`
      const units = props.state.schedule[key] ?? []
      if (!Array.isArray(units)) continue
      for (const u of units) {
        if (String((u as any)?.teacherId) === String(teacherId)) out.push({ classId: c.id, day: slotActionsCtx.day, periodId: slotActionsCtx.periodId, unit: u })
      }
    }
    return out
  }, [props.state.classes, props.state.schedule, slotActionsCtx, teacherId])

  const autoGroupNameFromTeacher = (teacherId: string) => {
    const t = props.state.teachers.find((x) => String(x.id) === String(teacherId))
    const subject = String(t?.subject || '').trim()
    return subject || '未设置科目'
  }

  const setDndPayload = (dt: DataTransfer, payload: any) => {
    try {
      dt.setData(DND_MIME, JSON.stringify(payload))
    } catch {
      // ignore
    }
    // fallback for some browsers
    if (payload?.kind === 'teacher') dt.setData('text/plain', String(payload.teacherId || ''))
    else dt.setData('text/plain', JSON.stringify(payload))
  }

  const getDndPayload = (dt: DataTransfer) => {
    const raw = dt.getData(DND_MIME) || dt.getData('text/plain')
    const s = String(raw || '').trim()
    if (!s) return null
    try {
      if (s.startsWith('{') || s.startsWith('[')) return JSON.parse(s)
    } catch {
      // ignore
    }
    // legacy: teacherId only
    return { kind: 'teacher', teacherId: s }
  }

  const onDropTeacherToCell = (args: { teacherId: string; classId: string; day: string; periodId: string }) => {
    const teacherId = String(args.teacherId)
    const classId = String(args.classId)
    const day = String(args.day)
    const periodId = String(args.periodId)
    if (!teacherId || !classId || !day || !periodId) return

    const existing = getUnitsForCell(props.state.schedule, classId, day, periodId)
    if (existing.some((u) => String(u.teacherId) === teacherId)) {
      toast.push({ type: 'error', title: '不可重复排课', detail: '该老师已在此节次/班级安排过课程' })
      return
    }

    const conflict = findTeacherConflict({ state: props.state, teacherId, day, periodId })
    if (conflict) {
      const parsed = parseCellKey(conflict.key)
      const conflictClass = parsed ? className(props.state, parsed.classId) : '其他班级'
      const dayLabel = String(DAYS.find((d) => d.id === day)?.label || day)
      const periodName = String(props.state.periods.find((p) => String(p.id) === String(periodId))?.name || '')
      toast.push({ type: 'error', title: '老师冲突', detail: `该老师在 ${conflictClass} 的 ${dayLabel} ${periodName} 已安排课程` })
      return
    }

    const unit: ScheduleUnit = {
      id: uid('unit'),
      teacherId,
      groupName: autoGroupNameFromTeacher(teacherId),
    }
    props.onUpsertUnit({ classId, day, periodId, unit })
  }

  const onMoveUnitToCell = (args: {
    from: { classId: string; day: string; periodId: string; unit: ScheduleUnit }
    to: { classId: string; day: string; periodId: string }
  }) => {
    const from = args.from
    const to = args.to

    if (
      String(from.classId) === String(to.classId) &&
      String(from.day) === String(to.day) &&
      String(from.periodId) === String(to.periodId)
    ) {
      return
    }

    const teacherId = String(from.unit.teacherId)
    const targetExisting = getUnitsForCell(props.state.schedule, to.classId, to.day, to.periodId)
    if (targetExisting.some((u) => String(u.teacherId) === teacherId)) {
      toast.push({ type: 'error', title: '不可重复排课', detail: '该老师已在目标节次/班级安排过课程' })
      return
    }

    const conflict = findTeacherConflict({
      state: props.state,
      teacherId,
      day: to.day,
      periodId: to.periodId,
      ignoreUnitId: String(from.unit.id),
    })
    if (conflict) {
      const parsed = parseCellKey(conflict.key)
      const conflictClass = parsed ? className(props.state, parsed.classId) : '其他班级'
      const dayLabel = String(DAYS.find((d) => d.id === String(to.day))?.label || String(to.day))
      const periodName = String(props.state.periods.find((p) => String(p.id) === String(to.periodId))?.name || '')
      toast.push({ type: 'error', title: '老师冲突', detail: `该老师在 ${conflictClass} 的 ${dayLabel} ${periodName} 已安排课程` })
      return
    }

    props.onDeleteUnit({ classId: from.classId, day: from.day, periodId: from.periodId, unitId: String(from.unit.id) })
    props.onUpsertUnit({ classId: to.classId, day: to.day, periodId: to.periodId, unit: from.unit })
    toast.push({ type: 'success', title: '已调整课程位置' })
  }

  const teacherConflictsForEditorSlot = useMemo(() => {
    if (!editorCtx) return new Map<string, string[]>()
    const day = String(editorCtx.day)
    const periodId = String(editorCtx.periodId)

    const byTeacher = new Map<string, Set<string>>()
    for (const [k, units] of Object.entries(props.state.schedule)) {
      const parsed = parseCellKey(k)
      if (!parsed) continue
      if (String(parsed.day) !== day || String(parsed.periodId) !== periodId) continue
      if (!Array.isArray(units)) continue
      for (const u of units) {
        if (editingUnitId && String((u as any)?.id) === String(editingUnitId)) continue
        const tid = String((u as any)?.teacherId || '')
        if (!tid) continue
        const set = byTeacher.get(tid) ?? new Set<string>()
        set.add(String(parsed.classId))
        byTeacher.set(tid, set)
      }
    }

    const out = new Map<string, string[]>()
    for (const [tid, set] of byTeacher.entries()) {
      out.set(tid, Array.from(set))
    }
    return out
  }, [editorCtx, editingUnitId, props.state.schedule])

  const teacherOptionLabel = (teacherId: string) => {
    const t = props.state.teachers.find((x) => String(x.id) === String(teacherId))
    const base = `${String(t?.name || '未命名老师')}（${String(t?.subject || '')}）`

    if (!editorCtx) return base
    const conflictClassIds = teacherConflictsForEditorSlot.get(String(teacherId)) ?? []
    if (conflictClassIds.length === 0) return base

    const names = conflictClassIds
      .map((cid) => className(props.state, cid))
      .filter((x) => x.trim().length > 0)

    const shown = names.slice(0, 2).join('、')
    const suffix = names.length > 2 ? `${shown}…` : shown
    return `${base}（当前在：${suffix}）`
  }

  const saveUnit = () => {
    if (!editorCtx) return
    const nextTeacherId = String(draftTeacherId).trim()
    if (!nextTeacherId) {
      toast.push({ type: 'error', title: '请选择老师', detail: '走班单元必须绑定老师' })
      return
    }

    const groupName = autoGroupNameFromTeacher(nextTeacherId)

    const conflict = findTeacherConflict({
      state: props.state,
      teacherId: nextTeacherId,
      day: editorCtx.day,
      periodId: editorCtx.periodId,
      ignoreUnitId: editingUnitId || undefined,
    })
    if (conflict) {
      toast.push({ type: 'error', title: '老师冲突', detail: '该老师在同一时间已安排其他课程，已中断操作。' })
      return
    }

    const unit: ScheduleUnit = {
      id: editingUnitId || uid('unit'),
      teacherId: nextTeacherId,
      groupName,
    }
    props.onUpsertUnit({ ...editorCtx, unit })
    toast.push({ type: 'success', title: '已更新排课单元' })
    closeEditor()
  }

  const renderClassMode = () => {
    if (!classId) {
      return (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
          <div className="font-display text-lg font-semibold">还没有班级</div>
          <div className="mt-2 text-sm text-slate-600">先在“管理中心”添加班级与节次。</div>
        </div>
      )
    }
    if (props.state.periods.length === 0) {
      return (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
          <div className="font-display text-lg font-semibold">还没有节次</div>
          <div className="mt-2 text-sm text-slate-600">先在“管理中心”添加节次，再进行走班排课。</div>
        </div>
      )
    }

    return (
      <div className="rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              <BookOpen className="h-4 w-4" />
              班级视图
            </div>
            <div className="w-64">
              <Select value={classId} onChange={(e) => setActiveClassId(e.target.value)}>
                {props.state.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {String(c.name) || '未命名班级'}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="text-xs text-slate-600">拖拽老师到课表格子即可排课；点击单元可编辑。</div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="text-xs font-semibold text-slate-700">老师列表（拖拽排课）</div>
          <div className="mt-3 flex gap-3 overflow-auto pb-1">
            {props.state.teachers.length === 0 ? (
              <div className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">还没有老师。</div>
            ) : (
              props.state.teachers.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => {
                    setDragKind('teacher')
                    setDndPayload(e.dataTransfer, { kind: 'teacher', teacherId: String(t.id) })
                    e.dataTransfer.effectAllowed = 'copy'
                  }}
                  onDragEnd={() => setDragKind('')}
                  className="min-w-[220px] cursor-grab select-none rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200 active:cursor-grabbing"
                  title="拖拽到课表格子进行排课"
                >
                  <div className="truncate text-sm font-semibold text-slate-900">{String(t.name) || '未命名老师'}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Pill color={courseColorForTeacher(props.state, t.id)}>{String(t.subject) || '未设置科目'}</Pill>
                    <span className="text-xs text-slate-500">课时 {String(teacherLoadCount(props.state.schedule, t.id))}</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 text-[11px] text-slate-500">规则：同一时间点同一老师只能在一个班上课；同一格子不能重复放同一老师。</div>
        </div>

        <div className="overflow-auto">
          <div className="min-w-[1120px]">
            <div className="grid border-b border-slate-200 bg-slate-50" style={gridStyle}>
              <div className="px-4 py-3 text-xs font-semibold text-slate-700">节次</div>
              {DAYS.map((d) => (
                <div key={d.id} className="px-4 py-3 text-xs font-semibold text-slate-700">
                  <div className="leading-tight">
                    <div>{String(d.label)}</div>
                    <div className="mt-0.5 text-[11px] font-medium text-slate-500">{String(dayDateLabel[d.id] || '')}</div>
                  </div>
                </div>
              ))}
            </div>

            {props.state.periods.map((p) => (
              <div key={p.id} className="grid border-b border-slate-100 last:border-b-0" style={gridStyle}>
                <div className="px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">{String(p.name)}</div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {String(p.startTime)} - {String(p.endTime)}
                  </div>
                </div>

                {DAYS.map((d) => {
                  const key = `${classId}-${d.id}-${p.id}`
                  const units = props.state.schedule[key] ?? []
                  return (
                    <div key={d.id} className="px-2 py-2">
                      <div
                        className={
                          'group h-full rounded-2xl p-2 ring-1 ring-slate-200/70 ' +
                          (hoverDropKey === key ? 'bg-white ring-sky-200' : 'bg-slate-50')
                        }
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = dragKind === 'unit' ? 'move' : 'copy'
                        }}
                        onDragEnter={() => setHoverDropKey(key)}
                        onDragLeave={() => {
                          setHoverDropKey((cur) => (cur === key ? '' : cur))
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          const payload = getDndPayload(e.dataTransfer)
                          setHoverDropKey('')
                          if (payload?.kind === 'unit' && payload?.from) {
                            onMoveUnitToCell({
                              from: payload.from,
                              to: { classId, day: d.id, periodId: p.id },
                            })
                            return
                          }
                          const teacherId = String(payload?.teacherId || '')
                          onDropTeacherToCell({ teacherId, classId, day: d.id, periodId: p.id })
                        }}
                      >
                        {units.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-white/40 px-3 py-2 text-xs font-semibold text-slate-500">
                            拖拽老师到此排课
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {units.map((u) => (
                              <div
                                key={u.id}
                                className="max-w-full"
                                draggable
                                onDragStart={(e) => {
                                  setDragKind('unit')
                                  setDndPayload(e.dataTransfer, {
                                    kind: 'unit',
                                    from: {
                                      classId: String(classId),
                                      day: String(d.id),
                                      periodId: String(p.id),
                                      unit: {
                                        id: String(u.id),
                                        teacherId: String(u.teacherId),
                                        groupName: String(u.groupName),
                                      },
                                    },
                                  })
                                  e.dataTransfer.effectAllowed = 'move'
                                }}
                                onDragEnd={() => setDragKind('')}
                              >
                                <button
                                  className="max-w-full cursor-grab text-left active:cursor-grabbing"
                                  onClick={() => openCellEditor({ classId, day: d.id, periodId: p.id }, u)}
                                  title="拖拽可调整；点击可编辑"
                                  type="button"
                                >
                                  <span
                                    className={
                                      isHighlighted(u.id)
                                        ? 'inline-flex rounded-full ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-50'
                                        : ''
                                    }
                                  >
                                    <Pill color={courseColorForTeacher(props.state, u.teacherId)}>
                                      {String(teacherName(props.state, u.teacherId))} · {String(u.groupName)}
                                    </Pill>
                                  </span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderTeacherMode = () => {
    if (props.state.teachers.length === 0) {
      return (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
          <div className="font-display text-lg font-semibold">还没有老师</div>
          <div className="mt-2 text-sm text-slate-600">先在“管理中心”录入老师与科目。</div>
        </div>
      )
    }

    return (
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
              <Users className="h-4 w-4" />
              教师视图
            </div>
            <div className="mt-3 text-xs text-slate-600">侧边栏为老师负荷排序；右侧为个人周课表。</div>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">{String(teacherName(props.state, teacherId))}</div>
              <div className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                {String(loadCount)}/{String(maxLoad)}
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-100 ring-1 ring-slate-200">
              <div
                className="h-2 rounded-full"
                style={{ width: `${loadPct}%`, background: 'linear-gradient(90deg, #0ea5e9, #14b8a6)' }}
              />
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto px-3 pb-4">
            {teacherLoads.map((t) => {
              const name = teacherName(props.state, t.teacherId)
              const isActive = String(t.teacherId) === String(teacherId)
              const color = courseColorForTeacher(props.state, t.teacherId)
              return (
                <button
                  key={t.teacherId}
                  className={
                    'mb-2 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left ring-1 transition ' +
                    (isActive
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50')
                  }
                  onClick={() => setActiveTeacherId(String(t.teacherId))}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{String(name)}</div>
                    <div className={"mt-0.5 truncate text-xs " + (isActive ? 'text-white/70' : 'text-slate-600')}>
                      {String(props.state.teachers.find((x) => String(x.id) === String(t.teacherId))?.subject || '')}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <span
                      className={
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ' +
                        (isActive ? 'bg-white/15 text-white' : '')
                      }
                      style={isActive ? {} : { backgroundColor: `${color}18`, color, border: `1px solid ${color}45` }}
                    >
                      {String(t.count)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-white ring-1 ring-slate-200">
          <div className="overflow-auto">
            <div className="min-w-[1120px]">
              <div className="grid border-b border-slate-200 bg-slate-50" style={gridStyle}>
                <div className="px-4 py-3 text-xs font-semibold text-slate-700">节次</div>
                {DAYS.map((d) => (
                  <div key={d.id} className="px-4 py-3 text-xs font-semibold text-slate-700">
                    <div className="leading-tight">
                      <div>{String(d.label)}</div>
                      <div className="mt-0.5 text-[11px] font-medium text-slate-500">{String(dayDateLabel[d.id] || '')}</div>
                    </div>
                  </div>
                ))}
              </div>

              {props.state.periods.map((p) => (
                <div key={p.id} className="grid border-b border-slate-100 last:border-b-0" style={gridStyle}>
                  <div className="px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">{String(p.name)}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {String(p.startTime)} - {String(p.endTime)}
                    </div>
                  </div>

                  {DAYS.map((d) => {
                    const items: Array<{ classId: string; unit: ScheduleUnit }> = []
                    for (const c of props.state.classes) {
                      const key = `${c.id}-${d.id}-${p.id}`
                      const units = props.state.schedule[key] ?? []
                      for (const u of units) {
                        if (String(u.teacherId) === String(teacherId)) items.push({ classId: c.id, unit: u })
                      }
                    }

                    return (
                      <div key={d.id} className="px-2 py-2">
                        <button
                          type="button"
                          className="h-full w-full rounded-2xl bg-slate-50 p-2 text-left ring-1 ring-slate-200/70 hover:bg-white"
                          onClick={() => {
                            setSlotActionsCtx({ day: d.id, periodId: p.id })
                            setSlotActionsPickSrcUnitId('')
                            const first = props.state.classes.find((c) => !isClassSlotOccupied(c.id, d.id, p.id))
                            setAddPickClassId(String(first?.id || ''))
                            setSlotActionsOpen(true)
                          }}
                          title={items.length === 0 ? '点击加课' : '点击调课'}
                        >
                          <div className="flex flex-wrap gap-2">
                            {items.length === 0 ? (
                              <span className="text-xs text-slate-400">空（点击加课）</span>
                            ) : (
                              items.map((it) => (
                                <span
                                  key={it.unit.id}
                                  className={
                                    isHighlighted(it.unit.id)
                                      ? 'inline-flex rounded-full ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-50'
                                      : ''
                                  }
                                >
                                  <Pill color={courseColorForTeacher(props.state, it.unit.teacherId)}>
                                    {String(className(props.state, it.classId))} · {String(it.unit.groupName)}
                                  </Pill>
                                </span>
                              ))
                            )}
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <button
            className={
              'px-6 py-3 text-sm font-semibold transition ' +
              (mode === 'class' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')
            }
            onClick={() => setMode('class')}
          >
            班级视图
          </button>
          <button
            className={
              'px-6 py-3 text-sm font-semibold transition ' +
              (mode === 'teacher' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50')
            }
            onClick={() => setMode('teacher')}
          >
            教师视图
          </button>
        </div>

        <div className="text-xs text-slate-600">提示：当前为本地自动保存；周存档删除会在自动保存后生效。</div>
      </div>

      {mode === 'class' ? renderClassMode() : renderTeacherMode()}

      <Modal
        open={editorOpen}
        title="走班单元"
        onClose={closeEditor}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">老师变更会触发全表冲突检测。</div>
            <div className="flex gap-2">
              <Button onClick={closeEditor}>取消</Button>
              <Button variant="primary" onClick={saveUnit}>
                保存
              </Button>
            </div>
          </div>
        }
      >
        {editorCtx ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 ring-1 ring-slate-200/70">
              班级：{String(className(props.state, editorCtx.classId))} ｜ {String(DAYS.find((x) => x.id === editorCtx.day)?.label)} ｜
              节次：{String(props.state.periods.find((x) => String(x.id) === String(editorCtx.periodId))?.name || '')}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700">老师</div>
              <Select
                value={draftTeacherId}
                onChange={(e) => {
                  const next = String(e.target.value)
                  const conflicts = teacherConflictsForEditorSlot.get(next) ?? []
                  if (next && conflicts.length > 0) {
                    toast.push({
                      type: 'error',
                      title: '该老师不可选',
                      detail: `同一时间已在：${String(conflicts.map((cid) => className(props.state, cid)).join('、'))}`,
                    })
                    return
                  }
                  setDraftTeacherId(next)
                }}
              >
                <option value="">请选择</option>
                {props.state.teachers.map((t) => (
                  <option
                    key={t.id}
                    value={t.id}
                    disabled={(teacherConflictsForEditorSlot.get(String(t.id)) ?? []).length > 0}
                  >
                    {String(teacherOptionLabel(t.id))}
                  </option>
                ))}
              </Select>
              <div className="mt-2 text-xs text-slate-600">
                课程将自动匹配该老师科目：<span className="font-semibold text-slate-900">{String(draftTeacherId ? autoGroupNameFromTeacher(draftTeacherId) : '—')}</span>
              </div>
            </div>

            {editingUnitId && editorCtx ? (
              <div className="flex justify-end">
                <Button
                  variant="danger"
                  onClick={() => {
                    props.onDeleteUnit({ ...editorCtx, unitId: editingUnitId })
                    toast.push({ type: 'success', title: '已删除走班单元' })
                    closeEditor()
                  }}
                >
                  删除
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={slotActionsOpen}
        title="本节操作（教师视图）"
        onClose={closeSlotActions}
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">点击空白节次将加课；点击已有课程将调课。</div>
            <div className="flex gap-2">
              <Button onClick={closeSlotActions}>关闭</Button>
            </div>
          </div>
        }
      >
        {slotActionsCtx ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200/70">
              {String(DAYS.find((x) => x.id === slotActionsCtx.day)?.label || slotActionsCtx.day)}（{String(dayDateLabel[slotActionsCtx.day] || '')}） ·
              {String(props.state.periods.find((x) => String(x.id) === String(slotActionsCtx.periodId))?.name || '')}
            </div>

            {lessonsForTeacherAt.length === 0 ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">空白节次</div>
                <div>
                  <div className="text-xs font-semibold text-slate-700">选择班级</div>
                  <Select value={addPickClassId} onChange={(e) => setAddPickClassId(String(e.target.value))}>
                    <option value="">请选择</option>
                    {props.state.classes.map((c) => {
                      const occupied = isClassSlotOccupied(c.id, slotActionsCtx.day, slotActionsCtx.periodId)
                      return (
                        <option key={c.id} value={c.id} disabled={occupied}>
                          {String(c.name) || '未命名班级'}{occupied ? '（该节已排课）' : ''}
                        </option>
                      )
                    })}
                  </Select>
                  <div className="mt-1 text-[11px] text-slate-500">不可选表示该班级在该时间点已有课程。</div>
                </div>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    if (!addPickClassId) {
                      toast.push({ type: 'error', title: '请选择班级', detail: '加课需要指定班级' })
                      return
                    }
                    quickAddLessonForSlot(slotActionsCtx.day, slotActionsCtx.periodId, addPickClassId)
                    closeSlotActions()
                  }}
                >
                  加课
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">已有课程（将进行调课）</div>
                {lessonsForTeacherAt.length > 1 ? (
                  <div>
                    <div className="text-xs font-semibold text-slate-700">选择要调的那节课</div>
                    <Select value={slotActionsPickSrcUnitId} onChange={(e) => setSlotActionsPickSrcUnitId(String(e.target.value))}>
                      <option value="">请选择</option>
                      {lessonsForTeacherAt.map((x) => (
                        <option key={x.unit.id} value={x.unit.id}>
                          {String(className(props.state, x.classId))} · {String(x.unit.groupName)}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : null}

                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    const src =
                      lessonsForTeacherAt.length === 1
                        ? lessonsForTeacherAt[0]
                        : lessonsForTeacherAt.find((x) => String(x.unit.id) === String(slotActionsPickSrcUnitId)) || null
                    if (!src) {
                      toast.push({ type: 'error', title: '请选择课程', detail: '该节次有多节课，请先选择要调的那一节' })
                      return
                    }
                    closeSlotActions()
                    openSwapModal({ classId: src.classId, day: src.day, periodId: src.periodId, unit: src.unit })
                  }}
                >
                  调课
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={swapOpen}
        title="调课（教师视图）"
        onClose={closeSwapModal}
        widthClassName="max-w-6xl"
        bodyClassName="px-5 py-4"
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">点选左侧老师，再点选右侧可交换的课时（灰色为不可选）。</div>
            <div className="flex gap-2">
              <Button onClick={closeSwapModal}>取消</Button>
            </div>
          </div>
        }
      >
        {swapSrc ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 ring-1 ring-slate-200/70">
              当前课程：{String(className(props.state, swapSrc.classId))} ·
              {String(DAYS.find((x) => x.id === swapSrc.day)?.label || swapSrc.day)} ·
              {String(props.state.periods.find((x) => String(x.id) === String(swapSrc.periodId))?.name || '')} ·
              {String(swapSrc.unit.groupName)}
            </div>

            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
              <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
                <div className="text-xs font-semibold text-slate-700">备选老师</div>
                <div className="mt-2 max-h-[360px] overflow-auto pr-1">
                  {props.state.teachers
                    .filter((t) => String(t.id) !== String(swapSrc.unit.teacherId))
                    .map((t) => {
                      const isActive = String(t.id) === String(swapTargetTeacherId)
                      return (
                        <button
                          key={t.id}
                          className={
                            'mb-2 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left ring-1 transition ' +
                            (isActive
                              ? 'bg-slate-900 text-white ring-slate-900'
                              : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50')
                          }
                          onClick={() => setSwapTargetTeacherId(String(t.id))}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{String(t.name) || '未命名老师'}</div>
                            <div className={"mt-0.5 truncate text-xs " + (isActive ? 'text-white/70' : 'text-slate-600')}>
                              {String(t.subject)}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                </div>
              </div>

              <div className="rounded-2xl bg-white ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {swapTargetTeacherId ? `可选课时：${String(teacherName(props.state, swapTargetTeacherId))}` : '请先选择左侧老师'}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-600">仅显示该老师已有课程；灰色不可选表示与当前课冲突。</div>
                </div>

                <div className="p-4">
                  {!swapTargetTeacherId ? (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                      请选择左侧老师。
                    </div>
                  ) : sortedTargetLessons.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                      该老师当前周没有课程可调换。
                    </div>
                  ) : (
                    <div className="flex gap-4 overflow-auto pb-2">
                      {targetLessonsByDay.map((g) => {
                        const dayLabel = DAYS.find((d) => d.id === g.day)?.label || g.day
                        const dateLabel = dayDateLabel[String(g.day)] || ''
                        return (
                          <div key={g.day} className="min-w-[320px] rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                            <div className="flex items-baseline justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900">{String(dayLabel)}</div>
                              <div className="text-xs font-semibold text-slate-500">{String(dateLabel)}</div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {g.lessons.map((tgtLesson) => {
                                const check = canSwapWith(tgtLesson)
                                const disabled = !check.ok
                                const period = props.state.periods.find((p) => String(p.id) === String(tgtLesson.periodId))
                                const periodName = String(period?.name || '')
                                const timeRange = period?.startTime && period?.endTime ? `${String(period.startTime)}-${String(period.endTime)}` : ''
                                return (
                                  <button
                                    key={tgtLesson.unit.id}
                                    type="button"
                                    disabled={disabled}
                                    className={
                                      'w-full rounded-2xl p-3 text-left ring-1 transition ' +
                                      (disabled
                                        ? 'cursor-not-allowed bg-slate-100/70 text-slate-500 ring-slate-200'
                                        : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50')
                                    }
                                    title={disabled ? String(check.reason || '不可选') : '点击选择此课时进行调课'}
                                    onClick={() => {
                                      const plan = { src: swapSrc, tgt: tgtLesson }
                                      setSwapPlan(plan)
                                      setSwapConfirmOpen(true)
                                    }}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-slate-900">{String(periodName)}</div>
                                        <div className="mt-0.5 text-xs text-slate-600">
                                          {timeRange ? String(timeRange) + ' · ' : ''}
                                          {String(className(props.state, tgtLesson.classId))}
                                        </div>
                                      </div>
                                      <div className="shrink-0">
                                        <Pill color={disabled ? '#94a3b8' : courseColorForTeacher(props.state, tgtLesson.unit.teacherId)}>
                                          {String(tgtLesson.unit.groupName)}
                                        </Pill>
                                      </div>
                                    </div>
                                    {disabled && check.reason ? <div className="mt-2 text-[11px] text-slate-600">{String(check.reason)}</div> : null}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={swapConfirmOpen}
        title="二次确认：调课变更预览"
        onClose={closeSwapConfirm}
        widthClassName="max-w-5xl"
        bodyClassName="px-5 py-4"
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-600">请确认调整前/调整后信息无误后再执行。</div>
            <div className="flex gap-2">
              <Button onClick={closeSwapConfirm}>返回修改</Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!swapPlan) return
                  executeSwapPlan(swapPlan)
                }}
              >
                确定执行
              </Button>
            </div>
          </div>
        }
      >
        {swapPlan ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold text-slate-700">调整前（老师 A）</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{String(teacherName(props.state, swapPlan.src.unit.teacherId))}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {String(DAYS.find((d) => d.id === swapPlan.src.day)?.label || swapPlan.src.day)}（{String(dayDateLabel[swapPlan.src.day] || '')}） ·
                  {String(props.state.periods.find((p) => String(p.id) === String(swapPlan.src.periodId))?.name || '')} ·
                  {String(className(props.state, swapPlan.src.classId))}
                </div>
                <div className="mt-2 text-xs text-slate-700">{String(swapPlan.src.unit.groupName)}</div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold text-slate-700">调整前（老师 B）</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{String(teacherName(props.state, swapPlan.tgt.unit.teacherId))}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {String(DAYS.find((d) => d.id === swapPlan.tgt.day)?.label || swapPlan.tgt.day)}（{String(dayDateLabel[swapPlan.tgt.day] || '')}） ·
                  {String(props.state.periods.find((p) => String(p.id) === String(swapPlan.tgt.periodId))?.name || '')} ·
                  {String(className(props.state, swapPlan.tgt.classId))}
                </div>
                <div className="mt-2 text-xs text-slate-700">{String(swapPlan.tgt.unit.groupName)}</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="text-xs font-semibold text-slate-700">调整后（老师 A）</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{String(teacherName(props.state, swapPlan.src.unit.teacherId))}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {String(DAYS.find((d) => d.id === swapPlan.tgt.day)?.label || swapPlan.tgt.day)}（{String(dayDateLabel[swapPlan.tgt.day] || '')}） ·
                  {String(props.state.periods.find((p) => String(p.id) === String(swapPlan.tgt.periodId))?.name || '')} ·
                  {String(className(props.state, swapPlan.src.classId))}
                </div>
                <div className="mt-2 text-xs text-slate-700">{String(swapPlan.src.unit.groupName)}</div>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <div className="text-xs font-semibold text-slate-700">调整后（老师 B）</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{String(teacherName(props.state, swapPlan.tgt.unit.teacherId))}</div>
                <div className="mt-1 text-xs text-slate-600">
                  {String(DAYS.find((d) => d.id === swapPlan.src.day)?.label || swapPlan.src.day)}（{String(dayDateLabel[swapPlan.src.day] || '')}） ·
                  {String(props.state.periods.find((p) => String(p.id) === String(swapPlan.src.periodId))?.name || '')} ·
                  {String(className(props.state, swapPlan.tgt.classId))}
                </div>
                <div className="mt-2 text-xs text-slate-700">{String(swapPlan.tgt.unit.groupName)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">请选择调课目标以生成预览。</div>
        )}
      </Modal>

    </div>
  )
}
