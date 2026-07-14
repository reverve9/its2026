import { useState } from 'react'
import { getAssignment, getZone, getAssignments, reportIssue, shiftLabel } from '../../lib/services'
import { useLive, useNowMin } from '../../lib/useLive'
import { getNowMin, fmtHM } from '../../lib/clock'
import { StatusBadge, Fill } from '../../components/ui'
import type { FieldSession } from '../../lib/session'
import type { IssueType } from '../../types'

const ISSUE_TYPES: IssueType[] = ['민원', '시설이상', '분실물', '미아', '안전사고']

export default function ManagerHome({ session, onLogout }: { session: FieldSession; onLogout: () => void }) {
  const now = useNowMin()
  const me = useLive(() => getAssignment(session.assignmentId), [session.assignmentId])
  const zone = useLive(() => (me?.zoneId ? getZone(me.zoneId) : Promise.resolve(undefined)), [me?.zoneId])
  const all = useLive(getAssignments) ?? []

  const [itype, setItype] = useState<IssueType>('시설이상')
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)

  if (!me || !zone) return <div className="grid h-full place-items-center text-label text-ink-muted">불러오는 중…</div>

  const crew = all.filter((a) => a.zoneId === zone.id && a.shift === me.shift && !a.isReserve)
  const absent = crew.filter((a) => a.status === 'absent')
  const missed = crew.filter((a) => a.checks.some((c) => c === 'missed'))
  const gap = zone.present < zone.quota

  const submitIssue = async () => {
    if (!note.trim()) return
    await reportIssue({
      type: itype, zoneId: zone.id, note: note.trim(),
      ts: getNowMin(), idempotencyKey: `field:${me.id}:issue:${getNowMin()}`,
    })
    setNote('')
    setSent(true)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-primary-700 px-5 pb-4 pt-8 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="font-latin text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-200/70">ITS 2026 · Field · Manager</div>
            <div className="mt-1 font-title text-title font-medium leading-tight">{zone.name}</div>
            <div className="mt-0.5 text-label text-primary-200/80">{me.personName} · {shiftLabel(me.shift)} 거점관리자</div>
          </div>
          <button onClick={onLogout} className="rounded-lg bg-white/10 px-2.5 py-1 text-caption font-semibold text-white/90 transition hover:bg-white/20">
            로그아웃
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-auto bg-page p-4">
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
          <button disabled className="rounded-xl border border-line bg-neutral-50 py-3 text-label font-semibold text-ink-faint">
            📷 QR 스캔<div className="text-caption font-normal">다음 단계</div>
          </button>
          <button disabled className="rounded-xl border border-line bg-neutral-50 py-3 text-label font-semibold text-ink-faint">
            🔍 순회 감사<div className="text-caption font-normal">다음 단계</div>
          </button>
        </div>

        {/* 이슈 보고 */}
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
      </div>
    </div>
  )
}
