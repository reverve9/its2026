import { useEffect, useState } from 'react'
import {
  getKpi,
  getZones,
  getAlerts,
  getAttendanceEvents,
  getIssues,
  getNotices,
} from '../../../lib/services'
import type {
  KpiSummary,
  Zone,
  OpsAlert,
  AttendanceEvent,
  Issue,
  Notice,
} from '../../../types'
import { PageHeader, Section, LivePill } from '../../../components/layout'
import { StatTile } from '../../../components/ui'
import { ZoneMap } from '../../../components/ZoneMap'
import { ZoneStatusRow } from '../../../components/ZoneStatusRow'
import { AlertItem } from '../../../components/AlertItem'
import { EventRow } from '../../../components/EventRow'

type Data = {
  kpi: KpiSummary
  zones: Zone[]
  alerts: OpsAlert[]
  events: AttendanceEvent[]
  issues: Issue[]
  notices: Notice[]
}

export default function Dashboard() {
  const [d, setD] = useState<Data | null>(null)

  useEffect(() => {
    Promise.all([
      getKpi(),
      getZones(),
      getAlerts(),
      getAttendanceEvents(),
      getIssues(),
      getNotices(),
    ]).then(([kpi, zones, alerts, events, issues, notices]) =>
      setD({ kpi, zones, alerts, events, issues, notices })
    )
  }, [])

  if (!d) return null

  const zoneName = Object.fromEntries(d.zones.map((z) => [z.id, z.name]))
  const openZones = d.zones.filter((z) => z.status === 'open').length
  const openIssues = d.issues.filter((i) => i.status !== 'resolved').length
  const gapZones = d.zones.filter((z) => z.status === 'open' && z.present < z.quota)
  // 경보 우선순위: critical → warning → info
  const order = { critical: 0, warning: 1, info: 2 } as const
  const alerts = [...d.alerts].sort((a, b) => order[a.level] - order[b.level])

  return (
    <div>
      <PageHeader
        title="통합 운영현황"
        summary="전 거점 실시간 출결·근무공백을 한 화면에서 관제 — 현장 운영본부"
        right={<LivePill label="실시간 연결됨" />}
      />

      {/* KPI 스트립 */}
      <div className="mb-5 grid grid-cols-6 gap-3">
        <StatTile label="배치 인원" value={d.kpi.total} unit="명" />
        <StatTile label="현재 근무중" value={d.kpi.onDuty} unit="명" tone="primary" />
        <StatTile label="휴게·이동" value={d.kpi.breakOrMoving} unit="명" />
        <StatTile label="근무공백" value={d.kpi.gapAlerts} unit="거점" tone="critical" hint="예비 투입 필요" />
        <StatTile label="투입가능 예비" value={d.kpi.reserveAvailable} unit="명" tone="ok" />
        <StatTile label="운영 중 거점" value={`${openZones}/${d.zones.length}`} unit="" hint={`미처리 이슈 ${openIssues}`} />
      </div>

      {/* 좌: 거점 상황판 / 우: 경보 + 라이브 */}
      <div className="grid grid-cols-3 gap-5">
        <Section
          className="col-span-2"
          title="전 거점 상황판"
          right={<span className="text-caption text-ink-muted">행사장 {d.zones.filter((z) => z.kind === 'venue').length} · 관광지 {d.zones.filter((z) => z.kind === 'tourist').length}</span>}
        >
          <ZoneMap zones={d.zones} />
          <div className="mt-3 border-t border-line pt-1">
            {d.zones.map((z) => (
              <ZoneStatusRow key={z.id} zone={z} />
            ))}
          </div>
        </Section>

        <div className="col-span-1 flex flex-col gap-5">
          <Section
            title="경보 · 근무공백"
            right={<span className="tnum rounded-full bg-critical-soft px-2 py-0.5 text-caption font-bold text-critical">{gapZones.length}</span>}
            bodyClassName="px-4 py-1"
          >
            <div className="divide-y divide-line-soft">
              {alerts.map((a) => (
                <AlertItem
                  key={a.id}
                  alert={a}
                  action={
                    a.level === 'critical' ? (
                      <button className="rounded-lg bg-primary-600 px-2.5 py-1 text-caption font-semibold text-white transition hover:bg-primary-700">
                        예비인력 배치
                      </button>
                    ) : undefined
                  }
                />
              ))}
            </div>
          </Section>

          <Section title="실시간 출결" right={<LivePill />} bodyClassName="px-4 py-1">
            <div className="divide-y divide-line-soft">
              {d.events.map((e) => (
                <EventRow key={e.id} event={e} zoneName={zoneName[e.zoneId] ?? e.zoneId} />
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* 하단: 오늘 진행 · 공지 */}
      <div className="mt-5">
        <Section title="오늘 진행 · 안내기준 배포">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-2 text-label font-semibold text-ink-muted">최근 공지 · 안내기준</div>
              <div className="divide-y divide-line-soft">
                {d.notices.map((n) => (
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
                {d.issues.filter((i) => i.status !== 'resolved').map((i) => (
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
