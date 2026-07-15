import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getPersonnel, getGoodsSummary, getZones, issueGoods, payoutReady,
  hasEducation, certifyEducationBatch, CURRENT_OPERATOR,
} from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import { EDUCATION_KINDS } from '../../../types'
import type { EducationKind, PersonnelRecord, Shift, StaffKind } from '../../../types'
import { PageHeader } from '../../../components/layout'
import { listNo, usePageState, paginate, Pagination } from '../../../components/ui'
import PersonDetailModal from './PersonDetail'

// 인력 현황 — 운영(행정) 대장. 시간 비의존: 스크러버를 밀어도 이 화면은 변하지 않는다.
// 실시간 근태(출결·상태·정시체크)는 '인력 관리'(실시간 관제)의 몫이고,
// 여기는 사람 축 마스터 사실 — 신상·연락처·외국어·배치계획·활동물품·정산서류·교육이수.
//
// 교육 이수: 오프라인 통합교육의 결과를 관리자가 **일괄 인증**한다(봉사자 self-확인 없음).
// 귀속 단위가 사람이므로 선택도 personId 로 모은다(같은 사람의 다른 배치까지 함께 적용).

// 구분(kind) — 이 화면의 1차 축. 자원봉사자와 운영인력은 정산 방식도 발주처 보고 경계도 다르므로
// 드롭다운에 묻어두지 않고 앞에 세운다. 직무(role)는 대장 컬럼의 배지로 읽는다.
const kindFilters: { key: StaffKind | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: '자원봉사자', label: '자원봉사자' },
  { key: '운영인력', label: '운영인력' },
]
const shiftFilters: { key: Shift | 'all'; label: string }[] = [
  { key: 'all', label: '전체 조' },
  { key: 'AM', label: '오전조' },
  { key: 'PM', label: '오후조' },
]

const telHref = (p: string) => `tel:${p.replace(/-/g, '')}`
const shiftKo = (s: Shift) => (s === 'AM' ? '오전' : '오후')

type SortKey = 'no' | 'name' | 'role' | 'shift' | 'zone' | 'lang' | 'goods' | 'payout' | 'edu'

function SummaryTile({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'ok' | 'warn' }) {
  const cls = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink-strong'
  return (
    <div className="card p-4">
      <div className="text-label font-medium text-ink-muted">{label}</div>
      <div className={`tnum mt-1 text-title font-bold ${cls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-caption text-ink-faint">{sub}</div>}
    </div>
  )
}

// 지급 토글 — 누르면 store 뮤테이트 → 상단 집계·모달까지 전파(R3).
function GoodsCell({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-label={label}
      aria-pressed={on}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-caption font-bold transition ${
        on
          ? 'bg-ok-soft text-ok hover:bg-ok/20'
          : 'bg-neutral-100 text-ink-faint ring-1 ring-inset ring-line hover:bg-neutral-200'
      }`}
    >
      {on ? '✓' : '—'}
    </button>
  )
}

