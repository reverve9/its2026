import type { Zone } from '../types'
import { Fill } from './ui'

// 종류(행사장/관광지) 배지는 없다 — 상단 탭이 한 종류만 보여주므로 모든 행이 같은 값이 된다.
// 11행 전부에 같은 배지를 다는 건 데이터가 아니라 잉크다.
const statusMeta: Record<Zone['status'], { label: string; cls: string }> = {
  before: { label: '운영 전', cls: 'text-ink-faint' },
  open: { label: '운영 중', cls: 'text-ok' },
  closed: { label: '종료', cls: 'text-ink-faint' },
  suspended: { label: '중단', cls: 'text-warn font-bold' },
}

// divider: 아래 경계선을 그릴지. 2열 그리드에선 `last:border-0` 이 못 쓴다 —
// 그건 마지막 '항목' 하나만 잡는데 걷어야 하는 건 마지막 '행'(열 수만큼)이라,
// 5개를 2열에 깔면 마지막 행의 왼쪽 칸에만 선이 남아 짝이 안 맞는다. 행 판정은 열 수를
// 아는 부모의 몫이다.
export function ZoneStatusRow({ zone, divider = true }: { zone: Zone; divider?: boolean }) {
  const s = statusMeta[zone.status]
  const gap = zone.present < zone.quota && zone.status === 'open'
  return (
    <div className={`flex items-center gap-3 py-2.5 ${divider ? 'border-b border-line-soft' : ''}`}>
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
