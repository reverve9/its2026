import type { AttendanceEvent } from '../types'

// 출결 피드 한 줄. 방식(스캔/GPS) 배지가 있었는데 없앴다 — 출결이 전 거점 GPS 셀프
// 단일이 되면서 값이 하나뿐인 배지가 됐고, 그건 정보가 아니라 장식이다.
export function EventRow({ event, zoneName }: { event: AttendanceEvent; zoneName: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
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
