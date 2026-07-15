import type { Zone } from '../types'
import { Fill } from './ui'

const kindMeta: Record<Zone['kind'], { label: string; cls: string }> = {
  venue: { label: '행사장', cls: 'bg-primary-50 text-primary-700' },
  tourist: { label: '관광지', cls: 'bg-cat-1/10 text-cat-1' },
}
const statusMeta: Record<Zone['status'], { label: string; cls: string }> = {
  before: { label: '운영 전', cls: 'text-ink-faint' },
  open: { label: '운영 중', cls: 'text-ok' },
  closed: { label: '종료', cls: 'text-ink-faint' },
  suspended: { label: '중단', cls: 'text-warn font-bold' },
}

export function ZoneStatusRow({ zone }: { zone: Zone }) {
  const k = kindMeta[zone.kind]
  const s = statusMeta[zone.status]
  const gap = zone.present < zone.quota && zone.status === 'open'
  return (
    <div className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-caption font-semibold ${k.cls}`}>
        {k.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-label font-semibold text-ink-strong">{zone.name}</div>
        <div className="flex items-center gap-2 text-caption">
          <span className={s.cls}>{s.label}</span>
          <span className="text-ink-faint">·</span>
          <span className="tnum text-ink-muted">
            {zone.opWindow.start}–{zone.opWindow.end}
          </span>
        </div>
      </div>
      <div className="shrink-0">
        <Fill present={zone.present} quota={zone.quota} />
      </div>
      {gap && (
        <span className="shrink-0 rounded-md bg-critical-soft px-1.5 py-0.5 text-caption font-semibold text-critical">
          공백
        </span>
      )}
    </div>
  )
}
