import { useEffect } from 'react'
import { getAssignment, getDutyLog, getZones, getShiftSlots } from '../../../lib/services'
import { useLive, useNowMin } from '../../../lib/useLive'
import type { CheckState } from '../../../types'
import { Section } from '../../../components/layout'
import { StatusBadge, statusMeta } from '../../../components/ui'
import { fmtHM } from '../../../lib/clock'
import { toMin, fmtDur, workBreak } from '../../../lib/time'

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

export default function PersonDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const now = useNowMin()
  const data = useLive(async () => {
    const [asg, log, zones] = await Promise.all([getAssignment(id), getDutyLog(id), getZones()])
    return { asg, log, zones }
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

            {/* 본문 */}
            <div className="overflow-auto p-6">
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
                                {e.via && (
                                  <span className={`rounded px-1.5 py-0.5 text-caption font-semibold ${e.via === 'gps' ? 'bg-info-soft text-info' : 'bg-primary-50 text-primary-700'}`}>
                                    {e.via === 'gps' ? 'GPS' : '스캔'}
                                  </span>
                                )}
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
          </>
        )}
      </div>
    </div>
  )
}
