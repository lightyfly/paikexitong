import { useMemo } from 'react'

function parseHHMM(value: string): { hh: string; mm: string } {
  const s = String(value || '').trim()
  const m = s.match(/^(\d{2}):(\d{2})$/)
  if (!m) return { hh: '', mm: '' }
  return { hh: m[1], mm: m[2] }
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function TimeSelect(props: {
  value: string
  onChange: (next: string) => void
  allowEmpty?: boolean
  className?: string
}) {
  const allowEmpty = props.allowEmpty ?? true
  const cur = parseHHMM(props.value)

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => pad2(i)), [])
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => pad2(i)), [])

  const selectClass =
    'w-[5.75rem] shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-sky-100'

  return (
    <div className={"flex flex-wrap items-center gap-2 " + (props.className ?? '')}>
      <div className="flex items-center gap-2">
        <select
          className={selectClass}
          value={cur.hh}
          onChange={(e) => {
            const hh = String(e.target.value)
            if (!hh) {
              props.onChange('')
              return
            }
            const mm = cur.mm || '00'
            props.onChange(`${hh}:${mm}`)
          }}
        >
          {allowEmpty ? <option value="">小时</option> : null}
          {hours.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold text-slate-400">:</span>
        <select
          className={selectClass}
          value={cur.mm}
          onChange={(e) => {
            const mm = String(e.target.value)
            if (!mm) {
              if (allowEmpty) {
                props.onChange('')
                return
              }
              props.onChange(`${cur.hh || '00'}:00`)
              return
            }
            const hh = cur.hh || (allowEmpty ? '' : '00')
            if (!hh) {
              props.onChange(`00:${mm}`)
              return
            }
            props.onChange(`${hh}:${mm}`)
          }}
        >
          {allowEmpty ? <option value="">分钟</option> : null}
          {minutes.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
