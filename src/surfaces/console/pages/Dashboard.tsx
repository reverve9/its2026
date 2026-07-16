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
  getRecentScans,
  getAssignments,
  markAlertsRead,
} from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import { canSee } from '../../../lib/consoleNav'
import { loadConsoleSession } from '../../../lib/consoleAuth'
import { fmtHM } from '../../../lib/clock'
import StaffingGapFlow from '../StaffingGapFlow'
import { PageHeader, Section, LivePill } from '../../../components/layout'
import { StatTile, Pagination, usePageState, paginate } from '../../../components/ui'
import { ZoneMap } from '../../../components/ZoneMap'
import { ZoneStatusRow } from '../../../components/ZoneStatusRow'
import { AlertItem } from '../../../components/AlertItem'
import { EventRow } from '../../../components/EventRow'
import type { OpsAlert } from '../../../types'

// 경보 한 페이지에 몇 건인가. 좌측 거점 상황판(11거점 고정)의 자연 높이 1287px 이 정한 값이다 —
// 우측 컬럼 = 경보(5행+페이저) 470 + 출결 268 + 서명 498 + gap 40 = 1276 으로 좌측과 11px 차.
// 6건이면 1335 라 48px 넘친다. 거점 수가 바뀌면 이 숫자도 다시 재야 한다.
const ALERTS_PER_PAGE = 5

