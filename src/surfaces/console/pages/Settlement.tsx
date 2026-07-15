import { useState } from 'react'
import {
  getExpenses, getSettlementRows, setExpenseGoodsUnitCost, setExpenseWithholdingRate,
  shiftLabel, maskAccount,
} from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import type { Shift } from '../../../types'
import { PageHeader, Section } from '../../../components/layout'
import { listNo, usePageState, paginate, Pagination } from '../../../components/ui'
import StaffSettlement from './StaffSettlement'

// 정산 산출내역 — '이렇게 정산하겠다'는 **산정 방식** 제시 화면(지급 후 집행 실적이 아님).
//
// 인력 구분에 따라 정산이 갈린다(구분 탭):
//   자원봉사자 — RFP 3-1 실비 1인당 24,000원(지급물품 대금 포함). **발주처 보고 대상.**
//     → 물품은 총액에 더하는 게 아니라 총액에서 빼낸다: 일일 지급기준 = 24,000 − 세트단가/4.5
//     → 현금(일당)에만 원천징수 적용(현물인 활동물품은 대상 아님)
//     → 결근 시 실근무일 기준 일할 계산 = 산정 규칙이지 실적 집계가 아니다
//   운영인력 — 실비가 아니라 고용 대가(직원=급여 · 일용=시급). 내부 원가라 보고 대상이 아니다.
//
// 세트 단가·원천징수율·시급은 확정값이 아니라 입력값 — 바꾸면 전 계산이 재전파된다.

const won = (n: number) => n.toLocaleString('ko-KR')
const kinds = [
  { key: 'volunteer', label: '자원봉사자' },
  { key: 'staff', label: '운영인력' },
] as const
type KindKey = (typeof kinds)[number]['key']
const tabs = [
  { key: 'summary', label: '산정 기준' },
  { key: 'detail', label: '개인별 산출' },
] as const
type TabKey = (typeof tabs)[number]['key']

