import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, HardDriveDownload, LayoutGrid, Settings2, Sparkles } from 'lucide-react'
import { ToastProvider, useToast } from './components/Toast'
import { Button } from './components/ui'
import { ManagementCenter } from './components/ManagementCenter'
import { ScheduleLab } from './components/ScheduleLab'
import { AIPanel } from './components/AIPanel'
import {
  loadLastSelectedDate,
  loadLocalConfig,
  listWeekArchives,
  loadWeekSchedule,
  deleteWeekArchive,
  saveLastSelectedDate,
  saveLocalConfig,
  saveWeekSchedule,
} from './lib/localState'
import { formatYMD, weekRangeLabel, weekStartFromYMD, weekStartMonday, addDays } from './lib/week'
import { DAYS } from './lib/schedule'
import { useAppState } from './state/useAppState'

type Tab = 'manage' | 'schedule' | 'ai'

function AppInner() {
  const toast = useToast()
  const { state, dispatch, upsertCourseByName, helpers } = useAppState()
  const [tab, setTab] = useState<Tab>('manage')
  const [archivesOpen, setArchivesOpen] = useState(false)
  const [archivesVersion, setArchivesVersion] = useState(0)
  const [pendingDeleteWeeks, setPendingDeleteWeeks] = useState<string[]>([])

  const [autoSaveState, setAutoSaveState] = useState<'ready' | 'pending' | 'saving' | 'error'>('ready')
  const [lastSavedAt, setLastSavedAt] = useState<number>(0)
  const lastSavedSigRef = useRef<string>('')
  const autoSaveTimerRef = useRef<number | null>(null)

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const last = loadLastSelectedDate()
    if (last) return last
    return formatYMD(new Date())
  })

  const weekStartYmd = useMemo(() => {
    const ws = weekStartFromYMD(selectedDate) ?? weekStartMonday(new Date())
    return formatYMD(ws)
  }, [selectedDate])

  const weekLabel = useMemo(() => {
    const ws = weekStartFromYMD(selectedDate) ?? weekStartMonday(new Date())
    return weekRangeLabel(ws)
  }, [selectedDate])

  const archives = useMemo(() => {
    void archivesVersion
    return listWeekArchives()
  }, [archivesVersion])

  const visibleArchives = useMemo(() => {
    if (pendingDeleteWeeks.length === 0) return archives
    const s = new Set(pendingDeleteWeeks.map(String))
    return archives.filter((a) => !s.has(String(a.weekStartYmd)))
  }, [archives, pendingDeleteWeeks])

  const labelForDay = (dayId: string) => {
    return String(DAYS.find((d) => d.id === dayId)?.label || dayId)
  }

  const nameForTeacher = (teacherId: string) => {
    return String(state.teachers.find((t) => String(t.id) === String(teacherId))?.name || teacherId)
  }

  const nameForClass = (classId: string) => {
    return String(state.classes.find((c) => String(c.id) === String(classId))?.name || classId)
  }

  const nameForPeriod = (periodId: string) => {
    return String(state.periods.find((p) => String(p.id) === String(periodId))?.name || periodId)
  }

  useEffect(() => {
    const config = loadLocalConfig() ?? {}
    dispatch({
      type: 'hydrate',
      payload: {
        ...config,
        schedule: {},
      } as any,
    })
  }, [dispatch])

  useEffect(() => {
    // load schedule for selected week
    const sched = loadWeekSchedule(weekStartYmd) ?? {}
    dispatch({ type: 'setSchedule', schedule: sched })
    saveLastSelectedDate(selectedDate)

    // treat loaded week as baseline (avoid auto-updating timestamps on open)
    lastSavedSigRef.current = ''
  }, [dispatch, selectedDate, weekStartYmd])

  const signatureNow = (pending: string[]) => {
    return JSON.stringify({
      config: {
        teachers: state.teachers,
        classes: state.classes,
        periods: state.periods,
        courses: state.courses,
      },
      weekStartYmd,
      schedule: state.schedule,
      pendingDeleteWeeks: [...pending].sort(),
    })
  }

  const flushSaveToLocal = (opts?: { toast?: boolean }) => {
    try {
      setAutoSaveState('saving')

      saveLocalConfig({
        teachers: state.teachers,
        classes: state.classes,
        periods: state.periods,
        courses: state.courses,
      })

      const pending = new Set(pendingDeleteWeeks.map(String))
      for (const w of pending) deleteWeekArchive(w)

      if (!pending.has(String(weekStartYmd))) {
        saveWeekSchedule(weekStartYmd, state.schedule)
      }

      if (pending.size > 0) setPendingDeleteWeeks([])
      setArchivesVersion((v) => v + 1)

      lastSavedSigRef.current = signatureNow([])
      setLastSavedAt(Date.now())
      setAutoSaveState('ready')

      if (opts?.toast) {
        if (pending.size > 0 && pending.has(String(weekStartYmd))) {
          toast.push({ type: 'success', title: '已保存', detail: `已提交删除 ${String(pending.size)} 个周存档（当前周已删除）` })
        } else if (pending.size > 0) {
          toast.push({ type: 'success', title: '已保存', detail: `已自动保存本周，并提交删除 ${String(pending.size)} 个周存档` })
        } else {
          toast.push({ type: 'success', title: '已保存', detail: `已自动保存：${String(weekLabel)}` })
        }
      }
    } catch (e: any) {
      setAutoSaveState('error')
      if (opts?.toast) toast.push({ type: 'error', title: '本地保存失败', detail: String(e?.message || e) })
    }
  }

  useEffect(() => {
    if (!state.hasLoaded) return

    const sig = signatureNow(pendingDeleteWeeks)
    if (!lastSavedSigRef.current) {
      // first render for this week: set baseline and do not write
      lastSavedSigRef.current = sig
      setAutoSaveState('ready')
      return
    }
    if (sig === lastSavedSigRef.current) return

    setAutoSaveState('pending')
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = window.setTimeout(() => {
      flushSaveToLocal()
    }, 900)

    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [
    state.hasLoaded,
    state.teachers,
    state.classes,
    state.periods,
    state.courses,
    state.schedule,
    pendingDeleteWeeks,
    weekStartYmd,
  ])

  const handleClearLocal = () => {
    dispatch({ type: 'clearLocalSchedule' })
    toast.push({ type: 'info', title: '已清空本周课表', detail: '将自动保存到本地存档' })
  }

  const courseNames = Array.from(new Set(state.courses.map((c) => String(c.name)).filter((x) => x.trim().length > 0)))

  return (
    <div className="min-h-screen font-sans">
      <div className="mx-auto max-w-[1400px] px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="font-display text-2xl font-semibold text-slate-900">智能走班排课实验室</div>
            <div className="mt-1 text-sm text-slate-600">React + Tailwind + LocalStorage + Gemini · 高密度交互排课引擎</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
            >
              <HardDriveDownload className="h-4 w-4" />
              {state.hasLoaded ? `本地周课表：${String(weekLabel)}` : '加载中'}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
              <button
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const dt = weekStartFromYMD(selectedDate) ?? weekStartMonday(new Date())
                  setSelectedDate(formatYMD(addDays(dt, -7)))
                }}
                title="上一周"
              >
                上周
              </button>
              <input
                type="date"
                className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-800"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
              <button
                className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  const dt = weekStartFromYMD(selectedDate) ?? weekStartMonday(new Date())
                  setSelectedDate(formatYMD(addDays(dt, 7)))
                }}
                title="下一周"
              >
                下周
              </button>
            </div>

            <div className="relative">
              <Button
                onClick={() => {
                  setArchivesOpen((o) => !o)
                  setArchivesVersion((v) => v + 1)
                }}
              >
                <CalendarDays className="h-4 w-4" />
                周存档
              </Button>

              {archivesOpen ? (
                <div className="absolute right-0 top-12 z-30 w-[520px] overflow-hidden rounded-2xl bg-white shadow-soft-lg ring-1 ring-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">周存档预览（点击跳转）</div>
                    {pendingDeleteWeeks.length > 0 ? (
                      <div className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                        已标记删除 {String(pendingDeleteWeeks.length)}
                      </div>
                    ) : null}
                    <button
                      className="rounded-xl px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      onClick={() => setArchivesOpen(false)}
                    >
                      关闭
                    </button>
                  </div>

                  <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-3">
                    {visibleArchives.length === 0 ? (
                      <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 ring-1 ring-slate-200">
                        还没有周存档。先点一次“保存本周”。
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {visibleArchives.map((a) => {
                          const ws = weekStartFromYMD(a.weekStartYmd) ?? weekStartMonday(new Date())
                          const label = weekRangeLabel(ws)
                          const isActive = a.weekStartYmd === weekStartYmd
                          return (
                            <div
                              key={a.weekStartYmd}
                              className={
                                'w-full rounded-2xl p-3 text-left ring-1 transition ' +
                                (isActive
                                  ? 'bg-slate-900 text-white ring-slate-900'
                                  : 'bg-white text-slate-900 ring-slate-200 hover:bg-slate-50')
                              }
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedDate(a.weekStartYmd)
                                setArchivesOpen(false)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  setSelectedDate(a.weekStartYmd)
                                  setArchivesOpen(false)
                                }
                              }}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold">{String(label)}</div>
                                  <div className={"mt-0.5 text-xs " + (isActive ? 'text-white/75' : 'text-slate-600')}>
                                    单元数：{String(a.unitCount)}
                                  </div>
                                </div>
                                <div
                                  className={
                                    'shrink-0 rounded-full px-3 py-1 text-xs font-semibold ' +
                                    (isActive ? 'bg-white/15 text-white' : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200')
                                  }
                                >
                                  {String(a.weekStartYmd)}
                                </div>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-2">
                                <div className={"min-w-0 flex-1 space-y-1 text-xs " + (isActive ? 'text-white/80' : 'text-slate-600')}>
                                  {a.samples.length === 0 ? (
                                    <div>（本周暂无排课）</div>
                                  ) : (
                                    a.samples.slice(0, 5).map((s, idx) => (
                                      <div key={idx} className="truncate">
                                        {String(labelForDay(s.day))} · {String(nameForPeriod(s.periodId))} · {String(nameForClass(s.classId))} ·
                                        {String(nameForTeacher(s.teacherId))} · {String(s.groupName)}
                                      </div>
                                    ))
                                  )}
                                </div>

                                <button
                                  className={
                                    'shrink-0 rounded-xl px-3 py-2 text-xs font-semibold ring-1 transition ' +
                                    (isActive
                                      ? 'bg-white/15 text-white ring-white/20 hover:bg-white/20'
                                      : 'bg-white text-rose-700 ring-rose-200 hover:bg-rose-50')
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setPendingDeleteWeeks((prev) => {
                                      const id = String(a.weekStartYmd)
                                      if (prev.includes(id)) return prev
                                      return [...prev, id]
                                    })
                                    toast.push({
                                      type: 'info',
                                      title: '已标记删除',
                                      detail: '当前仅从界面隐藏；自动保存完成后才会真正从本地删除。',
                                    })
                                  }}
                                >
                                  删除
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <Button onClick={handleClearLocal}>清空本地</Button>
            <div
              className={
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold ring-1 ' +
                (autoSaveState === 'error'
                  ? 'bg-rose-50 text-rose-700 ring-rose-200'
                  : autoSaveState === 'saving'
                    ? 'bg-amber-50 text-amber-700 ring-amber-200'
                    : autoSaveState === 'pending'
                      ? 'bg-sky-50 text-sky-700 ring-sky-200'
                      : 'bg-emerald-50 text-emerald-700 ring-emerald-200')
              }
              title={lastSavedAt ? `last saved: ${new Date(lastSavedAt).toLocaleString()}` : ''}
            >
              {autoSaveState === 'saving'
                ? '自动保存中'
                : autoSaveState === 'pending'
                  ? '等待自动保存'
                  : autoSaveState === 'error'
                    ? '自动保存失败'
                    : '自动保存已开启'}
            </div>
            <Button
              variant="primary"
              onClick={() => {
                flushSaveToLocal({ toast: true })
              }}
            >
              立即保存
            </Button>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-2">
          <button
            className={
              'inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold ring-1 transition ' +
              (tab === 'manage' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-800 ring-slate-200 hover:bg-slate-50')
            }
            onClick={() => setTab('manage')}
          >
            <Settings2 className="h-4 w-4" />
            管理中心
          </button>
          <button
            className={
              'inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold ring-1 transition ' +
              (tab === 'schedule' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-800 ring-slate-200 hover:bg-slate-50')
            }
            onClick={() => setTab('schedule')}
          >
            <LayoutGrid className="h-4 w-4" />
            排课引擎
          </button>
          <button
            className={
              'inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold ring-1 transition ' +
              (tab === 'ai' ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-800 ring-slate-200 hover:bg-slate-50')
            }
            onClick={() => setTab('ai')}
          >
            <Sparkles className="h-4 w-4" />
            AI 工具箱
          </button>
        </div>

        <div className="mt-8">
          {!state.hasLoaded ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-slate-700 ring-1 ring-slate-200">正在加载本地数据...</div>
          ) : tab === 'manage' ? (
            <ManagementCenter
              state={state}
              onSetTeachers={(teachers) => dispatch({ type: 'setTeachers', teachers })}
              onSetClasses={(classes) => dispatch({ type: 'setClasses', classes })}
              onSetPeriods={(periods) => dispatch({ type: 'setPeriods', periods })}
              onUpsertCourseByName={upsertCourseByName}
              onAddPeriod={() => dispatch({ type: 'setPeriods', periods: [...state.periods, helpers.createNextPeriod()] })}
              onUpdatePeriodStart={helpers.updatePeriodStartTime}
              onUpdatePeriodEnd={helpers.updatePeriodEndTime}
            />
          ) : tab === 'schedule' ? (
            <ScheduleLab
              state={state}
              courseNames={courseNames}
              weekStartYmd={weekStartYmd}
              ensureTempClassId={() => {
                const existing = state.classes.find((c) => String(c.name).trim() === '临时加课')
                if (existing) return existing.id
                const id = `class_temp_${Date.now().toString(16)}`
                dispatch({ type: 'setClasses', classes: [...state.classes, { id, name: '临时加课' }] })
                return id
              }}
              onUpsertUnit={({ classId, day, periodId, unit }) =>
                dispatch({ type: 'upsertUnit', classId: String(classId), day: String(day), periodId: String(periodId), unit })
              }
              onDeleteUnit={({ classId, day, periodId, unitId }) =>
                dispatch({ type: 'deleteUnit', classId: String(classId), day: String(day), periodId: String(periodId), unitId: String(unitId) })
              }
            />
          ) : (
            <AIPanel
              state={state}
              onImportPartialState={(partial) => {
                dispatch({ type: 'hydrate', payload: partial as any })
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
