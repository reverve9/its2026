import type { DutyStatus } from '../types'

// 리스트 순번 표기 — 한 자리도 두 자리로(1 → 01). 대장류 표에서 자릿수가 흔들리지 않게.
export const listNo = (i: number): string => String(i + 1).padStart(2, '0')

// 근태 상태 메타 — v3 토큰(ok/warn/info/critical + soft 배경).
// 색만으로 의미 전달하지 않도록 점(dot)+라벨 항상 동반.
export const statusMeta: Record<
  DutyStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  before: { label: '대기', dot: 'bg-neutral-400', text: 'text-ink-muted', bg: 'bg-neutral-100' },
  on: { label: '근무중', dot: 'bg-ok', text: 'text-ok', bg: 'bg-ok-soft' },
  break: { label: '휴게', dot: 'bg-warn', text: 'text-warn', bg: 'bg-warn-soft' },
  moving: { label: '이동', dot: 'bg-info', text: 'text-info', bg: 'bg-info-soft' },
  off: { label: '퇴근', dot: 'bg-ink-faint', text: 'text-ink-faint', bg: 'bg-neutral-100' },
  absent: { label: '미출근', dot: 'bg-critical', text: 'text-critical', bg: 'bg-critical-soft' },
}

export function StatusBadge({ status }: { status: DutyStatus }) {
  const m = statusMeta[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${m.bg} px-2 py-0.5 text-caption font-medium ${m.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

type Tone = 'default' | 'ok' | 'warn' | 'critical' | 'primary'

export function StatTile({
  label,
  value,
  unit,
  tone = 'default',
  hint,
}: {
  label: string
  value: number | string
  unit?: string
  tone?: Tone
  hint?: string
}) {
  const toneText: Record<Tone, string> = {
    default: 'text-ink-strong',
    ok: 'text-ok',
    warn: 'text-warn',
    critical: 'text-critical',
    primary: 'text-primary-600',
  }
  return (
    <div className="card p-4">
      <div className="text-label font-medium text-ink-muted">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`tnum text-kpi font-bold ${toneText[tone]}`}>{value}</span>
        {unit && <span className="text-body text-ink-faint">{unit}</span>}
      </div>
      {hint && <div className="mt-1 text-caption text-ink-faint">{hint}</div>}
    </div>
  )
}

// 충원 게이지 — 부족(present<quota)이면 경보색, 충족이면 primary.
export function Fill({ present, quota }: { present: number; quota: number }) {
  const pct = quota > 0 ? Math.min(100, Math.round((present / quota) * 100)) : 0
  const gap = present < quota
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full ${gap ? 'bg-critical' : 'bg-primary-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`tnum text-caption font-medium ${gap ? 'text-critical' : 'text-ink-muted'}`}>
        {present}/{quota}
      </span>
    </div>
  )
}
