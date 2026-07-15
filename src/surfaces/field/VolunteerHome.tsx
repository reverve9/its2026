import { useState } from 'react'
import { getAssignment, getZone, checkIn, hourlyCheck, reportIssue, shiftSlotMins, shiftLabel } from '../../lib/services'
import { useLive, useNowMin } from '../../lib/useLive'
import { getNowMin, fmtHM } from '../../lib/clock'
import { checkGeofence } from '../../lib/geo'
import { toMin, fmtDur } from '../../lib/time'
import { StatusBadge } from '../../components/ui'
import { NoticeCard } from './NoticeCard'
import { QrCode } from '../../components/QrCode'
import { EMERGENCY_CONTACTS, SHUTTLE_INFO } from '../../lib/info'
import { getEducation, educationRecord } from '../../lib/services'
import type { FieldSession } from '../../lib/session'
import logoW from '../../assets/logo-its-w.png'
import bgHeader from '../../assets/bg-field-header.jpg'

const telHref = (p: string) => `tel:${p.replace(/-/g, '')}`

type GpsState = { status: 'idle' | 'locating' | 'done' | 'error'; msg?: string }

export default function VolunteerHome({ session, onLogout }: { session: FieldSession; onLogout: () => void }) {
  const now = useNowMin()
  const a = useLive(() => getAssignment(session.assignmentId), [session.assignmentId])
  // 교육 이수 — 읽기 전용. 이수 처리는 운영본부의 일괄 인증뿐이라 여기엔 버튼이 없다.
  const education = useLive(
    () => (a ? getEducation(a.personId) : Promise.resolve([])),
    [a?.personId]
  )
  const zone = useLive(() => (a?.zoneId ? getZone(a.zoneId) : Promise.resolve(undefined)), [a?.zoneId])
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })
  const [sosSent, setSosSent] = useState(false)

  if (!a) return <div className="grid h-full place-items-center text-label text-ink-muted">불러오는 중…</div>

  const checkedIn = !!a.checkedInAt
  const isGpsZone = zone?.checkMode === 'self_gps'
  const workedMin = a.checkedInAt ? (a.checkedOutAt ? toMin(a.checkedOutAt) : now) - toMin(a.checkedInAt) : 0

  // 현재 정시(1h) 슬롯 — 조 슬롯 중 지난 마지막.
  const slots = shiftSlotMins(a.shift)
  const dueIdx = slots.reduce((acc, s, i) => (s <= now ? i : acc), -1)
  const currentSlot = dueIdx >= 0 ? slots[dueIdx] : null
  const slotDone = dueIdx >= 0 && (a.checks[dueIdx] === 'ok' || a.checks[dueIdx] === 'break')

  const doGpsCheckIn = () => {
    if (!('geolocation' in navigator)) {
      setGps({ status: 'error', msg: '이 기기는 위치 확인을 지원하지 않습니다.' })
      return
    }
    setGps({ status: 'locating', msg: '위치 확인 중…' })
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        const g = zone ? checkGeofence(here, zone.coords, zone.geofenceRadius) : { within: true, distance: 0, anomaly: undefined }
        await checkIn(a.id, {
          method: 'GPS', gps: here, ts: getNowMin(),
          idempotencyKey: `field:${a.id}:checkin:${a.date}:${a.shift}`, anomaly: g.anomaly,
        })
        setGps({ status: 'done', msg: g.within ? `거점 반경 내 확인 (${g.distance}m)` : g.anomaly })
      },
      (err) => setGps({
        status: 'error',
        msg: err.code === err.PERMISSION_DENIED ? '위치 권한이 거부되었습니다. 브라우저 권한을 허용해 주세요.' : '위치를 가져오지 못했습니다. 다시 시도해 주세요.',
      }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const doHourly = async () => {
    if (currentSlot === null) return
    await hourlyCheck(a.id, {
      slot: currentSlot, ts: getNowMin(),
      idempotencyKey: `field:${a.id}:hourly:${a.date}:${currentSlot}`,
    })
  }

  const doSos = async () => {
    if (!a.zoneId) return
    await reportIssue({
      type: '안전사고', zoneId: a.zoneId, note: `[SOS] ${a.personName} 긴급 지원요청`,
      ts: getNowMin(), idempotencyKey: `field:${a.id}:sos:${getNowMin()}`,
    })
    setSosSent(true)
  }

  const eduRec = educationRecord(education ?? [], '사전 통합교육')

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 — 로고 브랜드바 */}
      <header
        className="flex items-center justify-between bg-primary-900 bg-cover bg-center px-5 pb-4 pt-6"
        style={{ backgroundImage: `url(${bgHeader})` }}
      >
        <img src={logoW} alt="강릉 ITS 세계총회 2026" className="h-14 w-auto" />
        <button onClick={onLogout} className="rounded-lg bg-white/10 px-2.5 py-1 text-caption font-semibold text-white/90 transition hover:bg-white/20">
          로그아웃
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-auto bg-page p-4">
        {/* 사용자 헤딩 */}
        <div>
          <div className="font-title text-title font-semibold leading-tight text-ink-strong">{a.personName}</div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-label text-ink-muted">{shiftLabel(a.shift)} · {zone?.name ?? '—'}</span>
            {eduRec ? (
              <span className="rounded-md bg-ok-soft px-1.5 py-0.5 text-caption font-semibold text-ok">교육 이수</span>
            ) : (
              <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-caption font-semibold text-warn">교육 미이수</span>
            )}
          </div>
        </div>
        {/* 근무 카드 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-label font-semibold text-ink-muted">오늘 내 근무</span>
            <StatusBadge status={a.status} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-page py-2">
              <div className="text-caption text-ink-faint">체크인</div>
              <div className="tnum mt-0.5 text-body font-bold text-ink-strong">{a.checkedInAt ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-page py-2">
              <div className="text-caption text-ink-faint">누적 활동</div>
              <div className="tnum mt-0.5 text-body font-bold text-primary-600">{checkedIn ? fmtDur(workedMin) : '—'}</div>
            </div>
            <div className="rounded-lg bg-page py-2">
              <div className="text-caption text-ink-faint">현재</div>
              <div className="tnum mt-0.5 text-body font-bold text-ink-strong">{fmtHM(now)}</div>
            </div>
          </div>

          {/* 교육 이수 — 읽기 전용(버튼 없음). 이수 처리는 운영본부 일괄 인증뿐. */}
          <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3">
            <span className="text-label text-ink-muted">사전 통합교육</span>
            {eduRec ? (
              <span className="text-label font-semibold text-ok">이수 완료 · {eduRec.certifiedAt.slice(5, 10).replace('-', '월 ')}일</span>
            ) : (
              <span className="text-label font-semibold text-warn">미이수 — 운영본부 문의</span>
            )}
          </div>
        </div>

        {/* 체크인 */}
        {!checkedIn ? (
          isGpsZone ? (
            <div className="card p-4">
              <div className="text-label font-semibold text-ink-strong">GPS 원버튼 체크인</div>
              <p className="mt-1 text-caption text-ink-muted">무인 거점 — 거점 반경 안에서 버튼을 누르면 위치로 출근 확인됩니다.</p>
              <button
                onClick={doGpsCheckIn}
                disabled={gps.status === 'locating'}
                className="mt-3 w-full rounded-xl bg-primary-600 py-4 text-body font-bold text-white transition hover:bg-primary-700 disabled:opacity-50"
              >
                {gps.status === 'locating' ? '위치 확인 중…' : '📍 GPS 체크인'}
              </button>
              {gps.msg && (
                <p className={`mt-2 text-caption ${gps.status === 'error' ? 'text-critical' : 'text-ok'}`}>{gps.msg}</p>
              )}
            </div>
          ) : (
            <div className="card p-4">
              <div className="text-label font-semibold text-ink-strong">QR 체크인 (유인 거점)</div>
              <p className="mt-1 text-caption text-ink-muted">행사장 거점 — 거점관리자에게 아래 코드를 제시하면 스캔으로 출근 확인됩니다.</p>
              <div className="mt-3 grid place-items-center rounded-xl border border-line bg-white py-6">
                <QrCode value={a.id} size={176} />
                <div className="tnum mt-2 text-caption text-ink-muted">{a.id}</div>
              </div>
            </div>
          )
        ) : (
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-label font-semibold text-ink-strong">정시(1h) 체크</span>
              <span className="text-caption text-ink-muted">{shiftLabel(a.shift)} · {fmtHM(now)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {slots.map((s, i) => {
                const st = a.checks[i]
                const cls = !st ? 'bg-neutral-50 text-ink-faint ring-1 ring-inset ring-line'
                  : st === 'ok' ? 'bg-ok-soft text-ok' : st === 'break' ? 'bg-warn-soft text-warn'
                  : st === 'missed' ? 'bg-critical-soft text-critical' : 'bg-neutral-100 text-ink-faint'
                return (
                  <div key={s} className="flex flex-col items-center gap-1">
                    <span className="tnum text-caption text-ink-muted">{fmtHM(s)}</span>
                    <span className={`rounded-md px-2.5 py-1 text-caption font-semibold ${cls}`}>
                      {!st ? '예정' : st === 'ok' ? '완료' : st === 'break' ? '휴게' : st === 'missed' ? '누락' : '—'}
                    </span>
                  </div>
                )
              })}
            </div>
            <button
              onClick={doHourly}
              disabled={currentSlot === null || slotDone}
              className="mt-3 w-full rounded-xl bg-primary-600 py-3.5 text-body font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              {currentSlot === null ? '체크 시간대 아님' : slotDone ? `${fmtHM(currentSlot)} 체크 완료` : `${fmtHM(currentSlot)} 정시 체크하기`}
            </button>
          </div>
        )}

        {/* 본부 공지 — 체크인 액션 아래, 참고정보 위. 지시는 안내보다 먼저 읽어야 한다. */}
        <NoticeCard assignmentId={a.id} />

        {/* 거점 안내 */}
        <div className="card p-4">
          <div className="text-label font-semibold text-ink-strong">거점 안내</div>
          <div className="mt-1 text-caption text-ink-muted">운영시간 {zone?.opWindow.start}–{zone?.opWindow.end}</div>
          <div className="mt-3 space-y-1">
            {SHUTTLE_INFO.lines.map((l, i) => (
              <div key={i} className="text-caption leading-snug text-ink-base">· {l}</div>
            ))}
          </div>
        </div>

        {/* 비상연락망 */}
        <div className="card p-4">
          <div className="text-label font-semibold text-ink-strong">비상연락망</div>
          <div className="mt-2 divide-y divide-line-soft">
            {EMERGENCY_CONTACTS.map((c) => (
              <a key={c.phone} href={telHref(c.phone)} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="text-label font-semibold text-ink-strong">{c.label}</div>
                  {c.note && <div className="text-caption text-ink-muted">{c.note}</div>}
                </div>
                <span className="tnum shrink-0 rounded-lg bg-primary-50 px-2.5 py-1 text-caption font-semibold text-primary-700">{c.phone}</span>
              </a>
            ))}
          </div>
        </div>

        {/* SOS */}
        <div className="card p-4">
          <div className="text-label font-semibold text-ink-strong">긴급</div>
          {sosSent ? (
            <div className="mt-3 rounded-xl bg-critical-soft px-3 py-2.5 text-label font-semibold text-critical">
              SOS 전송됨 — 운영본부가 확인 중입니다.
            </div>
          ) : (
            <button
              onClick={doSos}
              className="mt-3 w-full rounded-xl border-2 border-critical bg-critical-soft py-3 text-body font-bold text-critical transition hover:bg-critical/10"
            >
              🆘 SOS 긴급 지원요청
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
