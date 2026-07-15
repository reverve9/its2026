import { useState } from 'react'
import type { DutyStatus } from '../types'

// 리스트 순번 표기 — 한 자리도 두 자리로(1 → 01). 대장류 표에서 자릿수가 흔들리지 않게.
// 페이지네이션 적용 화면에선 start+i 를 넘겨 순번이 페이지마다 01 로 되돌아가지 않게 한다.
export const listNo = (i: number): string => String(i + 1).padStart(2, '0')

// ── 페이지네이션 ────────────────────────────────────────
export const PAGE_SIZE = 20

// 훅과 계산을 나눈 이유: 화면들이 `useLive` 결과에 `if (!data) return null` 조기 반환을 두는데,
// useLive 는 첫 렌더에 null 을 낸다. 훅을 rows 계산 뒤에 두면 그 조기 반환을 사이에 끼고
// 훅 개수가 렌더마다 달라져 터진다. → 상태 훅은 조기 반환 앞에서, 자르기는 뒤에서.

// resetKey = 필터·탭 시그니처. 바뀌면 1페이지로(5페이지를 보던 중 필터로 3행만 남는 상황 방지).
export function usePageState(resetKey: unknown = null) {
  const [page, setPage] = useState(1)
  const [key, setKey] = useState(resetKey)
  if (key !== resetKey) {
    setKey(resetKey)
    setPage(1)
  }
  return { page, setPage }
}

// 순수 — 필터 결과를 페이지로 자른다.
export function paginate<T>(rows: T[], page: number, size = PAGE_SIZE) {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const cur = Math.min(page, pages) // 행이 줄어 현재 페이지가 범위를 벗어나도 항상 유효한 페이지를 낸다
  const start = (cur - 1) * size
  return { page: cur, pages, start, slice: rows.slice(start, start + size), total: rows.length }
}

// 페이지 번호 — 많아지면 양끝 + 현재±1 만 두고 나머지는 생략기호.
function pageList(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const from = Math.max(2, page - 1)
  const to = Math.min(pages - 1, page + 1)
  if (from > 2) out.push('…')
  for (let i = from; i <= to; i++) out.push(i)
  if (to < pages - 1) out.push('…')
  out.push(pages)
  return out
}

// 리스트 상단 우측에 놓는다. 1페이지뿐이면 렌더하지 않는다(조작할 게 없는 컨트롤은 소음).
export function Pagination({
  page,
  pages,
  start,
  shown,
  total,
  onChange,
}: {
  page: number
  pages: number
  start: number
  shown: number
  total: number
  onChange: (p: number) => void
}) {
  if (pages <= 1) return null
  const box = 'grid h-7 min-w-[28px] place-items-center rounded-md px-1.5 text-caption font-semibold transition'
  const step = `${box} text-ink-muted hover:bg-neutral-100 disabled:pointer-events-none disabled:text-ink-faint disabled:opacity-40`
  return (
    <div className="flex items-center gap-2">
      <span className="tnum text-caption text-ink-faint">
        {start + 1}–{start + shown} / {total}
      </span>
      <div className="flex items-center gap-0.5">
        <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={step} aria-label="이전 페이지">
          ‹
        </button>
        {pageList(page, pages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-caption text-ink-faint">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`${box} ${p === page ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-neutral-100'}`}
            >
              {p}
            </button>
          )
        )}
        <button onClick={() => onChange(page + 1)} disabled={page >= pages} className={step} aria-label="다음 페이지">
          ›
        </button>
      </div>
    </div>
  )
}

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