function Tile({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'primary' | 'warn' }) {
  const cls = tone === 'primary' ? 'text-primary-600' : tone === 'warn' ? 'text-warn' : 'text-ink-strong'
  return (
    <div className="card p-4">
      <div className="text-label font-medium text-ink-muted">{label}</div>
      <div className={`tnum mt-1 text-title font-bold ${cls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-caption text-ink-faint">{sub}</div>}
    </div>
  )
}

export default function Settlement() {
  const [kind, setKind] = useState<KindKey>('volunteer')
  const [tab, setTab] = useState<TabKey>('summary')
  const [shift, setShift] = useState<Shift | 'all'>('all')
  const [absentOnly, setAbsentOnly] = useState(false)
  const [q, setQ] = useState('')
  // 훅은 조기 반환(`if (!ex || !rows)`) 앞에서 — 필터·탭이 바뀌면 1페이지로.
  const pg = usePageState(`${tab}|${q}|${shift}|${absentOnly}`)

  const ex = useLive(getExpenses)
  const rows = useLive(getSettlementRows)
  if (!ex || !rows) return null

  const absentDaysTotal = rows.reduce((s, r) => s + r.absentDays, 0)

  const qq = q.trim().toLowerCase()
  const detailRows = rows.filter(
    (r) =>
      (shift === 'all' || r.shift === shift) &&
      (!absentOnly || r.absentDays > 0) &&
      (!qq || [r.personName, r.zoneName].some((v) => v.toLowerCase().includes(qq)))
  )
  // 표 본문만 자른다 — 하단 소계는 페이지가 아니라 필터 전체 기준이어야 한다.
  const page = paginate(detailRows, pg.page)

  return (
    <div>
      <PageHeader
        title="정산 산출내역"
        summary={
          kind === 'volunteer'
            ? '자원봉사자 1인당(교대근무자별) 24,000원 · 지급물품 대금 포함 — 발주처 보고 대상'
            : '운영인력 — 직원(급여)·일용(시급) · 실비가 아닌 내부 원가'
        }
      />

      {/* 구분 — 정산 방식도 보고 경계도 다르므로 화면의 1차 축이다. */}
      <div className="mb-4 flex gap-1 rounded-full bg-neutral-100 p-0.5 w-fit">
        {kinds.map((k) => (
          <button
            key={k.key}
            onClick={() => setKind(k.key)}
            className={`rounded-full px-4 py-1.5 text-label font-semibold transition ${
              kind === k.key ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-ink-strong'
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {kind === 'staff' && <StaffSettlement />}
      {kind === 'volunteer' && (
       <>

      {/* 산정 기준 — 물품 세트 단가가 입력값. 여기서 전부 파생된다. */}
      <div className="mb-4">
        <Section title="산정 기준">
          <div className="flex flex-wrap items-end gap-5">
            <div>
              <label className="block text-label font-medium text-ink-muted">물품 세트 단가 (바람막이+가방)</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={ex.goodsUnitCost}
                  onChange={(e) => setExpenseGoodsUnitCost(Number(e.target.value))}
                  className="tnum w-32 rounded-lg border border-line bg-surface px-3 py-2 text-body font-semibold text-ink-strong shadow-sm outline-none transition focus:border-primary-400"
                />
                <span className="text-label text-ink-muted">원 / 1인 1세트</span>
              </div>
            </div>
            <div>
              <label className="block text-label font-medium text-ink-muted">원천징수율</label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={ex.withholdingRate}
                  onChange={(e) => setExpenseWithholdingRate(Number(e.target.value))}
                  className="tnum w-24 rounded-lg border border-line bg-surface px-3 py-2 text-body font-semibold text-ink-strong shadow-sm outline-none transition focus:border-primary-400"
                />
                <span className="text-label text-ink-muted">% (사업소득 3 + 지방소득세 0.3)</span>
              </div>
            </div>
          </div>

          {/* 산식 전개 — 입력값이 어떻게 지급기준·실수령이 되는지 화면에 그대로 노출 */}
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-page px-4 py-3 text-label">
              <span className="w-28 shrink-0 text-caption font-semibold text-ink-muted">일일 지급기준</span>
              <span className="tnum font-semibold text-ink-strong">{won(ex.unitPerDay)}</span>
              <span className="text-ink-muted">−</span>
              <span className="tnum text-ink-base">({won(ex.goodsUnitCost)} ÷ {ex.avgDays})</span>
              <span className="text-ink-muted">=</span>
              <span className="tnum text-section font-bold text-primary-600">{won(Math.round(ex.dailyPayout))}원</span>
              <span className="text-caption text-ink-muted">/ 1인 1일 (세전)</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line bg-page px-4 py-3 text-label">
              <span className="w-28 shrink-0 text-caption font-semibold text-ink-muted">1일 실수령</span>
              <span className="tnum font-semibold text-ink-strong">{won(Math.round(ex.dailyPayout))}</span>
              <span className="text-ink-muted">− 원천징수 {ex.withholdingRate}%</span>
              <span className="text-ink-muted">=</span>
              <span className="tnum text-section font-bold text-primary-600">
                {won(Math.round(ex.dailyPayout * (1 - ex.withholdingRate / 100)))}원
              </span>
            </div>
          </div>

        </Section>
      </div>

      {/* 총액 구성 — 물품은 총액에서 빼낸 것(더한 것이 아님). 전부 계획 기준 산정치. */}
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Tile label="총 실비" value={`${won(ex.perDiemTotal)}원`} sub={`연인원 ${ex.personDays}명 × ${won(ex.unitPerDay)}원`} tone="default" />
        <Tile label="활동물품 (현물)" value={`${won(ex.goodsTotal)}원`} sub={`${ex.goodsSets}세트 × ${won(ex.goodsUnitCost)}원`} />
        <Tile label="일당 (현금·세전)" value={`${won(ex.payoutTotal)}원`} sub={`일일 ${won(Math.round(ex.dailyPayout))}원 × ${ex.personDays}명`} tone="primary" />
        <Tile
          label={`원천징수 ${ex.withholdingRate}%`}
          value={`${won(Math.round(ex.withholdingTotal))}원`}
          sub="현금분만 적용 (현물 제외)"
          tone="warn"
        />
      </div>

      {/* 탭 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full px-3.5 py-1 text-label font-semibold transition ${
                tab === t.key ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-ink-strong'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'detail' && (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 · 거점 검색"
              className="ml-2 w-full max-w-[200px] rounded-lg border border-line bg-surface px-3 py-1.5 text-label text-ink-strong shadow-sm outline-none transition placeholder:text-ink-faint focus:border-primary-400"
            />
            <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
              {([
                { key: 'all', label: '전체' },
                { key: 'AM', label: '오전조' },
                { key: 'PM', label: '오후조' },
              ] as const).map((f) => (
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
              onClick={() => setAbsentOnly((v) => !v)}
              className={`ml-auto rounded-full px-3 py-1.5 text-label font-semibold transition ${
                absentOnly ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'
              }`}
            >
              결근자만
            </button>
          </>
        )}
      </div>

      {/* 정산 현황 — 일자별 집행 */}
      {tab === 'summary' && (
        <div className="card overflow-hidden">
          <table className="w-full text-label">
            <thead>
              <tr className="border-b border-line bg-neutral-50 text-caption text-ink-muted">
                <th className="px-3 py-2.5 text-left font-semibold">운영일</th>
                <th className="px-3 py-2.5 text-left font-semibold">교대</th>
                <th className="px-3 py-2.5 text-right font-semibold">배치 인원</th>
                <th className="px-3 py-2.5 text-right font-semibold">일일 지급기준</th>
                <th className="px-3 py-2.5 text-right font-semibold">일당 소계</th>
              </tr>
            </thead>
            <tbody>
              {ex.breakdown.map((b) => (
                <tr key={b.date} className="border-b border-line-soft last:border-0">
                  <td className="tnum px-3 py-2.5 text-ink-strong">{b.date}</td>
                  <td className="px-3 py-2.5 text-ink-base">{b.shifts === 2 ? '2교대 (오전·오후)' : '1교대 (오전)'}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-base">{b.headcount}명</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-muted">{won(Math.round(ex.dailyPayout))}원</td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold text-ink-strong">{won(b.amount)}원</td>
                </tr>
              ))}
              <tr className="border-t border-line bg-neutral-50">
                <td className="px-3 py-3 font-bold text-ink-strong" colSpan={2}>
                  일당 소계 (현금 · 세전)
                </td>
                <td className="tnum px-3 py-3 text-right font-semibold text-ink-base">{ex.personDays}명</td>
                <td />
                <td className="tnum px-3 py-3 text-right font-bold text-primary-700">{won(ex.payoutTotal)}원</td>
              </tr>
              <tr className="border-t border-line-soft">
                <td className="px-3 py-2.5 text-ink-muted" colSpan={2}>
                  └ 원천징수 {ex.withholdingRate}% (현금분만)
                </td>
                <td />
                <td />
                <td className="tnum px-3 py-2.5 text-right font-medium text-warn">− {won(Math.round(ex.withholdingTotal))}원</td>
              </tr>
              <tr className="border-b border-line-soft">
                <td className="px-3 py-2.5 font-semibold text-ink-strong" colSpan={2}>
                  └ 실수령 소계
                </td>
                <td />
                <td />
                <td className="tnum px-3 py-2.5 text-right font-semibold text-ink-strong">{won(Math.round(ex.netPayoutTotal))}원</td>
              </tr>
              <tr>
                <td className="px-3 py-2.5 text-ink-base" colSpan={2}>
                  활동물품 (현물 · {ex.goodsSets}세트 × {won(ex.goodsUnitCost)}원)
                </td>
                <td />
                <td />
                <td className="tnum px-3 py-2.5 text-right font-semibold text-ink-strong">{won(ex.goodsTotal)}원</td>
              </tr>
              <tr className="border-t border-line bg-primary-50">
                <td className="px-3 py-3 font-bold text-primary-800" colSpan={2}>
                  총 실비
                </td>
                <td />
                <td />
                <td className="tnum px-3 py-3 text-right text-section font-bold text-primary-800">{won(ex.perDiemTotal)}원</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* 개인별 내역 — 계획일수 ≠ 실근무일수(결근 반영) */}
      {tab === 'detail' && (
       <>
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
                <th className="px-3 py-2.5 text-right font-semibold">No.</th>
                <th className="px-3 py-2.5 text-left font-semibold">이름</th>
                <th className="px-3 py-2.5 text-left font-semibold">조</th>
                <th className="px-3 py-2.5 text-left font-semibold">거점</th>
                <th className="px-3 py-2.5 text-right font-semibold">계획일</th>
                <th className="px-3 py-2.5 text-right font-semibold">결근</th>
                <th className="px-3 py-2.5 text-right font-semibold">실근무일</th>
                <th className="px-3 py-2.5 text-right font-semibold">일당(세전)</th>
                <th className="px-3 py-2.5 text-right font-semibold">원천징수</th>
                <th className="px-3 py-2.5 text-right font-semibold">실수령</th>
                <th className="px-3 py-2.5 text-right font-semibold">물품(현물)</th>
                <th className="px-3 py-2.5 text-left font-semibold">지급계좌</th>
              </tr>
            </thead>
            <tbody>
              {page.slice.map((r, i) => (
                <tr key={r.id} className="border-b border-line-soft last:border-0 hover:bg-primary-50/50">
                  <td className="tnum px-3 py-2.5 text-right text-ink-faint">{listNo(page.start + i)}</td>
                  <td className="px-3 py-2.5 font-semibold text-ink-strong">{r.personName}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${r.shift === 'AM' ? 'bg-info-soft text-info' : 'bg-primary-50 text-primary-700'}`}>
                      {shiftLabel(r.shift)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-ink-base">{r.zoneName}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-muted">{r.plannedDays}일</td>
                  <td className={`tnum px-3 py-2.5 text-right ${r.absentDays ? 'font-semibold text-critical' : 'text-ink-faint'}`}>
                    {r.absentDays ? `${r.absentDays}일` : '—'}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold text-ink-base">{r.workedDays}일</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink-base">{won(r.payout)}원</td>
                  <td className="tnum px-3 py-2.5 text-right text-warn">− {won(r.withholding)}원</td>
                  <td className="tnum px-3 py-2.5 text-right font-bold text-ink-strong">{won(r.net)}원</td>
                  <td className={`tnum px-3 py-2.5 text-right ${r.goodsCost ? 'text-ink-base' : 'text-ink-faint'}`}>
                    {r.goodsCost ? `${won(r.goodsCost)}원` : '미지급'}
                  </td>
                  <td className="px-3 py-2.5">
                    {r.docsReady ? (
                      <span className="tnum text-caption text-ink-muted">
                        {r.bankName} {maskAccount(r.accountNo)}
                      </span>
                    ) : (
                      <span className="rounded-md bg-warn-soft px-2 py-0.5 text-caption font-semibold text-warn">서류 미비 · 지급 보류</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {detailRows.length === 0 && (
            <div className="p-8 text-center text-body text-ink-faint">해당 조건의 인력이 없습니다.</div>
          )}
          <div className="flex items-center justify-between gap-6 border-t border-line bg-neutral-50 px-3 py-3">
            <span className="text-label font-bold text-ink-strong">{detailRows.length}명 소계</span>
            <div className="flex items-center gap-6 text-label">
              <span className="text-ink-muted">
                일당 <b className="tnum text-ink-base">{won(detailRows.reduce((s, r) => s + r.payout, 0))}원</b>
              </span>
              <span className="text-ink-muted">
                원천징수 <b className="tnum text-warn">− {won(detailRows.reduce((s, r) => s + r.withholding, 0))}원</b>
              </span>
              <span className="text-ink-muted">
                실수령 <b className="tnum text-section text-primary-700">{won(detailRows.reduce((s, r) => s + r.net, 0))}원</b>
              </span>
            </div>
          </div>
          <p className="border-t border-line px-3 py-2.5 text-caption text-ink-faint">
            계획일 = 오전조 5일 · 오후조 4일 · 결근 {absentDaysTotal}일 반영. 일당은 실근무일 기준 일할 계산.
          </p>
        </div>
       </>
      )}
       </>
      )}
    </div>
  )
}
