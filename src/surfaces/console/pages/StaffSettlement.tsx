import { useState } from 'react'
import { getStaffSettlement, setStaffWage, setStaffHours } from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import type { Employment } from '../../../types'
import { Section } from '../../../components/layout'
import { listNo, usePageState, paginate, Pagination, ListToolbar, ToolbarRow, FilterPills } from '../../../components/ui'
import { roleLabel, roleCls } from '../../../lib/roleLabel'

// 운영인력 정산 — 자원봉사자 실비와 성격이 다르다.
//   · 실비(24,000)가 아니라 고용 대가다 → 직원은 급여라 여기서 산정하지 않고(0원), 일용만 시급 기준.
//   · 발주처 보고 대상이 아니다(내부 원가) → 산출내역서에는 자원봉사자만 오른다.
//   · 세목도 다르다: 자원봉사자는 사업소득 3.3%, 일용은 일용근로소득.
// 고용형태를 나눠 두 화면을 만들지 않고 통합 대장 하나로 두되, 형태가 정산총액만 가른다.

const won = (n: number) => n.toLocaleString('ko-KR')

const empCls: Record<Employment, string> = {
  직원: 'bg-info-soft text-info',
  일용: 'bg-primary-50 text-primary-700',
}

const empFilters: { key: Employment | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: '직원', label: '직원' },
  { key: '일용', label: '일용' },
]

