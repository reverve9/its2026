import { useEffect, useState } from 'react'
import {
  getAssignment, getDutyLog, getZones, getShiftSlots, issueGoods, setPayoutInfo, payoutReady,
  getEducation, educationRecord,
} from '../../../lib/services'
import { useLive, useNowMin } from '../../../lib/useLive'
import { EDUCATION_KINDS } from '../../../types'
import type { CheckState, GoodsIssue, PayoutInfo } from '../../../types'
import { Section } from '../../../components/layout'
import { StatusBadge, statusMeta } from '../../../components/ui'
import { fmtHM } from '../../../lib/clock'
import { toMin, fmtDur, workBreak } from '../../../lib/time'

// 개인 상세 — 인력 관리(실시간 관제)와 인력 현황(운영 대장)이 공유하는 단일 모달.
// 한 사람의 진실은 한 곳에 두고, 진입 맥락에 따라 기본 탭만 달리 연다.
//   · 근태(duty)    — 시간 종속: 정시체크·근퇴 타임라인 → 인력 관리에서 진입
//   · 명부·물품(profile) — 시간 비의존: 신상·배치·활동물품 → 인력 현황에서 진입
export type PersonTab = 'duty' | 'profile'

const telHref = (p: string) => `tel:${p.replace(/-/g, '')}`

const slotMeta: Record<CheckState, { label: string; cls: string }> = {
  ok: { label: '정상', cls: 'bg-ok-soft text-ok' },
  break: { label: '휴게', cls: 'bg-warn-soft text-warn' },
  missed: { label: '누락', cls: 'bg-critical-soft text-critical' },
  absent: { label: '미출근', cls: 'bg-neutral-100 text-ink-faint' },
}
const pendingMeta = { label: '예정', cls: 'bg-neutral-50 text-ink-faint ring-1 ring-inset ring-line' }

function InfoTile({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'primary' | 'critical' }) {
  const cls = tone === 'primary' ? 'text-primary-600' : tone === 'critical' ? 'text-critical' : 'text-ink-strong'
  return (
    <div className="rounded-xl border border-line bg-page p-3.5">
      <div className="text-label font-medium text-ink-muted">{label}</div>
      <div className={`tnum mt-1 text-section font-bold ${cls}`}>{value}</div>
    </div>
  )
}

// 명부·물품 탭 — 한 줄 정보 행.
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
      <span className="shrink-0 text-label text-ink-muted">{label}</span>
      <span className="min-w-0 text-right text-label font-medium text-ink-strong">{children}</span>
    </div>
  )
}

// 물품 지급 토글 — 목록과 같은 서비스(issueGoods)를 호출해 store 뮤테이트(R3).
function GoodsToggle({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
        on ? 'border-ok/30 bg-ok-soft' : 'border-line bg-page hover:border-primary-400'
      }`}
    >
      <div>
        <div className={`text-label font-semibold ${on ? 'text-ok' : 'text-ink-strong'}`}>{label}</div>
        <div className="mt-0.5 text-caption text-ink-muted">{on ? '지급 완료' : '미지급 — 클릭해 지급 처리'}</div>
      </div>
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-caption font-bold ${
          on ? 'bg-ok text-white' : 'bg-neutral-100 text-ink-faint ring-1 ring-inset ring-line'
        }`}
      >
        {on ? '✓' : '—'}
      </span>
    </button>
  )
}

