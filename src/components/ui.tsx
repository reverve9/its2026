import { useState, type ReactNode } from 'react'
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

// 리스트 상단 우측에 놓는다. 1페이지뿐이면 렌더하지 않는다(조작할 게 없는 컨트롤은 소음).
//
// ⚠️ 페이지 번호를 나열하지 않는다. 나열형(1 2 3 … 7 + '1–20 / 139')은 336px 를 먹었고,
// 그게 툴바의 28% 라 좌측 필터가 3행으로 접혔다 — 버튼 3개를 다 지워도 못 풀리는 폭이었다.
// 점프를 잃는 대신 필터가 한 행 올라온다. 20개씩 7페이지에서 점프는 부차적이다.
//
// start·shown·total 은 안 받는다: 건수는 툴바 좌측이 이미 찍고 있어서 여기서 또 찍으면
// 같은 수가 한 행에 두 번 선다.
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (p: number) => void
}) {
  if (pages <= 1) return null
  const step =
    'grid h-7 w-7 place-items-center rounded-md text-caption font-semibold text-ink-muted transition hover:bg-neutral-200 hover:text-ink-strong disabled:pointer-events-none disabled:text-ink-faint disabled:opacity-40'
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1} className={step} aria-label="이전 페이지">
        ‹
      </button>
      <span className="tnum min-w-[44px] text-center text-caption text-ink-muted">
        {page} / {pages}
      </span>
      <button onClick={() => onChange(page + 1)} disabled={page >= pages} className={step} aria-label="다음 페이지">
        ›
      </button>
    </div>
  )
}

// ── 리스트 툴바 ─────────────────────────────────────────
// 리스트 위 컨트롤 바. 좌 = 필터(children) · 우 = 액션·페이지네이션(right).
// 리스트 위에 바가 필요하면 이 셸을 쓴다 — 틴트 박스를 화면마다 다시 그리지 말 것.
//
// ⚠️ 박스가 bg-neutral-100 이라 그 위에 서는 컨트롤은 흰 채움이어야 한다. 필 트랙을
// bg-neutral-100 그대로 두면 박스와 같은 색이라 그룹 경계가 통째로 사라진다.
//
// ⚠️ 좌/우를 '컬럼'으로 나누지 말 것. 나누면 좌측 컬럼 안의 것들은 그 컬럼 끝(≈1421)까지밖에
// 못 가고 페이저는 툴바 끝(≈1640)에 서서, 같은 '우측 정렬'인데 선이 둘로 갈린다.
// 툴바는 행의 쌓임이고 우측 정렬은 행마다 일어난다(ToolbarRow) — 그래야 우끝이 한 선이다.
export function ListToolbar({ children, className = 'mb-3' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-2 rounded-xl bg-neutral-100 px-4 py-5 ${className}`}>{children}</div>
}

// 툴바 한 행 — 좌 = children · 우 = right. right 의 우끝은 툴바 우끝에 붙는다.
// 우측 묶음 순서는 [액션] → [페이지네이션]: 내보내기는 '지금 필터 결과 전체'를 내리는 일이라
// 페이지 이동과 같은 층이 아니다.
export function ToolbarRow({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">{children}</div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  )
}

// 리스트 위에 서는 액션(내보내기·출력). 스타일 정본은 기존 '명단 출력' 버튼 —
// Personnel·FoodVendors 에 같은 클래스가 복붙돼 있던 걸 여기로 모았다.
//
// 색을 안 주는 건 의도다. 레퍼런스는 엑셀 버튼에 초록을 박아뒀지만 우리 초록(ok)은
// '정상'이라는 뜻을 가진 상태 토큰이라, 액션에 쓰면 화면이 '내보내기 = 정상'이라 말한다.
export function ActionButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-caption font-semibold text-ink-base shadow-sm transition hover:text-ink-strong disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}

// 파일 선택 액션 — <input type="file"> 은 스타일이 안 먹어서 label 로 감싼다(ActionButton 과 같은 옷).
//
// ⚠️ 고른 뒤 value 를 비우는 게 핵심이다. 임포트는 '실패 → 파일 고쳐서 같은 이름으로 다시 올림'이
// 정상 경로인데, input 이 값을 쥐고 있으면 같은 파일에 change 가 안 떠서 두 번째 시도가 죽는다.
export function ImportButton({ onFile, children }: { onFile: (f: File) => void; children: ReactNode }) {
  return (
    <label className="cursor-pointer rounded-lg border border-line bg-surface px-2.5 py-1.5 text-caption font-semibold text-ink-base shadow-sm transition hover:text-ink-strong">
      {children}
      <input
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) onFile(f)
        }}
      />
    </label>
  )
}

// ── 필터 컨트롤 ─────────────────────────────────────────
// 모양이 곧 동작이다 — 각진 트랙 = 단일선택 축(FilterPills) · 둥근 낱개 = 불리언 토글(FilterToggle).
// 둘을 화면마다 인라인으로 그리면 같은 행에 선 버튼끼리 글자 크기가 갈린다(실제로 갈렸다).
// 타이포는 ActionButton 과 같은 층(text-caption)에 맞춘다 — 툴바에 나란히 서기 때문이다.

// 단일선택 축. 트랙(흰 채움)이 그룹 경계를 그린다 — 툴바 박스가 bg-neutral-100 이라 트랙은 흰색이어야 보인다.
export function FilterPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; count?: number }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 bg-surface p-0.5 shadow-sm">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          aria-current={o.key === value ? 'true' : undefined}
          className={`px-3 py-1 text-caption font-semibold transition ${
            o.key === value ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-ink-strong'
          }`}
        >
          {o.label}
          {o.count !== undefined && <span className="tnum"> {o.count}</span>}
        </button>
      ))}
    </div>
  )
}

// 불리언 토글. 눌린 상태(primary 채움)가 '이것만 본다'를 말하므로 라벨에 '만'을 붙이지 않는다.
// className 은 배치용(ml-auto 등) — 위치는 화면이 정하고 옷은 여기가 정한다.
export function FilterToggle({
  on,
  onToggle,
  className = '',
  children,
}: {
  on: boolean
  onToggle: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={`${className} rounded-lg px-2.5 py-1.5 text-caption font-semibold transition ${
        on ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'
      }`}
    >
      {children}
    </button>
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