function Tile({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'primary' | 'muted' }) {
  const cls = tone === 'primary' ? 'text-primary-600' : tone === 'muted' ? 'text-ink-muted' : 'text-ink-strong'
  return (
    <div className="card p-4">
      <div className="text-label font-medium text-ink-muted">{label}</div>
      <div className={`tnum mt-1 text-title font-bold ${cls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-caption text-ink-faint">{sub}</div>}
    </div>
  )
}

export default function StaffSettlement() {
  const [emp, setEmp] = useState<Employment | 'all'>('all')
  const [q, setQ] = useState('')
  const pg = usePageState(`${emp}|${q}`)

  const st = useLive(getStaffSettlement)
  if (!st) return null

  const qq = q.trim().toLowerCase()
  const rows = st.rows.filter(
    (r) =>
      (emp === 'all' || r.employment === emp) &&
      (!qq || [r.personName, r.zoneName, r.role].some((v) => v.toLowerCase().includes(qq)))
  )
  const page = paginate(rows, pg.page)

  const taxablePerDay = Math.max(0, st.dailyWage - st.deduction)
  const perDayTax = Math.round(taxablePerDay * (st.taxRate / 100))

  return (
    <div>
      {/* 산정 기준 — 시급·근무시간이 입력값. 일급은 여기서 파생된다. */}
      <div className="mb-4">
        <Section title="산정 기준">
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className="block text-label font-medium text-ink-muted">시급</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={st.hourlyWage}
                  onChange={(e) => setStaffWage(Number(e.target.value))}
                  className="tnum w-32 rounded-lg border border-line bg-surface px-3 py-2 text-body font-semibold text-ink-strong shadow-sm outline-none transition focus:border-primary-400"
                />
                <span className="text-label text-ink-muted">원 / 시간</span>
              </div>
            </div>
            <div>
              <label className="block text-label font-medium text-ink-muted">1일 근무시간</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.5}
                  value={st.hoursPerDay}
                  onChange={(e) => setStaffHours(Number(e.target.value))}
                  className="tnum w-24 rounded-lg border border-line bg-surface px-3 py-2 text-body font-semibold text-ink-strong shadow-sm outline-none transition focus:border-primary-400"
                />
                <span className="text-label text-ink-muted">시간 (설치·정리 포함 상주)</span>
              </div>
            </div>
          </div>

          {/* 산식 전개 — 입력값이 일급·원천징수로 가는 경로를 그대로 노출 */}
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-page px-4 py-3 text-label">
              <span className="w-28 shrink-0 text-caption font-semibold text-ink-muted">일급</span>
              <span className="tnum font-semibold text-ink-strong">{won(st.hourlyWage)}</span>
              <span className="text-ink-muted">×</span>
              <span className="tnum text-ink-base">{st.hoursPerDay}시간</span>
              <span className="text-ink-muted">=</span>
              <span className="tnum text-section font-bold text-primary-600">{won(st.dailyWage)}원</span>
              <span className="text-caption text-ink-muted">/ 1인 1일</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-page px-4 py-3 text-label">
              <span className="w-28 shrink-0 text-caption font-semibold text-ink-muted">원천징수</span>
              <span className="tnum text-ink-base">
                ({won(st.dailyWage)} − {won(st.deduction)})
              </span>
              <span className="text-ink-muted">× {st.taxRate}%</span>
              <span className="text-ink-muted">=</span>
              {perDayTax > 0 ? (
                <>
                  <span className="tnum text-section font-bold text-warn">{won(perDayTax)}원</span>
                  <span className="text-caption text-ink-muted">/ 1인 1일</span>
                </>
              ) : (
                <>
                  <span className="tnum text-section font-bold text-ok">0원</span>
                  <span className="rounded-md bg-ok-soft px-2 py-0.5 text-caption font-semibold text-ok">
                    일급 {won(st.deduction)}원 이하 — 원천징수 대상 아님
                  </span>
                </>
              )}
            </div>
            <p className="px-1 text-caption text-ink-faint">
              일용근로소득 — 근로소득공제 {won(st.deduction)}원은 1일당 적용되므로 근무일수와 무관하다.
              자원봉사자 실비(사업소득 3.3%)와 세목이 다르다.
            </p>
          </div>
        </Section>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-3">
        <Tile label="운영인력" value={`${st.headcount}명`} />
        <Tile label="직원" value={`${st.employeeCount}명`} tone="muted" />
        <Tile label="일용" value={`${st.daylaborCount}명`} sub={`일급 ${won(st.dailyWage)}원`} />
        <Tile label="일용 실수령 소계" value={`${won(st.daylaborNet)}원`} sub={`지급 ${won(st.daylaborGross)} − 원천징수 ${won(st.daylaborWithholding)}`} tone="primary" />
      </div>

      <ListToolbar>
        <ToolbarRow>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름 · 배치 · 직무 검색"
            className="w-[200px] rounded-lg border border-line bg-surface px-3 py-1.5 text-label text-ink-strong shadow-sm outline-none transition placeholder:text-ink-faint focus:border-primary-400"
          />
          <span className="tnum text-caption text-ink-muted">{rows.length}명</span>
        </ToolbarRow>

        <ToolbarRow right={<Pagination page={page.page} pages={page.pages} onChange={pg.setPage} />}>
          <FilterPills options={empFilters} value={emp} onChange={setEmp} />
        </ToolbarRow>
      </ListToolbar>

      <div className="card overflow-hidden">
        <table className="w-full text-label">
          <thead>
            <tr className="border-b border-line bg-neutral-50 text-caption text-ink-muted">
              <th className="px-3 py-2.5 text-right font-semibold">No.</th>
              <th className="px-3 py-2.5 text-left font-semibold">이름</th>
              <th className="px-3 py-2.5 text-left font-semibold">직무</th>
              <th className="px-3 py-2.5 text-left font-semibold">고용형태</th>
              <th className="px-3 py-2.5 text-left font-semibold">배치</th>
              <th className="px-3 py-2.5 text-right font-semibold">계획일</th>
              <th className="px-3 py-2.5 text-right font-semibold">결근</th>
              <th className="px-3 py-2.5 text-right font-semibold">실근무일</th>
              <th className="px-3 py-2.5 text-right font-semibold">일급</th>
              <th className="px-3 py-2.5 text-right font-semibold">지급액</th>
              <th className="px-3 py-2.5 text-right font-semibold">원천징수</th>
              <th className="px-3 py-2.5 text-right font-semibold">실수령</th>
            </tr>
          </thead>
          <tbody>
            {page.slice.map((r, i) => {
              const isEmp = r.employment === '직원'
              return (
                <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-primary-50/50">
                  <td className="tnum px-3 py-2.5 text-right text-ink-faint">{listNo(page.start + i)}</td>
                  <td className="px-3 py-2.5 font-semibold text-ink-strong">{r.personName}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${roleCls(r.role)}`}>
                      {roleLabel(r.role)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${empCls[r.employment]}`}>
                      {r.employment}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-base">{r.zoneName}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-muted">{r.plannedDays}일</td>
                  <td className={`tnum px-3 py-2.5 text-right ${r.absentDays ? 'font-semibold text-critical' : 'text-ink-faint'}`}>
                    {r.absentDays ? `${r.absentDays}일` : '—'}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold text-ink-base">{r.workedDays}일</td>
                  {isEmp ? (
                    // 직원은 급여라 이 정산에서 산정하지 않는다 — 고용형태 배지가 이미 그 말을 한다.
                    <td className="px-3 py-2.5 text-center text-ink-faint" colSpan={4}>
                      —
                    </td>
                  ) : (
                    <>
                      <td className="tnum px-3 py-2.5 text-right text-ink-muted">{won(r.dailyWage)}원</td>
                      <td className="tnum px-3 py-2.5 text-right text-ink-base">{won(r.gross)}원</td>
                      <td className={`tnum px-3 py-2.5 text-right ${r.withholding ? 'text-warn' : 'text-ink-faint'}`}>
                        {r.withholding ? `− ${won(r.withholding)}원` : '—'}
                      </td>
                      <td className="tnum px-3 py-2.5 text-right font-bold text-ink-strong">{won(r.net)}원</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-8 text-center text-body text-ink-faint">해당 조건의 인력이 없습니다.</div>}
        <div className="flex items-center justify-between gap-6 border-t border-line bg-neutral-50 px-3 py-3">
          <span className="text-label font-bold text-ink-strong">
            {rows.length}명 소계 <span className="font-medium text-ink-muted">(일용 {rows.filter((r) => r.employment === '일용').length}명 기준)</span>
          </span>
          <div className="flex items-center gap-6 text-label">
            <span className="text-ink-muted">
              지급 <b className="tnum text-ink-base">{won(rows.reduce((s, r) => s + r.gross, 0))}원</b>
            </span>
            <span className="text-ink-muted">
              원천징수 <b className="tnum text-warn">− {won(rows.reduce((s, r) => s + r.withholding, 0))}원</b>
            </span>
            <span className="text-ink-muted">
              실수령 <b className="tnum text-section text-primary-700">{won(rows.reduce((s, r) => s + r.net, 0))}원</b>
            </span>
          </div>
        </div>
        <p className="border-t border-line px-3 py-2.5 text-caption text-ink-faint">
          내부 원가 — 발주처 실비 정산(산출내역) 대상이 아니다. 계획일 5일 · 결근은 일할 계산.
        </p>
      </div>
    </div>
  )
}
