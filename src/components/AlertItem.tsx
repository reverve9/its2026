import type { ReactNode } from 'react'
import type { OpsAlert, AlertLevel } from '../types'

const levelMeta: Record<AlertLevel, { text: string; bg: string; dot: string; label: string }> = {
  critical: { text: 'text-critical', bg: 'bg-critical-soft', dot: 'bg-critical', label: '경보' },
  warning: { text: 'text-warn', bg: 'bg-warn-soft', dot: 'bg-warn', label: '주의' },
  info: { text: 'text-info', bg: 'bg-info-soft', dot: 'bg-info', label: '정보' },
}

export function AlertItem({ alert, action }: { alert: OpsAlert; action?: ReactNode }) {
  const m = levelMeta[alert.level]
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span
        className={`mt-0.5 inline-flex items-center gap-1 rounded-md ${m.bg} px-1.5 py-0.5 text-caption font-semibold ${m.text}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
        {m.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-label font-semibold text-ink-strong">{alert.zoneName}</span>
          <span className="tnum shrink-0 text-caption text-ink-faint">{alert.time}</span>
        </div>
        <p className="mt-0.5 text-label leading-snug text-ink-base">{alert.message}</p>
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </div>
  )
}
