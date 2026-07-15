import {
  getKpi, getAssignments, getZones, getIssues, getSafety,
  computeStaffingGaps, computeCheckCompliance, OPS_INFO,
} from '../../../lib/services'
import { useLive, useNowMin } from '../../../lib/useLive'
import { fmtHM } from '../../../lib/clock'

function Block({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-4">
      <h2 className="mb-2.5 flex items-center gap-2 text-section font-semibold text-ink-strong">
        <span className="grid h-5 w-5 place-items-center rounded bg-primary-600 text-caption font-bold text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default function Report() {
  const now = useNowMin()
  const kpi = useLive(getKpi)
  const assignments = useLive(getAssignments)
  const zones = useLive(getZones) ?? []
  const issues = useLive(getIssues) ?? []
  const safety = useLive(getSafety)
  const gaps = useLive(computeStaffingGaps) ?? []
  const compliance = useLive(computeCheckCompliance) ?? []

  if (!kpi || !assignments || !safety) return null

  const nonReserve = assignments.filter((a) => !a.isReserve)
  const shiftStat = (s: 'AM' | 'PM') => {
    const list = nonReserve.filter((a) => a.shift === s)
    const attended = list.filter((a) => a.checkedInAt).length
    return { assigned: list.length, attended, absent: list.length - attended }
  }
  const am = shiftStat('AM')
  const pm = shiftStat('PM')
  const issueBy = (st: string) => issues.filter((i) => i.status === st).length
  const hazardChecked = safety.hazards.filter((h) => h.checked).length

  return (
    <div>
      {/* 툴바 (인쇄 제외) */}
      <div className="no-print mb-4 flex items-center justify-between">
        <div className="text-body text-ink-muted">척추 데이터에서 자동 생성 — 운영본부 확인 후 인쇄·제출</div>
        <button onClick={() => window.print()} className="rounded-lg bg-primary-600 px-4 py-2 text-label font-semibold text-white transition hover:bg-primary-700">
          🖨 인쇄 · PDF 저장
        </button>
      </div>

      {/* 보고서 본문 */}
      <div className="print-area mx-auto max-w-3xl rounded-xl border border-line bg-surface p-8 shadow-sm">
        <div className="flex items-start justify-between border-b-2 border-primary-700 pb-4">
          <div>
            <h1 className="font-title text-title font-semibold text-ink-strong">일일 운영보고서</h1>
            <p className="mt-1 text-label text-ink-muted">{OPS_INFO.eventName}</p>
          </div>
          <div className="text-right text-label text-ink-muted">
            <div>운영일 {OPS_INFO.operationDate}</div>
            <div className="tnum">보고 기준 {fmtHM(now)}</div>
            <span className="mt-1 inline-block rounded bg-primary-50 px-2 py-0.5 text-caption font-semibold text-primary-700">자동 생성</span>
          </div>
        </div>

        <div className="space-y-5 pt-5">
          {/* 1. 운영 요약 */}
          <Block n={1} title="인력 운영 요약">
            <div className="grid grid-cols-4 gap-3">
              {[
                { l: '배치 인원', v: `${nonReserve.length}명`, s: '오전55·오후55' },
                { l: '오전조 출근', v: `${am.attended}/${am.assigned}`, s: `미출근 ${am.absent}` },
                { l: '오후조 출근', v: `${pm.attended}/${pm.assigned}`, s: `미출근 ${pm.absent}` },
                { l: '근무공백 대응', v: `${gaps.length}건`, s: `예비 가용 ${kpi.reserveAvailable}` },
              ].map((x) => (
                <div key={x.l} className="rounded-lg border border-line bg-page p-3">
                  <div className="text-caption text-ink-muted">{x.l}</div>
                  <div className="tnum mt-0.5 text-section font-bold text-ink-strong">{x.v}</div>
                  <div className="text-caption text-ink-faint">{x.s}</div>
                </div>
              ))}
            </div>
            {compliance.length > 0 && (
              <p className="mt-2 text-label text-ink-muted">· 정시(1h) 체크 미이행 {compliance.length}건 — 연락 확인 후 필요시 예비 대체.</p>
            )}
          </Block>

          {/* 2. 거점별 운영현황 */}
          <Block n={2} title="거점별 운영현황">
            <table className="w-full text-label">
              <thead>
                <tr className="border-b border-line text-caption text-ink-muted">
                  <th className="py-1.5 text-left font-semibold">거점</th>
                  <th className="py-1.5 text-left font-semibold">구분</th>
                  <th className="py-1.5 text-right font-semibold">정원</th>
                  <th className="py-1.5 text-right font-semibold">근무</th>
                  <th className="py-1.5 text-left font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className="border-b border-line-soft">
                    <td className="py-1.5 text-ink-strong">{z.name}</td>
                    <td className="py-1.5 text-ink-muted">{z.kind === 'venue' ? '행사장' : '관광지'}</td>
                    <td className="tnum py-1.5 text-right text-ink-base">{z.quota}</td>
                    <td className={`tnum py-1.5 text-right font-semibold ${z.present < z.quota ? 'text-critical' : 'text-ink-strong'}`}>{z.present}</td>
                    <td className="py-1.5">{z.present < z.quota ? <span className="text-critical">근무공백</span> : <span className="text-ok">정상</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Block>

          {/* 3. 안전관리 */}
          <Block n={3} title="안전관리">
            <div className="space-y-1.5 text-label text-ink-base">
              <div>· 작업중지: {safety.workStop.active ? <b className="text-critical">발령 중 ({safety.workStop.at}) — {safety.workStop.reason}</b> : <span className="text-ok">발령 없음(정상 운영)</span>}</div>
              <div>· 운영중단: {safety.suspension.active ? <b className="text-warn">{safety.suspension.zoneIds === null ? '전 거점' : `${safety.suspension.zoneIds.length}개 거점`} 전파 중 ({safety.suspension.at}) — {safety.suspension.reason}</b> : <span className="text-ok">발령 없음(정상 운영)</span>}</div>
              <div>· 위험요인 점검: <b className={hazardChecked === safety.hazards.length ? 'text-ok' : 'text-warn'}>{hazardChecked}/{safety.hazards.length}</b> 완료{hazardChecked < safety.hazards.length ? ` (미점검: ${safety.hazards.filter((h) => !h.checked).map((h) => h.label).join(', ')})` : ''}</div>
              <div>· 안전사고 접수: <b>{issues.filter((i) => i.type === '안전사고').length}건</b></div>
            </div>
          </Block>

          {/* 4. 이슈 처리 */}
          <Block n={4} title="민원·분실물·미아 처리">
            <div className="flex gap-6 text-label">
              <span>접수 <b className="tnum text-critical">{issueBy('received')}</b></span>
              <span>처리중 <b className="tnum text-warn">{issueBy('in_progress')}</b></span>
              <span>완료 <b className="tnum text-ok">{issueBy('resolved')}</b></span>
              <span className="text-ink-muted">총 {issues.length}건</span>
            </div>
          </Block>

          {/* 5. 특이·조치사항 — 정산은 일일 단위로 하지 않으므로 일일보고에서 제외(정산 화면 소관). */}
          <Block n={5} title="특이·조치사항">
            <ul className="space-y-1 text-label text-ink-base">
              {gaps.map((g) => <li key={g.zoneId}>· {g.zoneName} 근무공백 {g.shortfall}명 — 예비인력 투입 조치.</li>)}
              {compliance.map((c) => <li key={c.assignmentId}>· {c.zoneName} {c.personName} 정시체크 미이행({c.missedSlots.join('·')}) — 연락 확인.</li>)}
              {safety.workStop.active && <li>· 작업중지 발령 중 — 안전 확인 후 재개 예정.</li>}
              {gaps.length === 0 && compliance.length === 0 && !safety.workStop.active && <li className="text-ink-muted">· 특이사항 없음 — 전 거점 정상 운영.</li>}
            </ul>
          </Block>
        </div>

        <div className="mt-6 border-t border-line pt-3 text-right text-caption text-ink-faint">
          현장 운영본부 · 통합운영 플랫폼 자동 생성 문서
        </div>
      </div>
    </div>
  )
}
