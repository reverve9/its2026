import type { AttendanceEvent } from '../types'

const methodMeta: Record<AttendanceEvent['method'], { label: string; cls: string }> = {
  scan: { label: '스캔', cls: 'bg-primary-50 text-primary-700' },
  gps: { label: 'GPS', cls: 'bg-info-soft text-info' },
}

export function EventRow({ event, zoneName }: { event: AttendanceEvent; zoneName: string }) {
  const m = methodMeta[event.method]
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-caption font-semibold ${m.cls}`}>
        {m.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-label font-semibold text-ink-strong">{event.personName}</span>
          <span className="truncate text-caption text-ink-muted">· {zoneName}</span>
        </div>
        {event.anomaly && (
          <div className="mt-0.5 text-caption text-warn">⚠ {event.anomaly}</div>
        )}
      </div>
      <span className="tnum shrink-0 text-caption text-ink-faint">{event.time}</span>
    </div>
  )
}
