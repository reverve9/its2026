import {
  getKpi,
  getZones,
  getAlerts,
  getAttendanceEvents,
  getIssues,
  getNotices,
  getReserves,
  assignReserve,
} from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import { PageHeader, Section, LivePill } from '../../../components/layout'
import { StatTile } from '../../../components/ui'
import { ZoneMap } from '../../../components/ZoneMap'
import { ZoneStatusRow } from '../../../components/ZoneStatusRow'
import { AlertItem } from '../../../components/AlertItem'
import { EventRow } from '../../../components/EventRow'
import type { OpsAlert } from '../../../types'

export default function Dashboard() {
  const kpi = useLive(getKpi)
  const zones = useLive(getZones)
  const alerts = useLive(getAlerts)
  const events = useLive(getAttendanceEvents)
  const issues = useLive(getIssues)
  const notices = useLive(getNotices)

  if (!kpi || !zones || !alerts || !events || !issues || !notices) return null

  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]))
  const openZones = zones.filter((z) => z.status === 'open').length
  const openIssues = issues.filter((i) => i.status !== 'resolved').length
  const gapCount = alerts.filter((a) => a.level === 'critical').length
  const shiftKo = kpi.activeShift === 'AM' ? '오전조' : '오후조'

  // 예비인력 배치(B 플로우) — 경보 대상 거점에 대기 예비를 즉시 투입.
  const handleAssign = async (alert: OpsAlert) => {
    const reserves = await getReserves()
    const r = reserves[0]
    if (r) await assignReserve(alert.id, r.id)
  }

  return (
    <div>
      <PageHeader
        title="통합 운영현황"
        summary="전 거점 실시간 출결·교대·근무공백을 한 화면에서 관제 — 현장 운영본부"
        right={<LivePill label="실시간 연결됨" />}
      />

      {/* KPI 스트립 — 교대 인지형 */}
      <div className="mb-5 grid grid-cols-6 gap-3">
        <StatTile label="배치 인원" value={kpi.total} unit="명" hint="오전 55 · 오후 55" />
        <StatTile label={`${shiftKo} 근무`} value={`${kpi.present}/${kpi.expected}`} unit="명" tone="primary" hint={`근무 ${kpi.onDuty} · 휴게이동 ${kpi.breakOrMoving}`} />
        <StatTile label="미출근" value={kpi.absent} unit="명" tone="critical" hint="예비 대체 검토" />
        <StatTile label="근무공백" value={kpi.gapAlerts} unit="거점" tone="critical" hint="예비 투입 필요" />
        <StatTile label="투입가능 예비" value={kpi.reserveAvailable} unit="명" tone="ok" />
        <StatTile label={`교대 후 경과`} value={kpi.minsSinceShiftStart} unit="분" hint={`운영 중 ${openZones}/${zones.length} · 이슈 ${openIssues}`} />
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
                        onClick={() => handleAssign(a)}
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
              <div className="divide-y divide-line-soft">
                {notices.map((n) => (
                  <div key={n.id} className="py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-label font-semibold text-ink-strong">{n.title}</span>
                      <span className="tnum shrink-0 text-caption text-ink-faint">{n.time}</span>
                    </div>
                    <p className="mt-0.5 text-label leading-snug text-ink-base">{n.body}</p>
                    <span className="mt-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-ink-muted">
                      {n.scope === 'all' ? '전 거점' : `${n.scope.length}개 거점`}
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
    </div>
  )
}