export default function PersonDetailModal({
  id,
  tab: initialTab = 'duty',
  onClose,
}: {
  id: string
  tab?: PersonTab
  onClose: () => void
}) {
  const [tab, setTab] = useState<PersonTab>(initialTab)
  const now = useNowMin()
  const data = useLive(async () => {
    const [asg, log, zones] = await Promise.all([getAssignment(id), getDutyLog(id), getZones()])
    // 교육 이수는 배치가 아니라 사람(personId)에 귀속 — 배치를 먼저 찾아 personId 로 조회한다.
    const education = asg ? await getEducation(asg.personId) : []
    return { asg, log, zones, education }
  }, [id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const a = data?.asg
  const log = data?.log ?? []
  const zoneName = a?.isReserve ? '예비 · 미배정' : data?.zones.find((z) => z.id === a?.zoneId)?.name ?? '—'

  const absent = a?.status === 'absent'
  const endMin = a?.checkedOutAt ? toMin(a.checkedOutAt) : now
  const { work, brk } = workBreak(log, endMin)
  const slots = a ? getShiftSlots(a.shift) : []
  const okCount = a?.checks.filter((c) => c === 'ok').length ?? 0
  const dueCount = a?.checks.length ?? 0
  const missed = a?.checks.some((c) => c === 'missed') ?? false
  const shiftKo = a?.shift === 'AM' ? '오전조' : '오후조'
  const goods: GoodsIssue = a?.goods ?? { jacket: false, bag: false }
  const goodsCount = (goods.jacket ? 1 : 0) + (goods.bag ? 1 : 0)
  const goodsAll = goodsCount === 2
  const payout: PayoutInfo = a?.payout ?? { idCard: false, bankbook: false }
  const payDone = payoutReady(payout)
  const education = data?.education ?? []
  const eduDone = !!educationRecord(education, '사전 통합교육')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {!data || !a ? (
          <div className="grid h-40 place-items-center text-label text-ink-muted">불러오는 중…</div>
        ) : (
          <>
            {/* 헤더 */}
            <div className="flex items-start justify-between border-b border-line px-6 py-4">
              <div>
                <div className="font-title text-title font-medium text-ink-strong">{a.personName}</div>
                <div className="mt-0.5 text-label text-ink-muted">
                  {shiftKo} · {a.role} · {zoneName}
                  {a.isReserve ? ' · 투입 대기' : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                <a
                  href={telHref(a.phone)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-label font-semibold text-white transition hover:bg-primary-700"
                >
                  통화 <span className="tnum">{a.phone}</span>
                </a>
                <button
                  onClick={onClose}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-neutral-100 hover:text-ink-strong"
                  aria-label="닫기"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* 탭 — 근태(시간 종속) / 명부·물품(시간 비의존) */}
            <div className="flex gap-1 border-b border-line px-6 pt-3">
              {([
                { key: 'duty', label: '근태' },
                { key: 'profile', label: '명부·물품' },
              ] as const).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`-mb-px border-b-2 px-3 py-2 text-label font-semibold transition ${
                    tab === t.key
                      ? 'border-primary-600 text-primary-700'
                      : 'border-transparent text-ink-muted hover:text-ink-strong'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 본문 */}
            <div className={`overflow-auto p-6 ${tab === 'duty' ? '' : 'hidden'}`}>
              <div className="grid grid-cols-4 gap-3">
                <InfoTile label="누적 근무" value={absent ? '—' : fmtDur(work)} tone={absent ? 'default' : 'primary'} />
                <InfoTile label="누적 휴게" value={absent ? '—' : fmtDur(brk)} />
                <InfoTile label="체크인" value={a.checkedInAt ?? '미출근'} tone={absent ? 'critical' : 'default'} />
                <InfoTile label="외국어" value={a.lang?.join(' · ') ?? '없음'} />
              </div>

              {!a.isReserve && (
                <div className="mt-5">
                  <Section
                    title={`정시(1h) 체크 · ${shiftKo}`}
                    right={
                      <span className={`text-caption font-semibold ${missed ? 'text-critical' : 'text-ok'}`}>
                        {missed ? '확인 필요' : dueCount ? `정상 ${okCount}/${dueCount}` : '대기'}
                      </span>
                    }
                  >
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot, i) => {
                        const st = a.checks[i]
                        const m = st ? slotMeta[st] : pendingMeta
                        return (
                          <div key={slot} className="flex flex-col items-center gap-1">
                            <span className="tnum text-caption text-ink-muted">{slot}</span>
                            <span className={`rounded-md px-2.5 py-1 text-caption font-semibold ${m.cls}`}>{m.label}</span>
                          </div>
                        )
                      })}
                    </div>
                    {missed && (
                      <p className="mt-3 text-label text-critical">
                        ⚠ 정시 체크 누락 — 연락처로 즉시 확인 권고(차단 아님). 미확인 지속 시 예비인력 대체 검토.
                      </p>
                    )}
                  </Section>
                </div>
              )}

              <div className="mt-5">
                <Section title="오늘 근퇴 타임라인" right={<span className="text-caption text-ink-muted">기준 {fmtHM(now)}</span>}>
                  {absent ? (
                    <div className="py-6 text-center">
                      <div className="text-body font-semibold text-critical">미출근</div>
                      <p className="mt-1 text-label text-ink-muted">배정시간 {fmtHM(a.shift === 'AM' ? 600 : 840)} 경과 · 예비인력 대체 배치 권고</p>
                    </div>
                  ) : (
                    <ol className="relative ml-1">
                      {log.map((e, i) => {
                        const m = statusMeta[e.status]
                        const last = i === log.length - 1
                        return (
                          <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                            {!last && <span className="absolute left-[5px] top-4 h-full w-px bg-line" />}
                            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${m.dot} ring-2 ring-white`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-2">
                                <span className="tnum text-label font-bold text-ink-strong">{e.time}</span>
                                <span className="text-label text-ink-base">{e.label}</span>
                              </div>
                              {e.note && <div className="mt-0.5 text-caption text-ink-muted">{e.note}</div>}
                            </div>
                          </li>
                        )
                      })}
                      <li className="relative flex gap-3">
                        <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${a.status === 'off' ? 'bg-ink-faint' : 'animate-pulse bg-ok'} ring-2 ring-white`} />
                        <div className="flex items-baseline gap-2">
                          <span className="tnum text-label font-bold text-ink-muted">{fmtHM(now)}</span>
                          <span className="text-label text-ink-muted">
                            현재 — {statusMeta[a.status].label}{a.status === 'off' ? ' (오전조 근무 종료)' : ' 지속 중'}
                          </span>
                        </div>
                      </li>
                    </ol>
                  )}
                </Section>
              </div>
            </div>

            {/* 명부·물품 탭 — 시간 비의존 마스터. 스크러버를 밀어도 이 탭은 변하지 않는다. */}
            <div className={`overflow-auto p-6 ${tab === 'profile' ? '' : 'hidden'}`}>
              <Section title="명부">
                <div className="px-1">
                  <Row label="성명">{a.personName}</Row>
                  <Row label="연락처">
                    <a href={telHref(a.phone)} className="tnum text-primary-700 hover:underline">
                      {a.phone}
                    </a>
                  </Row>
                  <Row label="역할">{a.role}</Row>
                  <Row label="근무조">{shiftKo}</Row>
                  <Row label="배치 거점">{zoneName}{a.isReserve ? ' · 투입 대기' : ''}</Row>
                  <Row label="가능 외국어">{a.lang?.join(' · ') ?? '없음'}</Row>
                </div>
              </Section>

              {/* 교육 이수 — 읽기 전용. 처리는 인력 현황의 일괄 인증에서만. */}
              <div className="mt-5">
                <Section
                  title="교육 이수"
                  right={
                    <span className={`text-caption font-semibold ${eduDone ? 'text-ok' : 'text-warn'}`}>
                      {eduDone ? '사전 통합교육 이수' : '사전 통합교육 미이수'}
                    </span>
                  }
                >
                  <div className="space-y-2">
                    {EDUCATION_KINDS.map((kind) => {
                      const rec = educationRecord(education, kind)
                      return (
                        <div
                          key={kind}
                          className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 ${
                            rec ? 'border-ok/30 bg-ok-soft' : 'border-line bg-page'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className={`text-label font-semibold ${rec ? 'text-ok' : 'text-ink-strong'}`}>{kind}</div>
                            <div className="mt-0.5 text-caption text-ink-muted">
                              {rec ? `${rec.certifiedAt} · 인증 ${rec.certifiedBy}` : '미이수'}
                            </div>
                          </div>
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-caption font-bold ${
                              rec ? 'bg-ok text-white' : 'bg-neutral-100 text-ink-faint ring-1 ring-inset ring-line'
                            }`}
                          >
                            {rec ? '✓' : '—'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              </div>

              <div className="mt-5">
                <Section
                  title="활동물품 지급"
                  right={
                    <span className={`text-caption font-semibold ${goodsAll ? 'text-ok' : 'text-warn'}`}>
                      {goodsAll ? '지급 완료' : `미지급 ${2 - goodsCount}종`}
                    </span>
                  }
                >
                  <div className="grid grid-cols-2 gap-3">
                    <GoodsToggle
                      on={goods.jacket}
                      label="바람막이"
                      onToggle={() => issueGoods(a.id, { jacket: !goods.jacket })}
                    />
                    <GoodsToggle
                      on={goods.bag}
                      label="가방"
                      onToggle={() => issueGoods(a.id, { bag: !goods.bag })}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-caption text-ink-muted">
                    <span>지급일 {goods.issuedAt ?? '—'}</span>
                  </div>
                </Section>
              </div>

              {/* 정산 서류·지급계좌 — 실비는 행사 후 일괄 지급이므로 대장에서 사전 등록한다. */}
              <div className="mt-5">
                <Section
                  title="정산 서류·지급계좌"
                  right={
                    <span className={`text-caption font-semibold ${payDone ? 'text-ok' : 'text-warn'}`}>
                      {payDone ? '등록 완료' : '미비 — 지급 전 보완'}
                    </span>
                  }
                >
                  <div className="grid grid-cols-2 gap-3">
                    <GoodsToggle
                      on={payout.idCard}
                      label="신분증 사본"
                      onToggle={() => setPayoutInfo(a.id, { idCard: !payout.idCard })}
                    />
                    <GoodsToggle
                      on={payout.bankbook}
                      label="통장 사본"
                      onToggle={() => setPayoutInfo(a.id, { bankbook: !payout.bankbook })}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <label className="block">
                      <span className="text-caption font-medium text-ink-muted">은행</span>
                      <input
                        value={payout.bankName ?? ''}
                        onChange={(e) => setPayoutInfo(a.id, { bankName: e.target.value })}
                        placeholder="은행"
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-label text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-primary-400"
                      />
                    </label>
                    <label className="block">
                      <span className="text-caption font-medium text-ink-muted">계좌번호</span>
                      <input
                        value={payout.accountNo ?? ''}
                        onChange={(e) => setPayoutInfo(a.id, { accountNo: e.target.value })}
                        placeholder="숫자·하이픈"
                        className="tnum mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-label text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-primary-400"
                      />
                    </label>
                    <label className="block">
                      <span className="text-caption font-medium text-ink-muted">예금주</span>
                      <input
                        value={payout.holder ?? ''}
                        onChange={(e) => setPayoutInfo(a.id, { holder: e.target.value })}
                        placeholder="본인 명의"
                        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-label text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-primary-400"
                      />
                    </label>
                  </div>

                  {payout.holder && a.personName !== payout.holder && (
                    <p className="mt-3 text-label text-warn">⚠ 예금주({payout.holder})가 본인({a.personName})과 다릅니다 — 본인 명의 계좌 확인 필요.</p>
                  )}
                  <div className="mt-3 text-caption text-ink-muted">등록일 {payout.registeredAt ?? '—'}</div>
                </Section>
              </div>

              <p className="mt-4 text-caption text-ink-faint">개인정보 최소수집 · 행사 종료 후 즉시 파기</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
