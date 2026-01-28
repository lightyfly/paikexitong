import { ChevronDown } from 'lucide-react'

export function Card(props: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 shadow-inner ring-1 ring-slate-200/70">
      <div className="flex items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0">
          <div className="font-display text-base font-semibold text-slate-900">{String(props.title)}</div>
          {props.subtitle ? <div className="mt-0.5 text-xs text-slate-600">{String(props.subtitle)}</div> : null}
        </div>
        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
      <div className="px-5 pb-5 pt-4">{props.children}</div>
    </div>
  )
}

export function Label(props: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-slate-700">{props.children}</div>
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props
  return (
    <input
      {...rest}
      className={
        'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-sky-100 ' +
        (className ?? '')
      }
    />
  )
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props
  return (
    <div className="relative">
      <select
        {...rest}
        className={
          'w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300 focus:ring-4 focus:ring-sky-100 ' +
          (className ?? '')
        }
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' },
) {
  const { className, variant = 'secondary', ...rest } = props
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition'
  const styles =
    variant === 'primary'
      ? 'bg-slate-900 text-white hover:bg-slate-800'
      : variant === 'danger'
        ? 'bg-rose-600 text-white hover:bg-rose-500'
        : 'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50'
  return <button {...rest} className={`${base} ${styles} ${className ?? ''}`} />
}

export function Pill(props: { color: string; children: React.ReactNode }) {
  const c = String(props.color || '#0ea5e9')
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: `${c}18`, color: c, border: `1px solid ${c}45` }}
    >
      {props.children}
    </span>
  )
}
