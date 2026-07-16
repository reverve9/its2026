import { useState } from 'react'
import { getAssignments, getZones, isLate } from '../../../lib/services'
import { useLive, useNowMin } from '../../../lib/useLive'
import { roleLabel, roleCls } from '../../../lib/roleLabel'
import type { Assignment, DutyStatus, Shift } from '../../../types'
import { PageHeader } from '../../../components/layout'
import { StatusBadge, listNo, usePageState, paginate, Pagination } from '../../../components/ui'
import { toMin, fmtDur } from '../../../lib/time'
import PersonDetailModal from './PersonDetail'

const statusFilters: { key: DutyStatus | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'on', label: '근무중' },
  { key: 'off', label: '퇴근' },
  { key: 'absent', label: '미출근' },
]
const shiftFilters: { key: Shift | 'all'; label: string }[] = [
  { key: 'all', label: '전체 조' },
  { key: 'AM', label: '오전조' },
  { key: 'PM', label: '오후조' },
]

const telHref = (p: string) => `tel:${p.replace(/-/g, '')}`
const shiftKo = (s: Shift) => (s === 'AM' ? '오전' : '오후')

type SortKey = 'no' | 'shift' | 'zone' | 'name' | 'role' | 'in' | 'status' | 'work'

export default function People() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<DutyStatus | 'all'>('all')
  const [shift, setShift] = useState<Shift | 'all'>('all')
  const [reserveOnly, setReserveOnly] = useState(false)
  const [q, setQ] = useState('')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'no', dir: 1 })
  // 훅은 조기 반환(`if (!assignments)`) 앞에서 — 필터가 바뀌면 1페이지로.
  const pg = usePageState(`${q}|${status}|${shift}|${zoneFilter}|${reserveOnly}`)

  const now = useNowMin()
  const all = useLive(getAssignments)
  const zones = useLive(getZones) ?? []
  if (!all) return null

  // 실시간 관제 대상은 자원봉사자다(핸드오프 §7 부채). 운영인력은 출근 버튼이 없어 근태
  // 이벤트 자체가 없고 — 과업지시서가 요구하는 건 '자원봉사자 출결 확인'이다 — 상주 계획만
  // 있다. 섞어두면 '근무중' 카운트에 22명이 얹히고, 찍은 적 없는 출근시각이 로스터에 뜬다.
  const assignments = all.filter((a) => a.kind === '자원봉사자')

  const zoneName = (a: Assignment) => (a.isReserve ? '예비 · 미배정' : zones.find((z) => z.id === a.zoneId)?.name ?? '—')
  const onDuty = assignments.filter((a) => a.status === 'on').length
  const absent = assignments.filter((a) => a.status === 'absent').length
  const reserve = assignments.filter((a) => a.isReserve).length
  // 누적 근무 — 퇴근했으면 퇴근시각까지, 아니면 현재 시각까지.
  const workMin = (a: Assignment) => {
    if (!a.checkedInAt) return -1
    const end = a.checkedOutAt ? toMin(a.checkedOutAt) : now
    return end - toMin(a.checkedInAt)
  }

  const qq = q.trim().toLowerCase()
  const matchQ = (a: Assignment) =>
    !qq || [a.personName, zoneName(a), a.phone, a.role, ...(a.lang ?? [])].some((v) => v.toLowerCase().includes(qq))
  const inZone = (a: Assignment) =>
    zoneFilter === 'all' || (zoneFilter === 'reserve' ? a.isReserve : a.zoneId === zoneFilter)
  const filtered = assignments.filter(
    (a) =>
      (status === 'all' || a.status === status) &&
      (shift === 'all' || a.shift === shift) &&
      (!reserveOnly || a.isReserve) &&
      inZone(a) &&
      matchQ(a)
  )
  const rows =
    sort.key === 'no'
      ? filtered
      : [...filtered].sort((a, b) => {
          const d = sort.dir
          switch (sort.key) {
            case 'shift': return d * (a.shift.localeCompare(b.shift) || a.personName.localeCompare(b.personName))
            case 'zone': return d * zoneName(a).localeCompare(zoneName(b))
            case 'name': return d * a.personName.localeCompare(b.personName)
            case 'role': return d * a.role.localeCompare(b.role)
            case 'in': return d * (a.checkedInAt ?? '99:99').localeCompare(b.checkedInAt ?? '99:99')
            case 'status': return d * a.status.localeCompare(b.status)
            case 'work': return d * (workMin(a) - workMin(b))
            default: return 0
          }
        })

  const page = paginate(rows, pg.page)

  const toggleSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key: k, dir: 1 }))

  const Th = ({ label, k, align = 'left' }: { label: string; k?: SortKey; align?: 'left' | 'right' | 'center' }) => {
    const on = k && sort.key === k
    const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
    return (
      <th
        onClick={k ? () => toggleSort(k) : undefined}
        className={`px-3 py-2.5 font-semibold ${alignCls} ${k ? 'cursor-pointer select-none hover:text-ink-strong' : ''} ${on ? 'text-primary-700' : ''}`}
      >
        {label}
        {on && <span className="ml-0.5">{sort.dir === 1 ? '▲' : '▼'}</span>}
      </th>
    )
  }

  return (
    <div>
      <PageHeader
        title="인력·자원봉사 관제"
        summary="배치 인력 전원 2교대 출결 연동 로스터"
        right={
          <div className="flex gap-2 text-caption">
            <span className="rounded-lg bg-surface px-2.5 py-1 font-semibold text-ink-muted shadow-sm">배치 <b className="tnum text-ink-strong">{assignments.filter((a) => !a.isReserve).length}</b></span>
            <span className="rounded-lg bg-ok-soft px-2.5 py-1 font-semibold text-ok">근무 <b className="tnum">{onDuty}</b></span>
            <span className="rounded-lg bg-critical-soft px-2.5 py-1 font-semibold text-critical">미출근 <b className="tnum">{absent}</b></span>
            <span className="rounded-lg bg-primary-50 px-2.5 py-1 font-semibold text-primary-700">예비 <b className="tnum">{reserve}</b></span>
          </div>
        }
      />

      {/* 검색 */}
      <div className="mb-3 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 · 거점 · 연락처 · 역할 검색"
          className="w-full max-w-xs rounded-lg border border-line bg-surface px-3 py-2 text-label text-ink-strong shadow-sm outline-none transition placeholder:text-ink-faint focus:border-primary-400"
        />
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-label text-ink-strong shadow-sm outline-none transition focus:border-primary-400"
        >
          <option value="all">전체 거점</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
          <option value="reserve">예비 · 미배정</option>
        </select>
        <span className="tnum text-caption text-ink-muted">{rows.length}명</span>
      </div>

      {/* 조 필터 + 상태 필터 */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
          {shiftFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setShift(f.key)}
              className={`rounded-full px-3 py-1 text-label font-semibold transition ${
                shift === f.key ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-ink-strong'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="mx-1 h-4 w-px bg-line" />
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            className={`rounded-full px-3 py-1.5 text-label font-semibold transition ${
              status === f.key ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => setReserveOnly((v) => !v)}
          className={`ml-auto rounded-full px-3 py-1.5 text-label font-semibold transition ${
            reserveOnly ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'
          }`}
        >
          예비인력만
        </button>
      </div>

      {/* 로스터 테이블 (컬럼 헤더 클릭 = 소팅) */}
      <div className="mb-2 flex justify-end">
        <Pagination
          page={page.page}
          pages={page.pages}
          start={page.start}
          shown={page.slice.length}
          total={page.total}
          onChange={pg.setPage}
        />
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-label">
          <thead>
            <tr className="border-b border-line bg-neutral-50 text-caption text-ink-muted">
              <Th label="No." align="right" />
              <Th label="조" k="shift" />
              <Th label="거점" k="zone" />
              <Th label="이름" k="name" />
              <Th label="연락처" />
              <Th label="역할" k="role" />
              <Th label="출근" k="in" />
              <Th label="상태" k="status" />
              <Th label="퇴근" />
              <Th label="비고 (외국어)" />
              <Th label="누적 근무" k="work" align="right" />
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {page.slice.map((a, i) => {
              return (
                <tr
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className="group cursor-pointer border-b border-line-soft transition last:border-0 hover:bg-primary-50/50"
                >
                  <td className="tnum px-3 py-2.5 text-right text-ink-faint">{listNo(page.start + i)}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${a.shift === 'AM' ? 'bg-info-soft text-info' : 'bg-primary-50 text-primary-700'}`}>
                      {shiftKo(a.shift)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-base">
                    {a.isReserve ? <span className="text-ink-faint">예비 · 미배정</span> : zoneName(a)}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-ink-strong">{a.personName}</td>
                  <td className="px-3 py-2.5">
                    <a
                      href={telHref(a.phone)}
                      onClick={(e) => e.stopPropagation()}
                      className="tnum text-label font-medium text-primary-700 hover:underline"
                    >
                      {a.phone}
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${roleCls(a.role)}`}>
                      {roleLabel(a.role)}
                    </span>
                  </td>
                  {/* 체크인 시각 + 지연 배지. 지각(+5 이상)은 경고색, 유예 내(+1~4)는 중립 —
                      '늦었지만 봐줬다'는 사실도 기록이라 지우지 않는다. 판정은 services 의 isLate(R5). */}
                  <td className="tnum px-3 py-2.5 text-ink-muted">
                    {a.checkedInAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        {a.checkedInAt}
                        {a.lateMin !== undefined && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${
                              isLate(a.lateMin) ? 'bg-critical-soft text-critical' : 'bg-neutral-100 text-ink-muted'
                            }`}
                          >
                            {isLate(a.lateMin) ? `지각 ${a.lateMin}분` : `+${a.lateMin}분`}
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={a.status} /></td>
                  <td className="tnum px-3 py-2.5 text-ink-muted">{a.checkedOutAt ?? '—'}</td>
                  <td className="px-3 py-2.5 text-ink-muted">{a.lang?.join(' · ') ?? '—'}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-base">{a.checkedInAt ? fmtDur(workMin(a)) : '—'}</td>
                  <td className="pr-3 text-right text-ink-faint transition group-hover:text-primary-600">›</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-8 text-center text-body text-ink-faint">해당 조건의 인력이 없습니다.</div>
        )}
      </div>

      {selectedId && <PersonDetailModal id={selectedId} tab="duty" onClose={() => setSelectedId(null)} />}
    </div>
  )
}
