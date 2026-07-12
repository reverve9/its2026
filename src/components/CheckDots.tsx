import type { CheckState } from '../types'

// 정시(1h) 체크 상태 → 색. ok 정상 / break 휴게면제 / missed 확인필요 / absent 미출근
const dotCls: Record<CheckState, string> = {
  ok: 'bg-ok',
  break: 'bg-warn',
  missed: 'bg-critical',
  absent: 'bg-neutral-300',
}

export function CheckDots({ checks }: { checks: CheckState[] }) {
  if (!checks.length) return <span className="text-caption text-ink-faint">대기</span>
  return (
    <div className="flex items-center gap-1">
      {checks.map((c, i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${dotCls[c]}`} />
      ))}
    </div>
  )
}

export function checkSummary(checks: CheckState[]): { label: string; cls: string } {
  if (!checks.length) return { label: '대기', cls: 'text-ink-faint' }
  if (checks.some((c) => c === 'missed')) return { label: '확인필요', cls: 'text-critical' }
  const last = checks[checks.length - 1]
  if (last === 'absent') return { label: '미출근', cls: 'text-ink-faint' }
  if (last === 'break') return { label: '휴게', cls: 'text-warn' }
  return { label: '정상', cls: 'text-ok' }
}

export { dotCls as CHECK_DOT }
