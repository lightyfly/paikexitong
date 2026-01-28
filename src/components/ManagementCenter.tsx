import { Plus, Trash2 } from 'lucide-react'
import type { AppState, ClassEntity, Period, Teacher } from '../lib/types'
import { uid } from '../lib/id'
import { Card, Button, Input, Label } from './ui'
import { TimeSelect } from './TimeSelect'

export function ManagementCenter(props: {
  state: AppState
  onSetTeachers: (t: Teacher[]) => void
  onSetClasses: (c: ClassEntity[]) => void
  onSetPeriods: (p: Period[]) => void
  onUpsertCourseByName: (name: string) => void
  onAddPeriod: () => void
  onUpdatePeriodStart: (periodId: string, start: string) => void
  onUpdatePeriodEnd: (periodId: string, end: string) => void
}) {
  const courseListId = 'course_names_datalist'

  return (
    <div className="grid gap-16 lg:grid-cols-3">
      <datalist id={courseListId}>
        {props.state.courses.map((c) => (
          <option key={c.id} value={String(c.name)} />
        ))}
      </datalist>

      <Card title="教师 + 科目" subtitle="合并录入；新科目将自动建档并分配颜色">
        <div className="space-y-3">
          {props.state.teachers.map((t) => (
            <div key={t.id} className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-5">
                <Input
                  value={String(t.name)}
                  placeholder="教师姓名"
                  onChange={(e) => {
                    const v = e.target.value
                    props.onSetTeachers(props.state.teachers.map((x) => (x.id === t.id ? { ...x, name: v } : x)))
                  }}
                />
              </div>
              <div className="col-span-6">
                <Input
                  value={String(t.subject)}
                  list={courseListId}
                  placeholder="科目（自动联想）"
                  onChange={(e) => {
                    const v = e.target.value
                    props.onSetTeachers(props.state.teachers.map((x) => (x.id === t.id ? { ...x, subject: v } : x)))
                  }}
                  onBlur={(e) => props.onUpsertCourseByName(e.target.value)}
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-rose-600"
                  onClick={() => props.onSetTeachers(props.state.teachers.filter((x) => x.id !== t.id))}
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <Button
            className="w-full"
            onClick={() => props.onSetTeachers([...props.state.teachers, { id: uid('teacher'), name: '', subject: '' }])}
          >
            <Plus className="h-4 w-4" />
            添加教师
          </Button>
        </div>
      </Card>

      <Card title="班级" subtitle="用于班级视图与走班映射">
        <div className="space-y-3">
          {props.state.classes.map((c) => (
            <div key={c.id} className="grid grid-cols-12 items-center gap-3">
              <div className="col-span-11">
                <Input
                  value={String(c.name)}
                  placeholder="例如：高一(1)班"
                  onChange={(e) => {
                    const v = e.target.value
                    props.onSetClasses(props.state.classes.map((x) => (x.id === c.id ? { ...x, name: v } : x)))
                  }}
                />
              </div>
              <div className="col-span-1 flex justify-end">
                <button
                  className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-rose-600"
                  onClick={() => props.onSetClasses(props.state.classes.filter((x) => x.id !== c.id))}
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <Button
            className="w-full"
            onClick={() => props.onSetClasses([...props.state.classes, { id: uid('class'), name: '' }])}
          >
            <Plus className="h-4 w-4" />
            添加班级
          </Button>
        </div>
      </Card>

      <Card
        title="节次"
        subtitle="添加节次将自动顺延 10 分钟；修改开始时间将联动结束时间（默认 45 分钟）"
        right={
          <Button onClick={props.onAddPeriod}>
            <Plus className="h-4 w-4" />
            添加节次
          </Button>
        }
      >
        <div className="space-y-4">
          {props.state.periods.length === 0 ? (
            <div className="rounded-xl bg-white p-4 text-sm text-slate-600 ring-1 ring-slate-200">
              还没有节次。点击右上角“添加节次”。
            </div>
          ) : null}

          {props.state.periods.map((p) => (
            <div key={p.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Label>名称</Label>
                  <Input
                    value={String(p.name)}
                    onChange={(e) => {
                      const v = e.target.value
                      props.onSetPeriods(props.state.periods.map((x) => (x.id === p.id ? { ...x, name: v } : x)))
                    }}
                  />
                </div>
                <button
                  className="mt-5 shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-50 hover:text-rose-600"
                  onClick={() => props.onSetPeriods(props.state.periods.filter((x) => x.id !== p.id))}
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <div>
                  <Label>开始</Label>
                  <TimeSelect value={String(p.startTime)} onChange={(v) => props.onUpdatePeriodStart(p.id, v)} />
                </div>
                <div>
                  <Label>结束</Label>
                  <TimeSelect value={String(p.endTime)} onChange={(v) => props.onUpdatePeriodEnd(p.id, v)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
