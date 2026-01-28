import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

type ToastItem = {
  id: string
  type: ToastType
  title: string
  detail?: string
}

type ToastApi = {
  push: (t: Omit<ToastItem, 'id'>) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast() {
  const api = useContext(ToastContext)
  if (!api) throw new Error('ToastProvider missing')
  return api
}

export function ToastProvider(props: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((t: Omit<ToastItem, 'id'>) => {
    const id = `toast_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
    const item: ToastItem = { id, ...t }
    setItems((prev) => [item, ...prev].slice(0, 3))
    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id))
    }, 3200)
  }, [])

  const api = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={api}>
      {props.children}
      <div className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
        <div className="w-full max-w-2xl space-y-3">
          {items.map((t) => (
            <div
              key={t.id}
              className="animate-fade-up rounded-2xl border border-white/40 bg-white/70 shadow-soft-lg backdrop-blur supports-[backdrop-filter]:bg-white/55"
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5">
                  {t.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : t.type === 'error' ? (
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  ) : (
                    <Info className="h-5 w-5 text-sky-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">{String(t.title)}</div>
                  {t.detail ? <div className="mt-0.5 text-xs text-slate-600">{String(t.detail)}</div> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}
