import { useMemo, useState, type CSSProperties } from 'react'
import { BookOpen, Plus, Users } from 'lucide-react'
import type { AppState, ScheduleUnit } from '../lib/types'
import { DAYS, findTeacherConflict, teacherLoadCount } from '../lib/schedule'
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

export function ScheduleLab(props: {
  state: AppState
  onUpsertUnit: (args: { classId: string; day: string; periodId: string; unit: ScheduleUnit }) => void
  onDeleteUnit: (args: { classId: string; day: string; periodId: string; unitId: string }) => void
  courseNames: string[]
  weekStartYmd: string
}) {
  const toast = useToast()
  const [mode, setMode] = useState<Mode>('class')
  const [activeClassId, setActiveClassId] = useState<string>('')
  const [activeTeacherId, setActiveTeacherId] = useState<string>('')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorCtx, setEditorCtx] = useState<{ classId: string; day: string; periodId: string } | null>(null)
  const [editingUnitId, setEditingUnitId] = useState<string>('')
  const [draftTeacherId, setDraftTeacherId] = useState<string>('')

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

  const autoGroupNameFromTeacher = (teacherId: string) => {
    const t = props.state.teachers.find((x) => String(x.id) === String(teacherId))
    const subject = String(t?.subject || '').trim()
    return subject || '未设置科目'
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
          <div className="text-xs text-slate-600">单格支持多个走班单元；点击单元可编辑。</div>
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
                      <div className="group h-full rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
                        <div className="flex flex-wrap gap-2">
                          {units.map((u) => (
                            <button
                              key={u.id}
                              className="max-w-full text-left"
                              onClick={() => openCellEditor({ classId, day: d.id, periodId: p.id }, u)}
                              title="点击编辑"
                            >
                              <Pill color={courseColorForTeacher(props.state, u.teacherId)}>
                                {String(teacherName(props.state, u.teacherId))} · {String(u.groupName)}
                              </Pill>
                            </button>
                          ))}
                        </div>
                        <button
                          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white"
                          onClick={() => openCellEditor({ classId, day: d.id, periodId: p.id })}
                        >
                          <Plus className="h-4 w-4" />
                          添加走班
                        </button>
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
                        <div className="h-full rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
                          <div className="flex flex-wrap gap-2">
                            {items.length === 0 ? (
                              <span className="text-xs text-slate-400">空</span>
                            ) : (
                              items.map((it) => (
                                <Pill key={it.unit.id} color={courseColorForTeacher(props.state, it.unit.teacherId)}>
                                  {String(className(props.state, it.classId))} · {String(it.unit.groupName)}
                                </Pill>
                              ))
                            )}
                          </div>
                        </div>
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

        <div className="text-xs text-slate-600">提示：云端保存为全量覆写；清空本地仅清 schedule，需保存才影响云端。</div>
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
              <Select value={draftTeacherId} onChange={(e) => setDraftTeacherId(e.target.value)}>
                <option value="">请选择</option>
                {props.state.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {String(t.name) || '未命名老师'}（{String(t.subject)}）
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
    </div>
  )
}
