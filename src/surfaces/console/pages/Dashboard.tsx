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
import { ZoneBoard } from '../../../components/ZoneBoard'
import { AlertItem } from '../../../components/AlertItem'
import { EventRow } from '../../../components/EventRow'
import type { OpsAlert } from '../../../types'

// 경보 한 페이지에 몇 건인가. 좌우 컬럼 높이가 맞물리게 정한 값이다 —
// 좌측(거점 상황판 통계표 + 공지/이슈)과 우측(경보 5행+페이저 + 출결 + 서명)이 실측 1239px 로 맞는다.
// 거점 수·행 여백·상황판 구성이 바뀌면 다시 재야 한다(실측: 두 컬럼 getBoundingClientRect).
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
        {/* 부제가 없다. '운영 중 11/11 · 이슈 3'이 있었는데 교대 후 경과와 아무 상관이 없었다 —
            부제는 그 타일의 값을 풀어 쓰는 자리다(배치 인원 → 오전 55·오후 55). 갈 곳 없던 두 수가
            남는 칸에 주차돼 있었고, 그래서 둘 다 제 집과 겹쳤다: 운영 중은 거점 상황판이,
            이슈는 미처리 이슈 카드가 수와 내용을 같이 말한다. */}
        <StatTile label="교대 후 경과" value={kpi.minsSinceShiftStart} unit="분" />
        {/* 교육 이수율 — 미이수가 있으면 인력 현황의 미이수 명단으로 드릴다운.
            발주처(client)에겐 인력 현황이 없으므로 타일만 남고 링크가 걷힌다 —
            등급 판정을 여기서 다시 쓰지 않고 사이드바와 같은 배열에 묻는다(R5).
            그러지 않으면 등급 경계를 옮기는 날 눌러도 되돌려보내지는 타일이 된다. */}
        {canSee(role, '/personnel') ? (
          <Link
            to="/personnel?edu=pending"
            className="rounded-xl transition hover:opacity-80"
            aria-label={`공통교육 미이수 ${edu.pending}명 명단 보기`}
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
        {/* 거점 상황판 = 통계표(ZoneBoard). 지도(핀 배치)는 버렸다 — 노트북 관제에서 운영자는
            공간이 아니라 상태로 판단하고, 목록이 이미 그 상태를 다 날랐다(지도는 기능상 중복이었다).
            탭이 한 종류만 넘겨 5~6행이라 스크롤이 없다. */}
        <div className="col-span-2 flex flex-col gap-5">
          <Section title="전 거점 상황판" bodyClassName="p-0">
            <ZoneBoard zones={zones} issues={issues} />
          </Section>

          {/* 공지와 이슈 — 예전엔 '오늘 진행 · 안내기준 배포' 한 상자에 반씩 들어 있었다.
              쪼갠 이유: 방향이 반대다. 공지는 본부→현장(나가는 것)이고 이슈는 현장→본부
              (들어오는 것)라, 한 상자로 묶을 공통점이 '둘 다 오늘 일'밖에 없었다.
              그 제목도 버렸다 — 최초 커밋의 스캐폴드이자 데이터 척추 이름(이슈이벤트 /
              공지·안내기준)이라 운영자가 아니라 설계자에게 말을 걸고 있었다(D26).
              여기 있는 이유: 거점 상황판만으론 좌측이 762px 이고 우측이 1284px 라 522px 이
              비어 있었다. 이 둘(505px)이 정확히 그 자리다 → 두 컬럼이 1287/1284 로 맞물린다. */}
          <div className="grid grid-cols-2 gap-5">
            <Section title="공지 · 안내기준">
              {notices.length === 0 && (
                <p className="py-2 text-label text-ink-muted">아직 발령된 공지가 없습니다.</p>
              )}
              <div className="divide-y divide-line-soft">
                {notices.map((n) => (
                  <div key={n.id} className="group relative py-2 first:pt-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-label font-semibold text-ink-strong">{n.title}</span>
                      <span className="tnum shrink-0 text-caption text-ink-faint">{n.time}</span>
                    </div>
                    {/* 무조건 한 줄 — 본문 길이가 카드 높이를 정하게 두지 않는다. 공지는 길이가
                        제각각이라 그대로 두면 발령 하나에 좌우 컬럼 균형이 흔들린다. */}
                    <p className="mt-0.5 truncate text-label leading-snug text-ink-base">{n.body}</p>
                    <span className="mt-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-ink-muted">
                      {describeAudience(n.audience, zones)}
                    </span>
                    {/* 전문 팝오버 — 잘린 한 줄을 마우스로 펴 본다. 카드가 아니라 행에 걸리므로
                        아래 행 위로 뜬다(z-10). 팝오버 자신이 group 안이라 그 위로 마우스를
                        옮겨도 닫히지 않는다 — 긴 문안은 읽는 데 시간이 걸린다. */}
                    <div className="invisible absolute left-0 top-full z-10 w-full rounded-lg border border-line bg-surface p-3 text-label leading-snug text-ink-base shadow-lg group-hover:visible">
                      {n.body}
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="미처리 이슈">
              {openIssues === 0 && (
                <p className="py-2 text-label text-ink-muted">미처리 이슈가 없습니다.</p>
              )}
              <div className="divide-y divide-line-soft">
                {issues.filter((i) => i.status !== 'resolved').map((i) => (
                  <div key={i.id} className="flex items-center gap-2 py-2 first:pt-0">
                    <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-muted">{i.type}</span>
                    <span className="min-w-0 flex-1 truncate text-label text-ink-base">{i.message}</span>
                    <span className="tnum shrink-0 text-caption text-ink-faint">{i.time}</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>

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

      {gapFlow && <StaffingGapFlow zoneId={gapFlow.zoneId} zoneName={gapFlow.zoneName} onClose={() => setGapFlow(null)} />}
    </div>
  )
}
