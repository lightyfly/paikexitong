import { X } from 'lucide-react'

export function Modal(props: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
  footer?: React.ReactNode
}) {
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={props.onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/40 bg-white shadow-soft-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="font-display text-lg font-semibold text-slate-900">{String(props.title)}</div>
            <button
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={props.onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-5 py-4">{props.children}</div>
          {props.footer ? <div className="border-t border-slate-200 px-5 py-4">{props.footer}</div> : null}
        </div>
      </div>
    </div>
  )
}
