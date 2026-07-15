import { lazy, Suspense, useState } from 'react'
import { getAssignment, getFieldIdentity, getZone, getZones, getAssignments, getActiveShift, reportIssue, recordScan, shiftLabel } from '../../lib/services'
import { useLive, useNowMin } from '../../lib/useLive'
import { NoticeCard } from './NoticeCard'
import { getNowMin, fmtHM } from '../../lib/clock'
import { StatusBadge, Fill } from '../../components/ui'
import type { FieldSession } from '../../lib/session'
import { roleLabel } from '../../lib/roleLabel'
import type { Coords } from '../../types'
import type { IssueType, ScanKind } from '../../types'
import logoW from '../../assets/logo-its-w.png'
import bgHeader from '../../assets/bg-field-header.jpg'

// QR 스캐너(html5-qrcode ~400KB)는 열 때만 로드 — 메인 번들 경량 유지.
const QrScanner = lazy(() => import('../../components/QrScanner'))

const ISSUE_TYPES: IssueType[] = ['민원', '시설이상', '분실물', '미아', '안전사고']

// 스캔 종류 — QR 은 서명이다. 넷 다 같은 문장이다: "이 사람이, 이 시각에, 여기서, 이걸 받았다".
const SCAN_KINDS: ScanKind[] = ['대면확인', '현장물품수령', '활동물품수령', '지시인수']

