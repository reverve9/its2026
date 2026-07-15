import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getKpi,
  getZones,
  getAlerts,
  getAttendanceEvents,
  getIssues,
  getNotices,
  describeAudience,
  getEducationSummary,
} from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import StaffingGapFlow from '../StaffingGapFlow'
import { PageHeader, Section, LivePill } from '../../../components/layout'
import { StatTile } from '../../../components/ui'
import { ZoneMap } from '../../../components/ZoneMap'
import { ZoneStatusRow } from '../../../components/ZoneStatusRow'
import { AlertItem } from '../../../components/AlertItem'
import { EventRow } from '../../../components/EventRow'
import type { OpsAlert } from '../../../types'

export default function Dashboard() {
  const [gapFlow, setGapFlow] = useState<{ zoneId: string; zoneName: string } | null>(null)
  const kpi = useLive(getKpi)
  const zones = useLive(getZones)
  const alerts = useLive(getAlerts)
  const events = useLive(getAttendanceEvents)
  const issues = useLive(getIssues)
  const notices = useLive(getNotices)
  const edu = useLive(getEducationSummary)

  if (!kpi || !zones || !alerts || !events || !issues || !notices || !edu) return null

  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]))
  const openZones = zones.filter((z) => z.status === 'open').length
  const openIssues = issues.filter((i) => i.status !== 'resolved').length
  const gapCount = alerts.filter((a) => a.level === 'critical').length
  const shiftKo = kpi.activeShift === 'AM' ? '오전조' : '오후조'

  // 근무공백 경보 → 3단계 대응 플로우 오픈.
  const openGapFlow = (alert: OpsAlert) => {
    if (alert.gapZoneId) setGapFlow({ zoneId: alert.gapZoneId, zoneName: alert.zoneName })
  }

  return (
    <div>
      <PageHeader
        title="통합 운영현황"
        summary="전 거점 실시간 출결·교대·근무공백을 한 화면에서 관제 — 현장 운영본부"
        right={<LivePill label="실시간 연결됨" />}
      />

      {/* 위기 상태 배너(A2) — 근무공백 발생 시 부각. 교대 직후 미출근 다발 구간 */}
      {gapCount > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border-2 border-critical bg-critical-soft px-5 py-3.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-critical text-xl text-white">⚠</span>
          <div className="min-w-0 flex-1 text-label">
            <b className="text-critical">위기 상태 — 즉시 대응 필요.</b>{' '}
            <span className="text-ink-base">근무공백 {gapCount}거점 · {shiftKo} 미출근 {kpi.absent}명. 우측 경보에서 예비인력 배치.</span>
          </div>
          <span className="tnum shrink-0 rounded-lg bg-surface px-2.5 py-1 text-caption font-semibold text-critical">교대 후 {kpi.minsSinceShiftStart}분</span>
        </div>
      )}

      {/* KPI 스트립 — 교대 인지형 */}
      <div className="mb-5 grid grid-cols-7 gap-3">
        <StatTile label="배치 인원" value={kpi.total} unit="명" hint="오전 55 · 오후 55" />
        <StatTile label={`${shiftKo} 근무`} value={`${kpi.present}/${kpi.expected}`} unit="명" tone="primary" hint={`근무 ${kpi.onDuty} · 휴게이동 ${kpi.breakOrMoving}`} />
        <StatTile label="미출근" value={kpi.absent} unit="명" tone="critical" hint="예비 대체 검토" />
        <StatTile label="근무공백" value={kpi.gapAlerts} unit="거점" tone="critical" hint="예비 투입 필요" />
        <StatTile label="투입가능 예비" value={kpi.reserveAvailable} unit="명" tone="ok" />
        <StatTile label={`교대 후 경과`} value={kpi.minsSinceShiftStart} unit="분" hint={`운영 중 ${openZones}/${zones.length} · 이슈 ${openIssues}`} />
        {/* 교육 이수율 — 미이수가 있으면 인력 현황의 미이수 명단으로 드릴다운. */}
        <Link
          to="/personnel?edu=pending"
          className="rounded-xl transition hover:opacity-80"
          aria-label={`사전 통합교육 미이수 ${edu.pending}명 명단 보기`}
        >
          <StatTile
            label="교육 이수율"
            value={`${edu.rate}%`}
            tone={edu.pending ? 'warn' : 'ok'}
            hint={`${edu.done}/${edu.total}명 · 미이수 ${edu.pending}`}
          />
        </Link>
      </div>

      {/* 좌: 거점 상황판 / 우: 경보 + 라이브 */}
      <div className="grid grid-cols-3 gap-5">
        <Section
          className="col-span-2"
          title="전 거점 상황판"
          right={<span className="text-caption text-ink-muted">행사장 {zones.filter((z) => z.kind === 'venue').length} · 관광지 {zones.filter((z) => z.kind === 'tourist').length}</span>}
        >
          <ZoneMap zones={zones} />
          <div className="mt-3 border-t border-line pt-1">
            {zones.map((z) => (
              <ZoneStatusRow key={z.id} zone={z} />
            ))}
          </div>
        </Section>

        <div className="col-span-1 flex flex-col gap-5">
          <Section
            title="경보 · 근무공백"
            right={<span className="tnum rounded-full bg-critical-soft px-2 py-0.5 text-caption font-bold text-critical">{gapCount}</span>}
            bodyClassName="px-4 py-1"
          >
            <div className="divide-y divide-line-soft">
              {alerts.map((a) => (
                <AlertItem
                  key={a.id}
                  alert={a}
                  action={
                    a.level === 'critical' && a.gapZoneId ? (
                      <button
                        onClick={() => openGapFlow(a)}
                        className="rounded-lg bg-primary-600 px-2.5 py-1 text-caption font-semibold text-white transition hover:bg-primary-700"
                      >
                        예비인력 배치
                      </button>
                    ) : undefined
                  }
                />
              ))}
              {alerts.length === 0 && (
                <div className="py-6 text-center text-label text-ink-faint">현재 경보 없음 — 전 거점 정상</div>
              )}
            </div>
          </Section>

          <Section title="실시간 출결" right={<LivePill />} bodyClassName="px-4 py-1">
            <div className="divide-y divide-line-soft">
              {events.map((e) => (
                <EventRow key={e.id} event={e} zoneName={zoneName[e.zoneId] ?? e.zoneId} />
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* 하단: 공지 · 이슈 */}
      <div className="mt-5">
        <Section title="오늘 진행 · 안내기준 배포">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 text-label font-semibold text-ink-muted">최근 공지 · 안내기준</div>
              {notices.length === 0 && (
                <p className="py-2 text-label text-ink-muted">아직 발령된 공지가 없습니다.</p>
              )}
              <div className="divide-y divide-line-soft">
                {notices.map((n) => (
                  <div key={n.id} className="py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-label font-semibold text-ink-strong">{n.title}</span>
                      <span className="tnum shrink-0 text-caption text-ink-faint">{n.time}</span>
                    </div>
                    <p className="mt-0.5 text-label leading-snug text-ink-base">{n.body}</p>
                    <span className="mt-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-ink-muted">
                      {describeAudience(n.audience, zones)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-label font-semibold text-ink-muted">미처리 이슈</div>
              <div className="divide-y divide-line-soft">
                {issues.filter((i) => i.status !== 'resolved').map((i) => (
                  <div key={i.id} className="flex items-center gap-2 py-2">
                    <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-muted">{i.type}</span>
                    <span className="min-w-0 flex-1 truncate text-label text-ink-base">{i.message}</span>
                    <span className="tnum shrink-0 text-caption text-ink-faint">{i.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
      </div>

      {gapFlow && <StaffingGapFlow zoneId={gapFlow.zoneId} zoneName={gapFlow.zoneName} onClose={() => setGapFlow(null)} />}
    </div>
  )
}
