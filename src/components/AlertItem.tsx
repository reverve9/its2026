import type { ReactNode } from 'react'
import type { OpsAlert, AlertLevel } from '../types'

const levelMeta: Record<AlertLevel, { text: string; bg: string; dot: string; label: string }> = {
  critical: { text: 'text-critical', bg: 'bg-critical-soft', dot: 'bg-critical', label: '경보' },
  warning: { text: 'text-warn', bg: 'bg-warn-soft', dot: 'bg-warn', label: '주의' },
  info: { text: 'text-info', bg: 'bg-info-soft', dot: 'bg-info', label: '정보' },
}

// unread 를 주면 안 읽음 점이 붙는다. 안 주면 그냥 표시(읽음 개념이 없는 화면).
//
// 행 클릭으로 읽지 않는다 — 정렬이 '안 읽은 것 먼저'라 클릭하는 순간 그 행이 읽은 것들
// 뒤로 밀려 눈앞에서 사라진다. 방금 누른 걸 못 읽는 배지가 된다. 읽음은 카드의 '모두 읽음'이 맡는다.
// '보면 읽음'도 안 된다: 스크러버를 밀 때마다 경보가 새로 파생되므로 렌더에 읽음을 걸면
// 스크러버를 미는 것만으로 전부 읽음이 되어 배지가 죽는다.
export function AlertItem({
  alert,
  action,
  unread,
}: {
  alert: OpsAlert
  action?: ReactNode
  unread?: boolean
}) {
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
          {/* 안 읽음 점 — 배지 문구를 따로 달지 않는다. 레벨 배지가 이미 옆에 서 있어서
              글자를 하나 더 붙이면 한 행에 배지가 둘이 된다. */}
          <span className="flex min-w-0 items-center gap-1.5">
            {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary-600" />}
            <span className={`truncate text-label ${unread ? 'font-bold' : 'font-semibold'} text-ink-strong`}>
              {alert.zoneName}
            </span>
          </span>
          <span className="tnum shrink-0 text-caption text-ink-faint">{alert.time}</span>
        </div>
        <p className="mt-0.5 text-label leading-snug text-ink-base">{alert.message}</p>
        {action && <div className="mt-1.5">{action}</div>}
      </div>
    </div>
  )
}
