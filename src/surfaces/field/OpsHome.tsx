import { lazy, Suspense, useState } from 'react'
import { getAssignment, getZone, getZones, getAssignments, getActiveShift, reportIssue, checkIn, getPatrolCandidates, recordPatrolAudit, shiftLabel } from '../../lib/services'
import { useLive, useNowMin } from '../../lib/useLive'
import { NoticeCard } from './NoticeCard'
import { getNowMin, fmtHM } from '../../lib/clock'
import { StatusBadge, Fill } from '../../components/ui'
import type { FieldSession } from '../../lib/session'
import type { Assignment, IssueType } from '../../types'
import logoW from '../../assets/logo-its-w.png'
import bgHeader from '../../assets/bg-field-header.jpg'

// QR 스캐너(html5-qrcode ~400KB)는 열 때만 로드 — 메인 번들 경량 유지.
const QrScanner = lazy(() => import('../../components/QrScanner'))

const ISSUE_TYPES: IssueType[] = ['민원', '시설이상', '분실물', '미아', '안전사고']

// 운영인력 현장앱 — 거점관리자 + 현장인력 공용.
//
// role 로 화면을 가르지 않는다. zoneId 유무가 카드를 가른다:
//   공통(전원)      본부 공지 · 이슈 보고
//   zoneId 있으면 + 거점 헤딩 · 거점 현황 · 내 거점 인력 · 스캔/순회
//
// 그래서 '거점관리자 + 현장인력 겸직'이나 '거점 없는 슈퍼어드민' 같은 경우에 특례가 없다 —
// 거점이 있으면 거점 카드가 뜨고 없으면 안 뜬다. role 로 갈랐으면 겸직마다 분기가 늘어난다.
export default function OpsHome({ session, onLogout }: { session: FieldSession; onLogout: () => void }) {
  const now = useNowMin()
  const me = useLive(() => getAssignment(session.assignmentId), [session.assignmentId])
  const zone = useLive(() => (me?.zoneId ? getZone(me.zoneId) : Promise.resolve(undefined)), [me?.zoneId])
  const all = useLive(getAssignments) ?? []
  const zones = useLive(getZones) ?? []
  const activeShift = useLive(getActiveShift) ?? 'AM'
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? '—'

  const [itype, setItype] = useState<IssueType>('시설이상')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [patrol, setPatrol] = useState<{ target: Assignment; done?: 'ok' | 'mismatch' } | null>(null)

  const openPatrol = async () => {
    const cands = await getPatrolCandidates()
    if (!cands.length) { setScanResult({ ok: false, msg: '순회 대상(무인 거점 근무자)이 없습니다' }); return }
    // 랜덤 1인 추출 — 셀프체크 무결성 확인
    const pick = cands[Math.floor(Math.random() * cands.length)]
    setPatrol({ target: pick })
  }
  const doAudit = async (result: 'ok' | 'mismatch') => {
    if (!patrol) return
    await recordPatrolAudit(patrol.target.id, {
      result, ts: getNowMin(), idempotencyKey: `field:${session.assignmentId}:patrol:${patrol.target.id}:${getNowMin()}`,
    })
    setPatrol({ ...patrol, done: result })
  }

  const onDecode = async (text: string) => {
    setScanning(false)
    const target = await getAssignment(text.trim())
    if (!target) {
      setScanResult({ ok: false, msg: `등록되지 않은 코드: ${text}` })
      return
    }
    await checkIn(target.id, {
      method: 'QR', ts: getNowMin(),
      idempotencyKey: `field:${target.id}:checkin:${target.date}:${target.shift}`,
    })
    setScanResult({ ok: true, msg: `${target.personName} 출근 확인 (${shiftLabel(target.shift)})` })
  }

  // zone 을 가드에 넣지 않는다 — 거점 없는 운영인력(현장인력·슈퍼어드민)이 무한 로딩에 걸린다.
  if (!me) return <div className="grid h-full place-items-center text-label text-ink-muted">불러오는 중…</div>

  // 거점관리자가 출결을 관리하는 대상은 자원봉사자다 — 관리자 자신(운영인력)을 넣으면
  // 목록이 9명인데 거점 현황은 8/8(봉사자 정원)로 어긋난다.
  //
  // 기준은 me.shift 가 아니라 '지금 도는 조'다. 관리자는 전일 상주라 자기 조가 없고(shift 는
  // 스키마 필수 필드일 뿐), me.shift 로 거르면 오후에도 오전조 명단이 떠서 거점 현황(활성 조 기준)과
  // 어긋난다. 거점 현황 8/8 과 같은 모수를 봐야 한다.
  const crew = zone
    ? all.filter((a) => a.zoneId === zone.id && a.shift === activeShift && !a.isReserve && a.kind === '자원봉사자')
    : []
  const absent = crew.filter((a) => a.status === 'absent')
  const missed = crew.filter((a) => a.checks.some((c) => c === 'missed'))
  const gap = zone ? zone.present < zone.quota : false

  const submitIssue = async () => {
    if (!note.trim() || !zone) return
    await reportIssue({
      type: itype, zoneId: zone.id, note: note.trim(),
      ts: getNowMin(), idempotencyKey: `field:${me.id}:issue:${getNowMin()}`,
    })
    setNote('')
    setSent(true)
  }

  return (
    <div className="flex h-full flex-col">
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
        {/* 헤딩 — 거점이 있으면 거점명, 없으면 운영본부 소속임을 밝힌다 */}
        <div>
          <div className="font-title text-title font-semibold leading-tight text-ink-strong">{zone?.name ?? '운영본부'}</div>
          {/* 운영인력은 전일 상주라 자기 조가 없다 — 거점이 있으면 지금 관장 중인 조를 보여준다. */}
          <div className="mt-0.5 text-label text-ink-muted">
            {me.personName} · {me.role}
            {zone && ` · ${shiftLabel(activeShift)} 관장`}
          </div>
        </div>

        {/* ↓ 거점 카드 — zoneId 있을 때만. 거점 없는 운영인력에겐 관장할 거점이 없다. */}
        {zone && (
          <>
        {/* 내 거점 현황 */}
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-label font-semibold text-ink-strong">내 거점 현황</span>
            <span className="tnum text-caption text-ink-muted">{fmtHM(now)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Fill present={zone.present} quota={zone.quota} />
            {gap ? (
              <span className="rounded-md bg-critical-soft px-2 py-0.5 text-caption font-semibold text-critical">근무공백</span>
            ) : (
              <span className="rounded-md bg-ok-soft px-2 py-0.5 text-caption font-semibold text-ok">정상</span>
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-page py-2">
              <div className="text-caption text-ink-faint">근무</div>
              <div className="tnum mt-0.5 text-body font-bold text-ink-strong">{zone.present}</div>
            </div>
            <div className="rounded-lg bg-page py-2">
              <div className="text-caption text-ink-faint">미출근</div>
              <div className="tnum mt-0.5 text-body font-bold text-critical">{absent.length}</div>
            </div>
            <div className="rounded-lg bg-page py-2">
              <div className="text-caption text-ink-faint">정시 미이행</div>
              <div className="tnum mt-0.5 text-body font-bold text-warn">{missed.length}</div>
            </div>
          </div>
        </div>
          </>
        )}

        {/* 본부 공지 — 공통. 거점 유무와 무관하게 전원이 받는다.
            거점 현황 아래·액션 위: 지시가 아래 액션(순회·스캔)을 바꿀 수 있다. */}
        <NoticeCard assignmentId={me.id} />

        {zone && (
          <>
        {/* 내 거점 인력 */}
        <div className="card p-4">
          <div className="mb-2 text-label font-semibold text-ink-strong">내 거점 인력 ({crew.length})</div>
          <div className="divide-y divide-line-soft">
            {crew.map((a) => (
              <div key={a.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-label font-semibold text-ink-strong">{a.personName}</span>
                {a.checks.some((c) => c === 'missed') && (
                  <span className="rounded bg-critical-soft px-1.5 py-0.5 text-caption font-semibold text-critical">정시누락</span>
                )}
                <a href={`tel:${a.phone.replace(/-/g, '')}`} onClick={(e) => e.stopPropagation()} className="tnum text-caption text-primary-700 hover:underline">{a.phone}</a>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>

        {/* 액션 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setScanResult(null); setScanning(true) }}
            className="rounded-xl bg-primary-600 py-3 text-label font-semibold text-white transition hover:bg-primary-700"
          >
            📷 QR 스캔<div className="text-caption font-normal text-primary-100">봉사자 출결</div>
          </button>
          <button
            onClick={openPatrol}
            className="rounded-xl border border-primary-200 bg-primary-50 py-3 text-label font-semibold text-primary-700 transition hover:bg-primary-100"
          >
            🔍 순회 감사<div className="text-caption font-normal text-primary-600/70">무인 거점 랜덤 대조</div>
          </button>
        </div>
        {scanResult && (
          <div className={`rounded-xl px-3 py-2.5 text-label font-semibold ${scanResult.ok ? 'bg-ok-soft text-ok' : 'bg-critical-soft text-critical'}`}>
            {scanResult.ok ? '✓ ' : '✕ '}{scanResult.msg}
          </div>
        )}

        {/* 이슈 보고 — 원래는 공통 카드여야 하지만 Issue.zoneId 가 string(필수)이라
            거점 없는 운영인력은 구조적으로 올릴 수 없다. 타입을 nullable 로 넓히는 건
            이슈 큐·일일보고의 zoneName 조회까지 건드려서 다음 단계로 뺐다. */}
        <div className="card p-4">
          <div className="text-label font-semibold text-ink-strong">이슈 보고</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ISSUE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setItype(t)}
                className={`rounded-full px-2.5 py-1 text-caption font-semibold transition ${itype === t ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-ink-muted'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => { setNote(e.target.value); setSent(false) }}
            placeholder="내용을 입력하세요"
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-page px-3 py-2 text-label text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-primary-400"
          />
          <button
            onClick={submitIssue}
            disabled={!note.trim()}
            className="mt-2 w-full rounded-xl bg-primary-600 py-3 text-body font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
          >
            운영본부로 접수
          </button>
          {sent && <p className="mt-2 text-caption text-ok">접수됨 — 운영본부 대장에 반영되었습니다.</p>}
        </div>
          </>
        )}

        {/* 거점 없는 운영인력은 아직 공지만 받는다. QR 스캐너(서명)와 이슈 보고가
            붙으면 이 화면이 채워진다 — 지금은 그 사실을 숨기지 않고 그대로 둔다. */}
        {!zone && (
          <p className="text-caption leading-snug text-ink-muted">
            거점 배치가 없어 거점 관제 카드는 표시되지 않습니다. 본부 공지는 위에서 확인하십시오.
          </p>
        )}
      </div>

      {scanning && (
        <Suspense fallback={<div className="fixed inset-0 z-[70] grid place-items-center bg-ink-strong/95 text-white">카메라 준비 중…</div>}>
          <QrScanner onDecode={onDecode} onClose={() => setScanning(false)} />
        </Suspense>
      )}

      {/* 순회 랜덤감사 모달 */}
      {patrol && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-strong/50 p-4" onClick={() => setPatrol(null)}>
          <div className="w-full max-w-[420px] rounded-2xl bg-surface p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="font-title text-body font-semibold text-ink-strong">순회 랜덤감사</span>
              <button onClick={() => setPatrol(null)} className="text-ink-muted" aria-label="닫기">✕</button>
            </div>
            <p className="mt-1 text-caption text-ink-muted">무인 거점 셀프체크 무결성 — 랜덤 대상 현장 대조</p>

            <div className="mt-3 rounded-xl border border-line bg-page p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-title font-medium text-ink-strong">{patrol.target.personName}</span>
                <StatusBadge status={patrol.target.status} />
              </div>
              <div className="mt-1 text-label text-ink-muted">{zoneName(patrol.target.zoneId)} · {shiftLabel(patrol.target.shift)}</div>
              <div className="mt-2 flex gap-4 text-caption text-ink-muted">
                <span>체크인 <b className="tnum text-ink-strong">{patrol.target.checkedInAt ?? '—'}</b></span>
                <span>정시체크 <b className="tnum text-ink-strong">{patrol.target.checks.filter((c) => c === 'ok').length}/{patrol.target.checks.length}</b></span>
                <a href={`tel:${patrol.target.phone.replace(/-/g, '')}`} className="ml-auto text-primary-700">{patrol.target.phone}</a>
              </div>
            </div>

            {patrol.done ? (
              <div className={`mt-3 rounded-xl px-3 py-2.5 text-label font-semibold ${patrol.done === 'ok' ? 'bg-ok-soft text-ok' : 'bg-critical-soft text-critical'}`}>
                {patrol.done === 'ok' ? '✓ 정위치 확인 — 감사 기록됨' : '⚠ 불일치 보고 — 운영본부 이슈 접수됨'}
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => doAudit('ok')} className="rounded-xl bg-primary-600 py-3 text-label font-semibold text-white transition hover:bg-primary-700">정위치 확인</button>
                <button onClick={() => doAudit('mismatch')} className="rounded-xl border-2 border-critical bg-critical-soft py-3 text-label font-semibold text-critical transition hover:bg-critical/10">불일치 보고</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