export default function Dashboard() {
  const [gapFlow, setGapFlow] = useState<{ zoneId: string; zoneName: string } | null>(null)
  // 이 화면은 세션이 있을 때만 마운트된다(ConsoleLayout 이 없으면 로그인 화면을 낸다).
  // 로그인·로그아웃은 트리를 통째로 갈아서 렌더 중 읽어도 낡을 수 없다.
  const role = loadConsoleSession()?.role ?? 'client'
  const kpi = useLive(getKpi)
  const zones = useLive(getZones)
  const alerts = useLive(getAlerts)
  const events = useLive(getAttendanceEvents)
  const issues = useLive(getIssues)
  const notices = useLive(getNotices)
  const edu = useLive(getEducationSummary)
  // 서명 피드는 배치 id(subjectId·scannerId)만 들고 온다 — 이름은 명부로 푼다.
  const scans = useLive(getRecentScans)
  const roster = useLive(getAssignments)
  // 훅은 조기 반환 앞에서(ui.tsx usePageState 주석) — 경보 수가 바뀌면 1페이지로.
  // 읽음은 수를 안 바꾸므로 '모두 읽음'을 눌러도 페이지가 튀지 않는다.
  const alertPg = usePageState(alerts?.length ?? 0)

  if (!kpi || !zones || !alerts || !events || !issues || !notices || !edu || !scans || !roster) return null

  const zoneName = Object.fromEntries(zones.map((z) => [z.id, z.name]))
  const personName = Object.fromEntries(roster.map((a) => [a.id, a.personName]))
  // scannerId 가 null 인 스캔 = 슈퍼어드민(배치가 없다). 명부에 없는 게 정상이다.
  const scannerName = (id: string | null) => (id === null ? '운영본부 관리자' : personName[id] ?? '—')
  const openZones = zones.filter((z) => z.status === 'open').length
  const openIssues = issues.filter((i) => i.status !== 'resolved').length
  const gapCount = alerts.filter((a) => a.level === 'critical').length
  const unread = alerts.filter((a) => !a.read)
  const alertPage = paginate(alerts, alertPg.page, ALERTS_PER_PAGE)
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
        <StatTile label={`${shiftKo} 근무`} value={`${kpi.present}/${kpi.expected}`} unit="명" tone="primary" />
        <StatTile label="미출근" value={kpi.absent} unit="명" tone="critical" hint="예비 대체 검토" />
        <StatTile label="근무공백" value={kpi.gapAlerts} unit="거점" tone="critical" hint="예비 투입 필요" />
        <StatTile label="투입가능 예비" value={kpi.reserveAvailable} unit="명" tone="ok" />
        <StatTile label={`교대 후 경과`} value={kpi.minsSinceShiftStart} unit="분" hint={`운영 중 ${openZones}/${zones.length} · 이슈 ${openIssues}`} />
        {/* 교육 이수율 — 미이수가 있으면 인력 현황의 미이수 명단으로 드릴다운.
            발주처(client)에겐 인력 현황이 없으므로 타일만 남고 링크가 걷힌다 —
            등급 판정을 여기서 다시 쓰지 않고 사이드바와 같은 배열에 묻는다(R5).
            그러지 않으면 등급 경계를 옮기는 날 눌러도 되돌려보내지는 타일이 된다. */}
        {canSee(role, '/personnel') ? (
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
        ) : (
          <StatTile
            label="교육 이수율"
            value={`${edu.rate}%`}
            tone={edu.pending ? 'warn' : 'ok'}
            hint={`${edu.done}/${edu.total}명 · 미이수 ${edu.pending}`}
          />
        )}
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
          {/* 경보만 페이지를 나눈다 — 16:00 에 54건까지 가서 카드가 3318px(뷰포트 3.8배)이 됐다.
              출결·서명은 서비스가 이미 자르는 '최근 N건' 피드라 여기 해당 없다(전량은 377·26건이라
              페이지로 넘길 물건이 아니다 — 인력 관리 화면이 대장을 맡는다).
              5건인 근거: 좌측 거점 상황판(11거점 고정)의 자연 높이 1287px 에 우측 컬럼이 맞물린다. */}
          <Section
            title="경보 · 근무공백"
            right={
              <span className="flex items-center gap-1.5">
                {unread.length > 0 && (
                  <>
                    <button
                      onClick={() => markAlertsRead(unread.map((a) => a.readKey))}
                      className="text-caption font-semibold text-ink-muted transition hover:text-ink-strong"
                    >
                      모두 읽음
                    </button>
                    <span className="tnum rounded-full bg-primary-600 px-2 py-0.5 text-caption font-bold text-white">
                      {unread.length}
                    </span>
                  </>
                )}
                <span className="tnum rounded-full bg-critical-soft px-2 py-0.5 text-caption font-bold text-critical">{gapCount}</span>
              </span>
            }
            bodyClassName="px-4 py-1"
          >
            <div className="divide-y divide-line-soft">
              {alertPage.slice.map((a) => (
                <AlertItem
                  key={a.id}
                  alert={a}
                  unread={!a.read}
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
            {alertPage.pages > 1 && (
              <div className="flex justify-center border-t border-line-soft py-2">
                <Pagination page={alertPage.page} pages={alertPage.pages} onChange={alertPg.setPage} />
              </div>
            )}
          </Section>

          <Section title="실시간 출결" right={<LivePill />} bodyClassName="px-4 py-1">
            <div className="divide-y divide-line-soft">
              {events.map((e) => (
                <EventRow key={e.id} event={e} zoneName={zoneName[e.zoneId] ?? e.zoneId} />
              ))}
            </div>
          </Section>

          {/* 최근 서명(QR) — 증거 전용 층(D18). 여기 뜨는 서명은 출결·물품·이슈를 움직이지
              않는다. 스캔은 있는데 물품이 미지급으로 남을 수 있고 그건 설계다.
              거점 축이 없다(D19) — 스캔은 사람과 사람 사이의 사실이라 거점명을 안 찍는다. */}
          <Section title="최근 서명 · QR" right={<LivePill />} bodyClassName="px-4 py-1">
            <div className="divide-y divide-line-soft">
              {scans.map((s) => (
                <div key={s.id} className="py-2">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-muted">
                      {s.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-label font-semibold text-ink-strong">
                      {personName[s.subjectId] ?? '—'}
                    </span>
                    <span className="tnum shrink-0 text-caption text-ink-faint">{fmtHM(s.timeMin)}</span>
                  </div>
                  <div className="mt-0.5 truncate text-caption text-ink-muted">
                    {s.note ? `${s.note} · ` : ''}확인 {scannerName(s.scannerId)}
                  </div>
                  {/* 지오펜스는 게이트가 아니라 기록이다(D19) — 경보가 아니라 표시로 남긴다. */}
                  {s.anomaly && <div className="mt-0.5 text-caption text-warn">⚠ {s.anomaly}</div>}
                </div>
              ))}
              {scans.length === 0 && (
                <div className="py-6 text-center text-label text-ink-faint">아직 서명 없음</div>
              )}
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