// 운영인력 현장앱 — 거점관리자 + 현장인력 공용.
//
// role 로 화면을 가르지 않는다. zoneId 유무가 카드를 가른다:
//   공통(전원)      본부 공지 · QR 스캐너 · 이슈 보고
//   zoneId 있으면 + 거점 헤딩 · 거점 현황 · 내 거점 인력
//
// 게이트 안에 남은 둘은 진짜 거점 사실이다(present/quota · 그 거점의 조 명단).
// 공지·스캔·이슈는 거점 사실이 아니라 누구에게나 필요하다.
//
// QR 스캐너가 거점 게이트 '밖'에 있는 이유: 스캔은 거점 기반이 아니다. 어디서 찍든 되고,
// 거점 없는 현장운영 11명도 찍는다 — 게이트 안에 뒀으면 그들이 구조적으로 못 찍었다.
//
// 그래서 '거점관리자 + 현장인력 겸직'이나 '거점 없는 슈퍼어드민' 같은 경우에 특례가 없다 —
// 거점이 있으면 거점 카드가 뜨고 없으면 안 뜬다. role 로 갈랐으면 겸직마다 분기가 늘어난다.
export default function OpsHome({ session, onLogout }: { session: FieldSession; onLogout: () => void }) {
  const now = useNowMin()
  // 배치(getAssignment)가 아니라 신원(getFieldIdentity)을 본다 — 슈퍼어드민은 배치가 없어
  // getAssignment 로는 undefined 가 나오고 아래 !me 가드에서 무한 로딩에 걸린다.
  const me = useLive(() => getFieldIdentity(session.assignmentId), [session.assignmentId])
  const zone = useLive(() => (me?.zoneId ? getZone(me.zoneId) : Promise.resolve(undefined)), [me?.zoneId])
  const all = useLive(getAssignments) ?? []
  const zones = useLive(getZones) ?? []
  const activeShift = useLive(getActiveShift) ?? 'AM'
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? '—'

  const [itype, setItype] = useState<IssueType>('시설이상')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ ok: boolean; msg: string; sub?: string } | null>(null)
  const [scanKind, setScanKind] = useState<ScanKind>('대면확인')
  const [scanNote, setScanNote] = useState('')

  // 찍는 사람의 위치. 대면이므로 이 하나로 양쪽이 증명된다. 최선노력이다 —
  // 권한 거부·미지원이어도 스캔은 진행한다(지오펜스는 게이트가 아니라 기록이다).
  const here = (): Promise<Coords | undefined> =>
    new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve(undefined)
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(undefined),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      )
    })

  const onDecode = async (text: string) => {
    setScanning(false)
    const target = await getAssignment(text.trim())
    if (!target) {
      setScanResult({ ok: false, msg: `등록되지 않은 코드: ${text}` })
      return
    }
    const ts = getNowMin()
    const gps = await here()
    // ⚠️ 출결이 아니다. 이 호출은 서명만 남기고 target 의 근태는 건드리지 않는다.
    const ok = await recordScan({
      subjectId: target.id, scannerId: me?.assignmentId ?? null, kind: scanKind,
      note: scanNote, gps, ts,
      idempotencyKey: `field:${session.assignmentId}:scan:${target.id}:${scanKind}:${ts}`,
    })
    if (!ok) {
      setScanResult({ ok: false, msg: `${target.personName} — 이미 같은 서명이 있습니다 (${scanKind})` })
      return
    }
    setScanResult({
      ok: true,
      msg: `${target.personName} · ${scanKind} 서명됨`,
      sub: [zoneName(target.zoneId), fmtHM(ts), scanNote.trim()].filter(Boolean).join(' · '),
    })
    setScanNote('')
  }

  // zone 을 가드에 넣지 않는다 — 거점 없는 운영인력(현장운영·슈퍼어드민)이 무한 로딩에 걸린다.
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
    if (!note.trim()) return
    // 거점이 없으면 null = 운영본부. 이전엔 !zone 이면 아예 못 올렸다.
    await reportIssue({
      type: itype, zoneId: zone?.id ?? null, note: note.trim(),
      ts: getNowMin(), idempotencyKey: `field:${session.assignmentId ?? 'super'}:issue:${getNowMin()}`,
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
            {me.personName} · {roleLabel(me.role)}
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
        <NoticeCard assignmentId={me.assignmentId} />

        {/* QR 스캐너 — 공통. 거점 유무와 무관하다(거점 기반이 아니다).
            ⚠️ 출결 수단이 아니다. 봉사자의 QR 은 신분증이고 이건 서명을 받는 도구다:
            "이 사람이, 이 시각에, 여기서, 이걸 받았다". 찍어도 출결은 움직이지 않는다.
            옛 [순회 감사] 버튼(랜덤 추출 → [일치]/[불일치] 클릭)이 여기에 흡수됐다 —
            그건 자리에 앉아서도 통과하는 가짜 대면이었다. 이제 그 앞에 가서 찍어야 한다. */}
        <div className="card p-4">
          <div className="text-label font-semibold text-ink-strong">QR 스캐너 (서명)</div>
          <p className="mt-1 text-caption text-ink-muted">
            봉사자의 QR을 찍어 수령·확인 서명을 남깁니다. 출근 체크와는 무관합니다.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {SCAN_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setScanKind(k)}
                className={`rounded-full px-2.5 py-1 text-caption font-semibold transition ${scanKind === k ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-ink-muted'}`}
              >
                {k}
              </button>
            ))}
          </div>
          {/* 세부내용 자유 텍스트 — 직무별 데이터 모델을 짓지 않는 이유가 이 한 칸이다.
              물품 관리든 본부 지원이든 같은 스캐너 + 다른 note. */}
          <input
            value={scanNote}
            onChange={(e) => setScanNote(e.target.value)}
            placeholder="세부내용"
            className="mt-2 w-full rounded-lg border border-line bg-page px-3 py-2 text-label text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-primary-400"
          />
          <button
            onClick={() => { setScanResult(null); setScanning(true) }}
            className="mt-2 w-full rounded-xl bg-primary-600 py-3.5 text-body font-bold text-white transition hover:bg-primary-700"
          >
            📷 QR 스캔
          </button>
          {scanResult && (
            <div className={`mt-2 rounded-xl px-3 py-2.5 ${scanResult.ok ? 'bg-ok-soft' : 'bg-critical-soft'}`}>
              <div className={`text-label font-semibold ${scanResult.ok ? 'text-ok' : 'text-critical'}`}>
                {scanResult.ok ? '✓ ' : '✕ '}{scanResult.msg}
              </div>
              {scanResult.sub && <div className="mt-0.5 text-caption text-ink-muted">{scanResult.sub}</div>}
            </div>
          )}
        </div>

        {/* 이슈 보고 — 공통. 이슈는 거점 사실이 아니다: 거점에서 나기도 하고 본부에서 나기도 한다.
            Issue.zoneId 가 string(필수)이던 시절엔 거점 없는 운영인력이 구조적으로 못 올려서
            이 카드가 거점 게이트 안에 갇혀 있었다. nullable(null = 운영본부)로 넓혀 꺼냈다. */}
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
            placeholder="내용"
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
          {sent && <p className="mt-2 text-caption text-ok">접수됨 — {zone ? zone.name : '운영본부'} 건으로 대장에 반영되었습니다.</p>}
        </div>

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

          </>
        )}

        {/* 거점 없는 운영인력(현장운영·슈퍼어드민)은 거점 관제 둘만 빠진다. */}
        {!zone && (
          <p className="text-caption leading-snug text-ink-muted">
            거점 배치가 없어 거점 현황·인력 카드는 표시되지 않습니다.
          </p>
        )}
      </div>

      {scanning && (
        <Suspense fallback={<div className="fixed inset-0 z-[70] grid place-items-center bg-ink-strong/95 text-white">카메라 준비 중…</div>}>
          <QrScanner onDecode={onDecode} onClose={() => setScanning(false)} />
        </Suspense>
      )}

    </div>
  )
}