export default function Personnel() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [kind, setKind] = useState<StaffKind | 'all'>('all')
  const [shift, setShift] = useState<Shift | 'all'>('all')
  const [zoneFilter, setZoneFilter] = useState('all')
  const [payoutPendingOnly, setPayoutPendingOnly] = useState(false)
  const [q, setQ] = useState('')
  // 대시보드 이수율 KPI 드릴다운 진입점 — ?edu=pending 이면 미이수자만.
  const [params, setParams] = useSearchParams()
  const eduPendingOnly = params.get('edu') === 'pending'
  const setEduPendingOnly = (on: boolean) => {
    const next = new URLSearchParams(params)
    if (on) next.set('edu', 'pending')
    else next.delete('edu')
    setParams(next, { replace: true })
  }
  const [selected, setSelected] = useState<Set<string>>(new Set()) // personId 집합
  const [certKind, setCertKind] = useState<EducationKind>('사전 통합교육')
  const [toast, setToast] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'no', dir: 1 })
  // 훅은 조기 반환(`if (!people || !goods)`) 앞에서 — 필터가 바뀌면 1페이지로.
  const pg = usePageState(`${q}|${kind}|${shift}|${zoneFilter}|${payoutPendingOnly}|${eduPendingOnly}`)

  const people = useLive(getPersonnel)
  const goods = useLive(getGoodsSummary)
  const zones = useLive(getZones) ?? []
  if (!people || !goods) return null

  const zoneName = (p: PersonnelRecord) =>
    p.isReserve ? '예비 · 미배정' : zones.find((z) => z.id === p.zoneId)?.name ?? '—'
  const goodsDone = (p: PersonnelRecord) => (p.goods.jacket ? 1 : 0) + (p.goods.bag ? 1 : 0)
  // 외국어 우선배치는 자원봉사자(관광지 거점) 얘기 — 운영인력을 섞으면 모수가 오염된다.
  const langCount = people.filter((p) => p.kind === '자원봉사자' && p.lang.length > 0).length
  // 교육 이수율 — 배치 인력 기준(예비 제외). 대시보드 KPI와 같은 모수.
  const eduBase = people.filter((p) => !p.isReserve)
  const eduDone = eduBase.filter((p) => hasEducation(p.education, '사전 통합교육')).length
  const eduPending = eduBase.length - eduDone
  const eduRate = eduBase.length ? Math.round((eduDone / eduBase.length) * 100) : 0

  const qq = q.trim().toLowerCase()
  const matchQ = (p: PersonnelRecord) =>
    !qq || [p.personName, zoneName(p), p.phone, p.role, ...p.lang].some((v) => v.toLowerCase().includes(qq))
  const inZone = (p: PersonnelRecord) =>
    zoneFilter === 'all' || (zoneFilter === 'reserve' ? p.isReserve : p.zoneId === zoneFilter)
  const filtered = people.filter(
    (p) =>
      (kind === 'all' || p.kind === kind) &&
      (shift === 'all' || p.shift === shift) &&
      inZone(p) &&
      (!payoutPendingOnly || !payoutReady(p.payout)) &&
      (!eduPendingOnly || !hasEducation(p.education, '사전 통합교육')) &&
      matchQ(p)
  )
  const rows =
    sort.key === 'no'
      ? filtered
      : [...filtered].sort((a, b) => {
          const d = sort.dir
          switch (sort.key) {
            case 'name': return d * a.personName.localeCompare(b.personName)
            case 'role': return d * a.role.localeCompare(b.role)
            case 'shift': return d * (a.shift.localeCompare(b.shift) || a.personName.localeCompare(b.personName))
            case 'zone': return d * zoneName(a).localeCompare(zoneName(b))
            case 'lang': return d * ((a.lang[0] ?? 'ㅎ').localeCompare(b.lang[0] ?? 'ㅎ'))
            case 'goods': return d * (goodsDone(a) - goodsDone(b))
            case 'payout': return d * (Number(payoutReady(a.payout)) - Number(payoutReady(b.payout)))
            case 'edu':
              return d * (Number(hasEducation(a.education, '사전 통합교육')) - Number(hasEducation(b.education, '사전 통합교육')))
            default: return 0
          }
        })

  const toggleSort = (k: SortKey) =>
    setSort((s) => (s.key === k ? { key: k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { key: k, dir: 1 }))

  const page = paginate(rows, pg.page)

  const togglePick = (personId: string) =>
    setSelected((s) => {
      const n = new Set(s)
      n.has(personId) ? n.delete(personId) : n.add(personId)
      return n
    })
  // 헤더 체크박스 — 지금 보이는 행(= 현재 페이지) 전체 선택/해제.
  // 선택은 personId Set 이라 페이지를 넘겨도 유지된다. 페이지를 넘나들며 모으는 대신
  // 필터 전체를 한 번에 잡으려면 일괄바의 '필터 전체 N명 선택'을 쓴다.
  const visibleIds = page.slice.map((r) => r.personId)
  const allPicked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s)
      allPicked ? visibleIds.forEach((id) => n.delete(id)) : visibleIds.forEach((id) => n.add(id))
      return n
    })

  // 일괄 인증 — 이미 이수한 사람은 서비스가 건너뛴다(중복 기록 방지).
  const certify = async () => {
    const ids = [...selected]
    const n = await certifyEducationBatch(ids, certKind)
    setToast(
      n === 0
        ? `선택한 ${ids.length}명은 이미 ${certKind} 이수 상태입니다.`
        : `${certKind} ${n}명 이수 처리${n < ids.length ? ` (${ids.length - n}명은 이미 이수)` : ''}`
    )
    setSelected(new Set())
    setTimeout(() => setToast(''), 3500)
  }

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

  const pct = goods.total ? Math.round((goods.complete / goods.total) * 100) : 0

  return (
    <div>
      <PageHeader
        title="인력 현황"
        summary="배치 인력 전원 명부 대장 — 신상·연락처·외국어·배치계획·활동물품 지급 (시간 비의존 마스터)"
        right={
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-label font-semibold text-ink-base shadow-sm transition hover:text-ink-strong"
          >
            명단 출력
          </button>
        }
      />

      {/* 요약 — 물품 지급률이 이 화면의 KPI(근태 아님) */}
      <div className="mb-4 grid grid-cols-6 gap-3">
        {/* 총원은 전 인력, 물품·교육 모수는 자원봉사자 — 서로 다르므로 sub 에 구성을 명시한다. */}
        <SummaryTile
          label="명부 총원"
          value={`${people.length}명`}
          sub={`자원봉사자 ${people.filter((p) => p.kind === '자원봉사자').length} · 운영인력 ${people.filter((p) => p.kind === '운영인력').length}`}
        />
        <SummaryTile label="활동물품 지급 완료" value={`${pct}%`} sub={`2종 완료 ${goods.complete} / ${goods.total}`} tone={pct === 100 ? 'ok' : 'default'} />
        <SummaryTile label="미지급 잔여" value={`${goods.pending}명`} sub={`바람막이 ${goods.total - goods.jacket} · 가방 ${goods.total - goods.bag}`} tone={goods.pending ? 'warn' : 'ok'} />
        <SummaryTile
          label="정산 서류 등록"
          value={`${goods.payoutReady}명`}
          sub={goods.payoutPending ? `미비 ${goods.payoutPending}명 — 지급 전 보완` : '전원 등록 완료'}
          tone={goods.payoutPending ? 'warn' : 'ok'}
        />
        <SummaryTile
          label="사전 통합교육 이수"
          value={`${eduRate}%`}
          sub={eduPending ? `미이수 ${eduPending}명` : '전원 이수 완료'}
          tone={eduPending ? 'warn' : 'ok'}
        />
        <SummaryTile label="외국어 가능" value={`${langCount}명`} sub="영어 · 중국어 · 일본어 · 러시아어" />
      </div>

      {/* 검색 · 필터 */}
      <div className="mb-3 flex items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="이름 · 거점 · 연락처 · 역할 · 외국어 검색"
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* 구분 — 자원봉사자 / 운영인력. 이 화면의 1차 축이라 맨 앞에 둔다. */}
        <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
          {kindFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setKind(f.key)}
              className={`rounded-full px-3.5 py-1 text-label font-semibold transition ${
                kind === f.key ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-ink-strong'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="mx-0.5 h-4 w-px bg-line" />
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
        <button
          onClick={() => setEduPendingOnly(!eduPendingOnly)}
          className={`ml-auto rounded-full px-3 py-1.5 text-label font-semibold transition ${
            eduPendingOnly ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'
          }`}
        >
          교육 미이수만
        </button>
        <button
          onClick={() => setPayoutPendingOnly((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-label font-semibold transition ${
            payoutPendingOnly ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'
          }`}
        >
          정산 서류 미비만
        </button>
      </div>

      {/* 일괄 인증 액션바 — 선택이 있을 때만 뜬다. 오프라인 통합교육 참석자 일괄 처리. */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5">
          <span className="text-label font-semibold text-primary-800">
            <b className="tnum">{selected.size}</b>명 선택됨
          </span>
          <span className="h-4 w-px bg-primary-200" />
          <select
            value={certKind}
            onChange={(e) => setCertKind(e.target.value as EducationKind)}
            className="rounded-lg border border-primary-200 bg-surface px-3 py-1.5 text-label font-medium text-ink-strong outline-none transition focus:border-primary-400"
          >
            {EDUCATION_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <button
            onClick={certify}
            className="rounded-lg bg-primary-600 px-4 py-1.5 text-label font-semibold text-white transition hover:bg-primary-700"
          >
            이수 처리
          </button>
          {/* 헤더 체크박스는 현재 페이지(20명)까지만 잡는다. 일괄 인증은 이 화면의 핵심이라
              필터 전체를 한 번에 잡는 경로를 남긴다(페이지를 6번 넘기게 만들지 않는다). */}
          {rows.length > page.slice.length && (
            <button
              onClick={() => setSelected(new Set(rows.map((r) => r.personId)))}
              className="text-label font-semibold text-primary-700 underline-offset-2 transition hover:underline"
            >
              필터 전체 {rows.length}명 선택
            </button>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="text-label font-medium text-ink-muted transition hover:text-ink-strong"
          >
            선택 해제
          </button>
          <span className="ml-auto text-caption text-primary-700">인증자 {CURRENT_OPERATOR}</span>
        </div>
      )}
      {toast && (
        <div className="mb-3 rounded-xl border border-ok/30 bg-ok-soft px-4 py-2.5 text-label font-semibold text-ok">
          ✓ {toast}
        </div>
      )}

      {/* 명부 대장 (컬럼 헤더 클릭 = 소팅 · 물품 칸 클릭 = 지급 처리) */}
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
              <th className="w-9 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={toggleAll}
                  aria-label="표시된 인원 전체 선택"
                  className="h-3.5 w-3.5 cursor-pointer accent-primary-600"
                />
              </th>
              <Th label="No." align="right" />
              <Th label="이름" k="name" />
              <Th label="역할" k="role" />
              <Th label="조" k="shift" />
              <Th label="배치 거점" k="zone" />
              <Th label="연락처" />
              <Th label="외국어" k="lang" />
              <Th label="교육 이수" k="edu" />
              <Th label="바람막이" align="center" />
              <Th label="가방" align="center" />
              <Th label="정산 서류" k="payout" />
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {page.slice.map((p, i) => (
              <tr
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`group cursor-pointer border-b border-line-soft transition last:border-0 ${
                  selected.has(p.personId) ? 'bg-primary-50' : 'hover:bg-primary-50/50'
                }`}
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(p.personId)}
                    onChange={() => togglePick(p.personId)}
                    aria-label={`${p.personName} 선택`}
                    className="h-3.5 w-3.5 cursor-pointer accent-primary-600"
                  />
                </td>
                <td className="tnum px-3 py-2.5 text-right text-ink-faint">{listNo(page.start + i)}</td>
                <td className="px-3 py-2.5 font-semibold text-ink-strong">{p.personName}</td>
                {/* 직무 + 고용형태 — 운영인력만 고용형태가 붙는다(자원봉사자는 고용관계가 없다). */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    {p.kind === '운영인력' ? (
                      <span className="rounded-md bg-primary-50 px-1.5 py-0.5 text-caption font-semibold text-primary-700">{p.role}</span>
                    ) : (
                      <span className="text-ink-base">{p.role}</span>
                    )}
                    {p.employment && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${
                          p.employment === '직원' ? 'bg-info-soft text-info' : 'bg-neutral-100 text-ink-muted'
                        }`}
                      >
                        {p.employment}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${p.shift === 'AM' ? 'bg-info-soft text-info' : 'bg-primary-50 text-primary-700'}`}>
                    {shiftKo(p.shift)}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-ink-base">
                  {p.isReserve ? <span className="text-ink-faint">예비 · 미배정</span> : zoneName(p)}
                </td>
                <td className="px-3 py-2.5">
                  <a
                    href={telHref(p.phone)}
                    onClick={(e) => e.stopPropagation()}
                    className="tnum text-label font-medium text-primary-700 hover:underline"
                  >
                    {p.phone}
                  </a>
                </td>
                <td className="px-3 py-2.5 text-ink-muted">{p.lang.length ? p.lang.join(' · ') : '—'}</td>
                <td className="px-3 py-2.5">
                  {hasEducation(p.education, '사전 통합교육') ? (
                    <span className="rounded-md bg-ok-soft px-2 py-0.5 text-caption font-semibold text-ok">
                      이수{hasEducation(p.education, '현장교육') ? ' · 현장' : ''}
                    </span>
                  ) : (
                    <span className="rounded-md bg-warn-soft px-2 py-0.5 text-caption font-semibold text-warn">미이수</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <GoodsCell
                    on={p.goods.jacket}
                    label={`${p.personName} 바람막이 지급`}
                    onToggle={() => issueGoods(p.id, { jacket: !p.goods.jacket })}
                  />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <GoodsCell
                    on={p.goods.bag}
                    label={`${p.personName} 가방 지급`}
                    onToggle={() => issueGoods(p.id, { bag: !p.goods.bag })}
                  />
                </td>
                <td className="px-3 py-2.5">
                  {payoutReady(p.payout) ? (
                    <span className="rounded-md bg-ok-soft px-2 py-0.5 text-caption font-semibold text-ok">등록 완료</span>
                  ) : (
                    <span className="rounded-md bg-warn-soft px-2 py-0.5 text-caption font-semibold text-warn">
                      {!p.payout.idCard && !p.payout.bankbook ? '미등록' : '서류 미비'}
                    </span>
                  )}
                </td>
                <td className="pr-3 text-right text-ink-faint transition group-hover:text-primary-600">›</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-8 text-center text-body text-ink-faint">해당 조건의 인력이 없습니다.</div>
        )}
      </div>

      <p className="mt-3 text-caption text-ink-faint">개인정보 최소수집 · 행사 종료 후 즉시 파기</p>

      {selectedId && <PersonDetailModal id={selectedId} tab="profile" onClose={() => setSelectedId(null)} />}
    </div>
  )
}
