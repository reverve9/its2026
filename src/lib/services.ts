// 서비스 레이어 — 화면은 오직 이 함수들만 호출한다(R1). 전부 async(R2).
// 저장소는 원시 사실만 보관하고, '현재 시각'(clock) 기준 파생값은 전부 여기서 계산한다(R5).
// 쓰기는 명령형 함수(R3) + 멱등키(R4). 나중에 Supabase 로 교체해도 이 시그니처는 불변.

import { getNowMin, getNowDate, getNowHM, fmtHM } from './clock'
import { distanceM, checkGeofence } from './geo'
import {
  rawZones,
  rawAssignments,
  rawEvents,
  dutyProfileOf,
  rawScans,
  addScan,
  rawIssues,
  rawNotices,
  isAlertRead,
  markAlertsRead as markAlertsReadInStore,
  deploymentPlan,
  expenseUnitPerDay,
  activityGoodsSets,
  activityGoodsUnitCost,
  setGoodsUnitCost,
  withholding,
  setWithholdingRate,
  staffWage,
  setStaffHourlyWage,
  staffHoursPerDay,
  setStaffHoursPerDay,
  dailyWageDeduction,
  dailyWageTaxRate,
  opsDate,
  findAssignment,
  zoneOf,
  addEvent,
  addIssue,
  setIssueStatus,
  setGoods,
  setPayout,
  educationOf,
  certifyEducation,
  rawVendors,
  foodParasols,
  setVendorDoc,
  placeReserve,
  rawSafety,
  setSuspension,
  setHazard,
  addAssignment,
  addVendor,
} from './store'
import type { StoredAssignment, StoredEvent, SafetyState } from './store'
import type {
  Zone,
  Assignment,
  AttendanceEvent,
  DutyLogEntry,
  Issue,
  Notice,
  ScanEvent,
  ScanKind,
  Audience,
  StaffKind,
  OpsAlert,
  KpiSummary,
  ExpenseSummary,
  Shift,
  DutyStatus,
  CheckState,
  Coords,
  IssueStatus,
  GoodsIssue,
  PayoutInfo,
  PersonnelRecord,
  GoodsSummary,
  FoodVendor,
  FoodSummary,
  VendorKind,
  EducationKind,
  EducationRecord,
  EducationSummary,
  StaffRole,
  Employment,
} from '../types'

// ── 조 상수 ─────────────────────────────────────────────
const WIN: Record<Shift, { start: number; end: number }> = {
  AM: { start: 10 * 60, end: 14 * 60 }, // 10:00–14:00
  PM: { start: 14 * 60, end: 18 * 60 }, // 14:00–18:00
}
const SLOTS: Record<Shift, number[]> = {
  AM: [10 * 60, 11 * 60, 12 * 60, 13 * 60],
  PM: [14 * 60, 15 * 60, 16 * 60, 17 * 60],
}
const GRACE = 15 // 출근 유예(분). 예정 출근 + GRACE 지나도 미체크 = 미출근.

// 지각 기준(분) — 출근 체크가 예정보다 이만큼 이상 늦으면 지각.
// 시계가 분 단위(nowMin)라 +4 까지는 지각이 아니고 +5 부터 지각 = '4분 59초까지는 봐준다'.
// 봐주는 구간(+1~4)도 lateMin 으로 남긴다 — 봐줬다는 사실 자체가 기록이어야 하기 때문이다.
// 경고성이라 상태(DutyStatus)는 안 건드린다: 지각자도 근무중이다. 축을 섞으면 관제가 깨진다.
// GRACE(15)와 다른 축이다 — GRACE 는 '안 온 사람'(미출근) 판정이고 이건 '늦게 온 사람' 판정이다.
const LATE_GRACE = 5

// 지각인가 — 화면은 이걸 쓴다. 각 화면이 `>= 5` 를 다시 쓰면 기준이 조용히 갈린다.
// lateMin 이 있는데 isLate 가 false = '늦었지만 봐준' 구간(+1~4). 그 상태도 화면에 남긴다.
export const isLate = (lateMin?: number): boolean => (lateMin ?? 0) >= LATE_GRACE
// 정시(1h) 체크 유예(분) — '4분 지각까지는 봐준다'. 슬롯은 정각 + 이 유예가 지나야 판정 대상이 된다.
//
// 왜 필요한가: 유예가 없으면(옛 `slot > now`) 17:00 정각에 17시 슬롯이 곧장 '누락'으로 찍혔다가
// 몇 분 뒤 이벤트가 도착하면 '정상'으로 뒤집힌다. 그 사이 경보(getAlerts)까지 울려서
// 관제가 멀쩡한 사람을 쫓게 된다. 사람은 정각에 맞춰 누르지 못한다.
//
// 왜 5인가: 시드가 정시 체크 이벤트를 정각+0~4분에 만든다 — 관측된 도착 폭이 4분이고,
// 5는 그 폭을 덮는 최소값이다. 더 늘리면 진짜 누락의 발견이 그만큼 늦어진다.
// 시계가 분 단위(nowMin)라 정각+4분까지는 판정하지 않고 정각+5분에 판정한다
// = '4분 59초까지 봐준다'. RFP 에 정시체크 규칙 자체가 없으므로 이건 우리 설계 선택이다.
//
// ⚠️ 유예는 판정을 미룰 뿐 결과를 바꾸지 않는다 — 늦게 눌렀다는 근거(이벤트의 timeMin)는
// 그대로 남고, 유예가 지난 뒤의 '누락' 집계는 유예가 없을 때와 같다(verify-grace 가 이걸 지킨다).
const CHECK_GRACE = 5

const activeShiftAt = (now: number): Shift => (now < WIN.PM.start ? 'AM' : 'PM')
export const shiftLabel = (s: Shift): string => (s === 'AM' ? '오전조' : '오후조')
export function getShiftSlots(s: Shift): string[] {
  return SLOTS[s].map(fmtHM)
}
export const shiftSlotMins = (s: Shift): number[] => SLOTS[s]

// ── 파생 헬퍼 ───────────────────────────────────────────
// 이벤트는 라이브(날짜별)라 반드시 현재 날짜로 거른다. 이 한 줄이 날짜 축의 목이다 —
// derive·getDutyLog 가 전부 여기를 지난다.
const eventsOf = (id: string): StoredEvent[] =>
  rawEvents().filter((e) => e.assignmentId === id && e.date === getNowDate())

// 원시 배치(현황) → 현재 날짜·시각 기준 도메인 Assignment(상태·checks·출퇴근 파생).
//
// date 는 배치가 갖고 있던 값이 아니라 '지금 보고 있는 날짜'다. 배치는 5일 고정이라 날짜가
// 없고, Assignment 는 그 배치의 오늘자 뷰이기 때문이다. 현장앱의 멱등키가
// `field:${a.id}:checkin:${a.date}:${a.shift}` 라 이 한 줄이 체크인 키를 날짜별로 만든다 —
// 배치에 고정 날짜가 박혀 있었다면 어제 체크인한 사람이 오늘 체크인에 막혔을 것이다.
function derive(a: StoredAssignment, now: number): Assignment {
  const date = getNowDate()
  const prof = dutyProfileOf(a.id, date)

  // 예비인력(미배정) — 대기 상태, 정시체크 없음.
  if (a.isReserve && !a.zoneId) {
    return {
      id: a.id, personId: a.personId, personName: a.personName, zoneId: null,
      kind: a.kind, role: a.role, employment: a.employment, shift: a.shift,
      date, isReserve: true, status: 'before', lang: a.lang, phone: a.phone, checks: [],
      standby: a.standby, goods: a.goods,
    }
  }

  // 운영인력·현장운영 — 운영본부 상주. 거점 배치도 정시체크도 없고 2교대에 속하지 않는다.
  // 근태는 예정 출퇴근(10시간 상주)으로만 파생한다.
  // 운영인력(거점관리자·현장운영)은 교대가 아니라 1일 10시간 상주 — 조 슬롯이 아니라
  // plannedIn/OutMin 으로 상주 여부만 파생한다. 정시체크(checks)는 자원봉사자 관제 항목이라 비운다.
  // 거점관리자는 거점에 상주하므로 zoneId 를 유지한다(현장운영은 애초에 null).
  //
  // ⚠️ checkedInAt/checkedOutAt 을 채우지 않는다 — 운영인력에겐 출근 버튼이 없다.
  // 이전엔 `checkedInAt: now >= plannedInMin ? fmtHM(plannedInMin)` 으로 08:30 을 지어내서
  // 22명 전원이 '08:30 출근'으로 관제 로스터에 떴다. 찍은 적 없는 값이다.
  // 운영인력 출결은 과업이 아니다 — 과업지시서가 요구하는 건 '자원봉사자 출결 확인'이고,
  // 직영 인력은 발주처 보고 대상도 아니다(일용은 내부 원가). 그래서 근태 이벤트 자체가 없고,
  // 정산도 이벤트가 아니라 배치계획의 absentDays 로 산정한다. status 는 '상주 계획'일 뿐이다.
  if (a.kind === '운영인력' && a.plannedOutMin !== undefined) {
    const status: DutyStatus =
      now < a.plannedInMin ? 'before' : now >= a.plannedOutMin ? 'off' : 'on'
    return {
      id: a.id, personId: a.personId, personName: a.personName, zoneId: a.zoneId,
      kind: a.kind, role: a.role, employment: a.employment, shift: a.shift,
      date, isReserve: false, status, lang: a.lang, phone: a.phone, checks: [],
      goods: a.goods,
    }
  }

  const evs = eventsOf(a.id)
  const checkinEv = evs.filter((e) => e.kind === 'checkin').sort((x, y) => x.timeMin - y.timeMin)[0]
  const checkoutEv = evs.filter((e) => e.kind === 'checkout').sort((x, y) => x.timeMin - y.timeMin)[0]
  const checkedIn = !!checkinEv && checkinEv.timeMin <= now
  const checkedOut = !!checkoutEv && checkoutEv.timeMin <= now
  const win = WIN[a.shift]

  let status: DutyStatus
  if (prof?.noShow || (!checkedIn && now >= a.plannedInMin + GRACE)) status = 'absent'
  else if (!checkedIn) status = 'before'
  else if (checkedOut || now >= win.end) status = 'off'
  else status = 'on'

  // checks — 조 슬롯 중 유예까지 지난(due) 것만. 아직인 슬롯은 미포함(개인상세가 '예정'으로 표시).
  const checks: CheckState[] = []
  for (const slot of SLOTS[a.shift]) {
    if (slot + CHECK_GRACE > now) break
    if (status === 'absent') { checks.push('absent'); continue }
    const hit = evs.some((e) => e.kind === 'hourly' && e.slot === slot && e.timeMin <= now)
    checks.push(hit ? 'ok' : checkedIn ? 'missed' : 'absent')
  }

  return {
    id: a.id, personId: a.personId, personName: a.personName, zoneId: a.zoneId,
    kind: a.kind, role: a.role, employment: a.employment, shift: a.shift,
    date, isReserve: a.isReserve, status, lang: a.lang, phone: a.phone,
    checkedInAt: checkedIn ? fmtHM(checkinEv!.timeMin) : undefined,
    checkedOutAt: checkedOut ? fmtHM(checkoutEv!.timeMin) : undefined,
    // 늦게 온 만큼만 담는다 — 일찍/정시(0 이하)는 undefined 로 둬야 화면이 '지연 0분'을 안 찍는다.
    lateMin: checkedIn && checkinEv!.timeMin > a.plannedInMin ? checkinEv!.timeMin - a.plannedInMin : undefined,
    checks,
    standby: a.standby, goods: a.goods,
  }
}

const roster = (now: number): Assignment[] => rawAssignments().map((a) => derive(a, now))
// 출근해서 자리에 있는가. 휴게·이동 폐기로 'on' 하나만 남았다 — 함수는 유지한다:
// 호출부가 8곳이고, 상태가 다시 늘면 여기 한 곳만 고치면 된다.
const isPresent = (s: DutyStatus) => s === 'on'

// 거점 present/status 파생.
// quota 는 '자원봉사자 정원'이므로 present 도 자원봉사자만 센다 — 거점관리자(운영인력)를 같이 세면
// present 가 quota 를 넘겨 충원 게이지가 9/8 로 깨지고 근무공백(quota−present) 산정도 틀어진다.
function deriveZone(z: Zone, list: Assignment[], now: number): Zone {
  const shift = activeShiftAt(now)
  const present = list.filter(
    (a) => a.zoneId === z.id && a.shift === shift && a.kind === '자원봉사자' && isPresent(a.status)
  ).length
  const start = hm(z.opWindow.start), end = hm(z.opWindow.end)
  // 운영중단 발령이 운영시간을 이긴다 — 본부의 조치는 시간표보다 위다.
  // 다만 아직 열지 않았거나(before) 이미 끝난(closed) 거점은 중단할 대상이 없으므로 그대로 둔다.
  const byClock: Zone['status'] = now < start ? 'before' : now >= end ? 'closed' : 'open'
  const status: Zone['status'] =
    byClock === 'open' && isZoneSuspended(rawSafety(), z.id) ? 'suspended' : byClock
  return { ...z, present, status }
}
const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }

// ── 데이터 척추 getter ──────────────────────────────────
export async function getZones(): Promise<Zone[]> {
  const now = getNowMin()
  const list = roster(now)
  return rawZones().map((z) => deriveZone(z, list, now))
}
export async function getAssignments(): Promise<Assignment[]> {
  return roster(getNowMin())
}
// 로스터(별칭) — 배치 인력 전원.
export async function getAssignment(id: string): Promise<Assignment | undefined> {
  const a = findAssignment(id)
  return a ? derive(a, getNowMin()) : undefined
}

// 근무공백 대응(B 플로우) — 특정 거점 기준 예비인력 옵션. 거리·외국어 매칭 계산(R5).
export interface ReserveOption {
  assignment: Assignment
  distanceKm: number | null // 대기 위치 → 대상 거점 거리
  langMatch: boolean // 외국어 가능(관광지 우선배치 근거)
  educated: boolean // 사전 통합교육 이수 — 자격 신호(soft). 미이수여도 선택은 막지 않는다.
}
export async function getReserveOptions(zoneId: string): Promise<ReserveOption[]> {
  const zone = await getZone(zoneId)
  const reserves = roster(getNowMin()).filter((a) => a.isReserve && !a.zoneId)
  return reserves
    .map((r) => ({
      assignment: r,
      distanceKm: zone && r.standby ? Math.round((distanceM(r.standby, zone.coords) / 1000) * 10) / 10 : null,
      langMatch: (r.lang?.length ?? 0) > 0,
      educated: hasEducation(educationOf(r.personId), '사전 통합교육'),
    }))
    // 이수자 우선 → 그다음 거리순. 미이수는 뒤로 밀되 목록에서 빼지 않는다(하드 블록 금지).
    .sort((a, b) => Number(b.educated) - Number(a.educated) || (a.distanceKm ?? 999) - (b.distanceKm ?? 999))
}
export async function getZone(id: string): Promise<Zone | undefined> {
  return (await getZones()).find((z) => z.id === id)
}

// ── 현장앱 신원확인(저마찰) — 전번+성명 조회. 백엔드 인증 아님(R1 경유). ──
const digitsOnly = (s: string) => s.replace(/\D/g, '')
// ── 현장앱 신원(R5) ─────────────────────────────────────
// 현장앱이 '누구에게 무엇을 보여줄지' 정할 때 보는 유일한 값. 화면은 세션이 아니라 이걸 본다.
//
// 축이 둘이다:
//   kind    자원봉사자 / 운영인력 → 화면 자체를 가른다(VolunteerHome / OpsHome)
//   zoneId  거점 유무 → 운영인력 화면 안에서 거점 카드를 가른다
// role 로 가르지 않는다. 거점관리자·현장인력 겸직이나 슈퍼어드민 같은 경우에 role 은
// 답을 못 주지만 zoneId 는 항상 답을 준다 — 거점이 있으면 거점 카드, 없으면 공통만.
//
// assignmentId 가 nullable 인 이유: 슈퍼어드민은 인력현황(=Assignment)에 없다.
// 지금은 배치에서만 신원이 나오지만, 타입이 그 자리를 미리 열어둬야 나중에 안 뒤집는다.
export interface FieldIdentity {
  assignmentId: string | null
  personName: string
  kind: StaffKind
  zoneId: string | null
  role?: StaffRole // 표기용 배지. 분기 기준이 아니다
  status?: DutyStatus
}

// ── 슈퍼어드민 ──────────────────────────────────────────
// 인력현황(=Assignment)에 없는 사람. 배치가 없으므로 거점도 없고 역할도 없다 —
// StaffRole 셋(봉사자·거점관리자·현장운영) 중 어느 것도 아니라서 role 을 비운다.
// 지어낸 역할을 넣으면 화면이 거짓말을 하고, 공지 주소 판정도 오염된다.
//
// kind 가 '운영인력'이라 FieldLayout 이 OpsHome 으로 보내고, zoneId 가 null 이라
// 거점 카드가 안 뜬다 — 특례 분기가 하나도 없다(D12: 카드 게이트는 zoneId).
//
// ⚠️ 8자리 키는 하드코딩이다. 백엔드 인증이 아니고 서버 검증도 없다 —
// 그리고 Supabase 전환 후에도 하드코딩으로 간다(사용자 확정). 결함이 아니라 결정이다:
// 이 플랫폼은 시연·제안용이라 보호할 자산이 없고, 인증은 '누가 어느 화면을 보는가'만 가른다.
// 콘솔 계정(lib/consoleAuth.ts)도 같은 방침이다.
export const SUPER_ADMIN_KEY = '20261019'
const SUPER_ADMIN: FieldIdentity = {
  assignmentId: null,
  personName: '운영본부 관리자',
  kind: '운영인력',
  zoneId: null,
  role: undefined, // 슈퍼어드민은 StaffRole 이 아니다 — 배지는 표시층에서 '관리자'로 찍는다
}

export async function authSuperAdmin(key: string): Promise<boolean> {
  return key.trim() === SUPER_ADMIN_KEY
}

export async function getFieldIdentity(assignmentId: string | null): Promise<FieldIdentity | undefined> {
  if (assignmentId === null) return SUPER_ADMIN
  const a = await getAssignment(assignmentId)
  if (!a) return undefined
  return {
    assignmentId: a.id,
    personName: a.personName,
    kind: a.kind,
    zoneId: a.zoneId,
    role: a.role,
    status: a.status,
  }
}

export async function findVolunteer(phone: string, name: string): Promise<Assignment | undefined> {
  const d = digitsOnly(phone)
  const nm = name.trim()
  const a = rawAssignments().find((x) => digitsOnly(x.phone) === d && x.personName === nm)
  return a ? derive(a, getNowMin()) : undefined
}

// dev 편의 — 실제 눌러보기용 유효 계정 몇 개(현장앱 신원확인 quick-pick).
export interface SampleLogin {
  name: string
  phone: string
  role: StaffRole
  shift: Shift
  zoneName: string
}
export async function getSampleLogins(): Promise<SampleLogin[]> {
  const pick = (pred: (a: StoredAssignment) => boolean) => rawAssignments().find(pred)
  const raws = [
    pick((a) => a.role === '거점관리자'), // 거점관리자 — 전일 상주라 조로 고르지 않는다
    pick((a) => !a.isReserve && a.shift === 'PM' && zoneOf(a.zoneId)?.kind === 'tourist'), // 무인 봉사자
    pick((a) => !a.isReserve && a.shift === 'PM' && zoneOf(a.zoneId)?.kind === 'venue' && a.role === '봉사자'),
    pick((a) => a.shift === 'AM' && a.role === '봉사자'), // 오전조(퇴근 상태 확인용)
  ].filter((a): a is StoredAssignment => !!a)
  return raws.map((a) => ({
    name: a.personName, phone: a.phone, role: a.role, shift: a.shift,
    zoneName: zoneOf(a.zoneId)?.name ?? '—',
  }))
}

// 개인 근퇴 타임라인 — 이벤트 + 휴게/이동 구간에서 파생.
export async function getDutyLog(id: string): Promise<DutyLogEntry[]> {
  const a = findAssignment(id)
  const prof = a && dutyProfileOf(a.id, getNowDate())
  if (!a || prof?.noShow) return []
  const now = getNowMin()
  const entries: DutyLogEntry[] = []
  for (const e of eventsOf(a.id)) {
    if (e.timeMin > now) continue
    if (e.kind === 'checkin')
      entries.push({ time: fmtHM(e.timeMin), label: '출근 체크인', status: 'on', note: e.anomaly })
    else if (e.kind === 'checkout')
      entries.push({ time: fmtHM(e.timeMin), label: '퇴근', status: 'off' })
    else if (e.kind === 'audit')
      entries.push({ time: fmtHM(e.timeMin), label: e.anomaly ? '순회 감사 — 불일치' : '순회 감사 — 정위치 확인', status: 'on', note: e.anomaly })
    // 'hourly' 는 담지 않는다 — 바로 위 '정시(1h) 체크' 섹션이 슬롯별 정상/누락을 이미 보여준다.
    // 타임라인은 근퇴(출근·휴게·이동·퇴근)의 축이고 정시체크는 그 축의 상태전환이 아니다.
    // 4개 슬롯이 'on' 으로 줄줄이 서면 타임라인이 같은 말을 네 번 하면서 진짜 전환을 묻는다.
    // 유예(CHECK_GRACE)의 근거로 남아야 하는 건 출근 시각이다.
    // ⚠️ workBreak 은 영향 없다 — hourly 는 전부 status:'on' 이라 앞뒤 'on' 구간에 합쳐질 뿐이다.
  }
  return entries.sort((x, y) => hm(x.time) - hm(y.time))
}

// 실시간 출결 피드 — 최근 체크인·정시체크 이벤트(현재 시각 이하).
export async function getAttendanceEvents(): Promise<AttendanceEvent[]> {
  const now = getNowMin()
  return rawEvents()
    .filter((e) => e.date === getNowDate() && (e.kind === 'checkin' || e.kind === 'hourly') && e.timeMin <= now)
    .sort((x, y) => y.timeMin - x.timeMin)
    .slice(0, 6)
    .map((e) => {
      const a = findAssignment(e.assignmentId)
      return {
        id: e.id, idempotencyKey: e.idempotencyKey, personName: a?.personName ?? '—',
        zoneId: e.assignmentId && a?.zoneId ? a.zoneId : '',
        time: fmtHM(e.timeMin), gps: e.gps, anomaly: e.anomaly,
      }
    })
}

// 최신순 — 시드 입력 순서가 아니라 접수 시각이 기준이다(공지와 같은 규칙).
export async function getIssues(): Promise<Issue[]> {
  return [...rawIssues()].sort((a, b) => hm(b.time) - hm(a.time))
}
export async function updateIssueStatus(id: string, status: IssueStatus): Promise<void> {
  setIssueStatus(id, status)
}
// 공지는 '발령된 것'만 존재한다(R5·R6) — 시각 파생을 여기서 건다.
// 이게 없으면 스크러버를 10:00 으로 돌려도 14:05 공지가 보인다. 상황전파는 시간이 곧 의미라
// (14:05 에 내린 지시가 10:00 화면에 있으면 안 된다) 콘솔·현장앱 공통으로 건다.
// 정렬은 최신순 — 시드 입력 순서가 아니라 발령 시각이 기준이다.
const issuedNotices = (now: number): Notice[] =>
  rawNotices()
    .filter((n) => hm(n.time) <= now)
    .sort((a, b) => hm(b.time) - hm(a.time))

export async function getNotices(): Promise<Notice[]> {
  return issuedNotices(getNowMin())
}

// 지금 어느 조가 돌고 있는가(R5·R6) — 전일 상주라 자기 조가 없는 거점관리자가
// '지금 내 거점의 인력'을 보려면 자기 shift 가 아니라 이걸 기준으로 삼아야 한다.
export async function getActiveShift(): Promise<Shift> {
  return activeShiftAt(getNowMin())
}

// ── 상황전파 수신자 판정(R5) ─────────────────────────────
// 축이 비면 그 축은 안 거른다. 축 안은 OR, 축 사이는 AND. 전부 비면 전원.
// role 이 null 인 사람이 있다 — 슈퍼어드민은 StaffRole 셋 중 어느 것도 아니다.
// 역할을 지목한 공지는 역할이 없는 사람에게 가지 않는다(거점 지목 공지가 거점 없는 사람에게
// 안 가는 것과 같은 규칙).
function matchesAudience(
  person: { kind: StaffKind; role: StaffRole | null; zoneId: string | null },
  aud: Audience,
): boolean {
  if (aud.kinds?.length && !aud.kinds.includes(person.kind)) return false
  if (aud.roles?.length && (person.role === null || !aud.roles.includes(person.role))) return false
  // 거점을 지목한 공지는 거점 없는 인력(현장운영·예비)에게 가지 않는다.
  if (aud.zoneIds?.length && (person.zoneId === null || !aud.zoneIds.includes(person.zoneId))) return false
  return true
}

// 특정 배치(=사람)가 받아야 할 공지 — 현장앱 수신함.
// 주소(audience)로 한 번, 발령 시각으로 한 번 거른다.
export async function getNoticesFor(assignmentId: string | null): Promise<Notice[]> {
  // null = 슈퍼어드민. 배치가 없어도 '모양'은 있으므로 주소 판정이 된다 —
  // matchesAudience 가 id 가 아니라 shape 을 받게 설계된 이유가 이것이다.
  const person = assignmentId === null
    ? { kind: SUPER_ADMIN.kind, role: null, zoneId: null }
    : rawAssignments().find((x) => x.id === assignmentId)
  if (!person) return []
  return issuedNotices(getNowMin()).filter((n) => matchesAudience(person, n.audience))
}

// 수신자 주소를 사람이 읽는 한 줄로 — 콘솔 배지·현장앱 표기 공유.
export function describeAudience(aud: Audience, zones: Zone[]): string {
  const parts: string[] = []
  if (aud.kinds?.length) parts.push(aud.kinds.join('·'))
  if (aud.roles?.length) parts.push(aud.roles.join('·'))
  if (aud.zoneIds?.length) {
    const names = aud.zoneIds.map((id) => zones.find((z) => z.id === id)?.name ?? id)
    parts.push(names.length <= 2 ? names.join('·') : `${names.length}개 거점`)
  }
  return parts.length ? parts.join(' / ') : '전원'
}

// ── 파생 뷰 계산기(R5) ──────────────────────────────────
export interface StaffingGap {
  zoneId: string
  zoneName: string
  present: number
  quota: number
  shortfall: number
}
export async function computeStaffingGaps(): Promise<StaffingGap[]> {
  const zones = await getZones()
  return zones
    .filter((z) => z.status === 'open' && z.present < z.quota)
    .map((z) => ({ zoneId: z.id, zoneName: z.name, present: z.present, quota: z.quota, shortfall: z.quota - z.present }))
}

// 정시체크 미이행(soft) — 현재 조 배치 중 'missed' 보유.
export interface CheckComplianceItem {
  assignmentId: string
  personName: string
  zoneName: string
  missedSlots: string[]
}
export async function computeCheckCompliance(): Promise<CheckComplianceItem[]> {
  const now = getNowMin()
  const shift = activeShiftAt(now)
  const list = roster(now).filter((a) => !a.isReserve && a.shift === shift)
  const out: CheckComplianceItem[] = []
  for (const a of list) {
    const missedSlots = a.checks.map((c, i) => (c === 'missed' ? getShiftSlots(shift)[i] : '')).filter(Boolean)
    if (missedSlots.length)
      out.push({ assignmentId: a.id, personName: a.personName, zoneName: zoneOf(a.zoneId)?.name ?? '—', missedSlots })
  }
  return out
}

// ⚠️ 폐기: computeFillRate — 충원율(현재 조). 소비자가 처음부터 0이었다.
// 게다가 운영인력이 섞여 모수가 오염돼 있었다(kind 를 안 갈랐다) — 화면에 붙었으면 거짓말을 했을 것이다.
// 충원율이 다시 필요하면 kind === '자원봉사자' 를 걸고 새로 쓸 것. 이 몸통을 되살리지 말 것.

// 실비 — RFP 3-1: 1인당(교대근무자별) 24,000원. 이 단가에 지급물품 대금이 '포함'된다.
// 따라서 물품은 총액에 더하는 게 아니라 총액에서 빼낸다(총액 고정, 내부 구성만 이동).
//   1인 총액 = 평균 근무일(4.5) × 24,000 = 108,000
//   일일 지급기준 = (108,000 − 물품세트단가) ÷ 4.5 = 24,000 − 물품세트단가/4.5
// 평균 4.5일의 근거: 금요일만 1교대(55명) → 오전조 5일 · 오후조 4일 → 연인원 55×5+55×4 = 495.
export async function computeExpenses(): Promise<ExpenseSummary> {
  const plan = deploymentPlan()
  const unit = expenseUnitPerDay()
  const personDays = plan.reduce((s, p) => s + p.headcount, 0) // 495
  const goodsSets = activityGoodsSets() // 110 — 1인 1세트
  const headcount = goodsSets
  const avgDays = personDays / headcount // 4.5
  const perDiemTotal = personDays * unit // 11,880,000 — RFP 기준 총액(고정)

  const goodsUnitCost = activityGoodsUnitCost() // 입력값
  const goodsTotal = goodsSets * goodsUnitCost
  const payoutTotal = perDiemTotal - goodsTotal
  const dailyPayout = payoutTotal / personDays // = unit − goodsUnitCost/avgDays

  // 원천징수 — 현물(활동물품)은 대상이 아니므로 일당(현금)에만 적용.
  const rate = withholding()
  const withholdingTotal = payoutTotal * (rate / 100)
  const netPayoutTotal = payoutTotal - withholdingTotal
  const perPersonPayout = avgDays * unit - goodsUnitCost

  const breakdown = plan.map((p) => ({
    date: p.date,
    headcount: p.headcount,
    shifts: p.shifts,
    amount: Math.round(p.headcount * dailyPayout),
  }))

  return {
    unitPerDay: unit, personDays, headcount, avgDays, perDiemTotal,
    goodsSets, goodsUnitCost, goodsTotal, payoutTotal, dailyPayout,
    withholdingRate: rate, withholdingTotal, netPayoutTotal,
    perPersonTotal: avgDays * unit,
    perPersonPayout,
    perPersonNet: perPersonPayout * (1 - rate / 100),
    breakdown,
  }
}
export const getExpenses = computeExpenses

// 물품 세트 단가 입력(R3) — 이 값 하나가 일일 지급기준·실지급 총액·개인별 정산에 전파된다.
export async function setExpenseGoodsUnitCost(won: number): Promise<void> {
  setGoodsUnitCost(won)
}

// 원천징수율 입력(R3) — 기본 3.3%. 요율 변경 시 실수령액이 전면 재계산된다.
export async function setExpenseWithholdingRate(pct: number): Promise<void> {
  setWithholdingRate(pct)
}

// ── 개인별 정산 내역 ────────────────────────────────────
// 계획일수 ≠ 실근무일수 — 결근이 발생하므로 개인 실지급은 실근무일 기준으로 계산한다.
// 물품은 근무일수와 무관하게 1인 1세트(이미 지급됨) → 결근자는 일당만 줄고 물품대금은 온전히 잡힌다.
export interface SettlementRow {
  id: string
  personName: string
  shift: Shift
  zoneName: string
  plannedDays: number // 계획 근무일(오전조 5 / 오후조 4 — 금 1교대)
  absentDays: number // 결근일(5일 누적)
  workedDays: number // 실근무일 = 계획 − 결근
  payout: number // 일당(현금) = 실근무일 × 일일 지급기준
  withholding: number // 원천징수(일당 × 요율) — 현물은 대상 아님
  net: number // 실수령액(일당 − 원천징수)
  goodsCost: number // 물품 세트 단가(현물 — 원천징수 대상 아님)
  total: number // 1인 정산 총액(일당 + 물품, 세전 기준 = 24,000 산정 근거)
  docsReady: boolean // 정산 서류·계좌 등록 완료 — 미비면 지급 보류
  bankName?: string
  accountNo?: string // 마스킹 전 원본(화면에서 maskAccount 로 표기)
}

export const plannedDaysOf = (shift: Shift): number => (shift === 'AM' ? 5 : 4)

// 자원봉사자 실비만 — 운영인력은 실비 대상이 아니다(직원=급여 · 일용=시급). getStaffSettlement 참조.
export async function getSettlementRows(): Promise<SettlementRow[]> {
  const { dailyPayout, goodsUnitCost, withholdingRate } = await computeExpenses()
  return rawAssignments()
    .filter((a) => !a.isReserve && a.kind === '자원봉사자')
    .map((a) => {
      const plannedDays = plannedDaysOf(a.shift)
      const absentDays = Math.min(a.absentDays ?? 0, plannedDays)
      const workedDays = plannedDays - absentDays
      const payout = Math.round(workedDays * dailyPayout)
      const wh = Math.round(payout * (withholdingRate / 100))
      // 물품은 실제 지급 여부(인력 현황의 goods)와 연동 — 2종 모두 지급된 경우만 대금 계상.
      const issued = !!(a.goods?.jacket && a.goods?.bag)
      const goodsCost = issued ? goodsUnitCost : 0
      const pay = a.payout ?? PAYOUT_NONE
      return {
        id: a.id,
        personName: a.personName,
        shift: a.shift,
        zoneName: zoneOf(a.zoneId)?.name ?? '—',
        plannedDays, absentDays, workedDays, payout, goodsCost,
        withholding: wh,
        net: payout - wh,
        total: payout + goodsCost,
        docsReady: payoutReady(pay),
        bankName: pay.bankName,
        accountNo: pay.accountNo,
      }
    })
}

// ── 운영인력 정산 ───────────────────────────────────────
// 자원봉사자 실비와 세목·보고 경계가 다르다.
//   직원 — 급여이므로 이 산정에 들어오지 않는다(0원 표기).
//   일용 — 일급(시급 × 1일 근무시간) × 근무일수 − 일용근로소득 원천징수.
// 발주처 보고 대상이 아니다(실비 정산이 아니라 내부 원가) → 산출내역서에는 자원봉사자만 오른다.
export interface StaffSettlementRow {
  id: string
  personName: string
  role: StaffRole
  employment: Employment
  zoneName: string
  plannedDays: number
  absentDays: number
  workedDays: number
  dailyWage: number // 일급 = 시급 × 근무시간 (직원은 0 — 급여라 미산정)
  gross: number // 일급 × 실근무일
  withholding: number // 일용근로소득 원천징수
  net: number
}

// 일용근로소득 원천징수 — (일급 − 150,000) × 2.97%. 15만원 공제는 1일당이라 근무일수와 무관하게
// 매일 적용된다 → 일급 15만원 이하면 며칠을 일하든 0원. 음수 방지로 하한 0.
function dailyWageWithholding(dailyWage: number, workedDays: number): number {
  const taxablePerDay = Math.max(0, dailyWage - dailyWageDeduction())
  return Math.round(taxablePerDay * (dailyWageTaxRate() / 100)) * workedDays
}

export interface StaffSettlementSummary {
  hourlyWage: number
  hoursPerDay: number
  dailyWage: number
  headcount: number
  employeeCount: number
  daylaborCount: number
  daylaborGross: number
  daylaborWithholding: number
  daylaborNet: number
  deduction: number
  taxRate: number
  rows: StaffSettlementRow[]
}

// 운영인력은 행사 5일 전일 근무(자원봉사자처럼 교대로 나뉘지 않는다).
const STAFF_PLANNED_DAYS = 5

export async function getStaffSettlement(): Promise<StaffSettlementSummary> {
  const hourlyWage = staffWage()
  const hoursPerDay = staffHoursPerDay()
  const dailyWage = hourlyWage * hoursPerDay

  const rows: StaffSettlementRow[] = rawAssignments()
    .filter((a) => a.kind === '운영인력')
    .map((a) => {
      const employment = a.employment ?? '일용'
      const absentDays = Math.min(a.absentDays ?? 0, STAFF_PLANNED_DAYS)
      const workedDays = STAFF_PLANNED_DAYS - absentDays
      // 직원은 급여 — 이 산정에서 0원. '정산하지 않는다'는 사실을 행으로 보여준다.
      const perDay = employment === '직원' ? 0 : dailyWage
      const gross = perDay * workedDays
      const wh = employment === '직원' ? 0 : dailyWageWithholding(dailyWage, workedDays)
      return {
        id: a.id,
        personName: a.personName,
        role: a.role,
        employment,
        zoneName: a.zoneId ? zoneOf(a.zoneId)?.name ?? '—' : '운영본부',
        plannedDays: STAFF_PLANNED_DAYS,
        absentDays,
        workedDays,
        dailyWage: perDay,
        gross,
        withholding: wh,
        net: gross - wh,
      }
    })

  const day = rows.filter((r) => r.employment === '일용')
  return {
    hourlyWage,
    hoursPerDay,
    dailyWage,
    headcount: rows.length,
    employeeCount: rows.length - day.length,
    daylaborCount: day.length,
    daylaborGross: day.reduce((s, r) => s + r.gross, 0),
    daylaborWithholding: day.reduce((s, r) => s + r.withholding, 0),
    daylaborNet: day.reduce((s, r) => s + r.net, 0),
    deduction: dailyWageDeduction(),
    taxRate: dailyWageTaxRate(),
    rows,
  }
}

export async function setStaffWage(won: number): Promise<void> {
  setStaffHourlyWage(won)
}
export async function setStaffHours(h: number): Promise<void> {
  setStaffHoursPerDay(h)
}

// 경보 — 근무공백(critical) + 정시체크 누락(warning) + 교대 안내(info).
export async function getAlerts(): Promise<OpsAlert[]> {
  const now = getNowMin()
  const nowHM = fmtHM(now)
  const gaps = await computeStaffingGaps()
  const compliance = await computeCheckCompliance()
  const shift = activeShiftAt(now)
  // 읽음 표식은 아래에서 입힌다 — 여기선 아직 내용(message)이 안 정해져서 키를 못 만든다.
  const alerts: Omit<OpsAlert, 'readKey' | 'read'>[] = []

  for (const g of gaps)
    alerts.push({
      id: `gap:${g.zoneId}`, level: 'critical', time: nowHM, zoneName: g.zoneName,
      message: `근무공백 — ${shiftLabel(shift)} 배정 ${g.quota}명 중 ${g.present}명 근무. 예비인력 ${g.shortfall}명 투입 필요`,
      gapZoneId: g.zoneId,
    })
  for (const c of compliance)
    alerts.push({
      id: `chk:${c.assignmentId}`, level: 'warning', time: nowHM, zoneName: c.zoneName,
      message: `${c.personName} 봉사자 ${c.missedSlots.join('·')} 정시 체크 누락 — 연락 확인 필요(차단 아님)`,
    })

  const minsSince = Math.max(0, now - WIN[shift].start)
  if (shift === 'PM' && minsSince <= 60) {
    const absent = roster(now).filter((a) => !a.isReserve && a.shift === 'PM' && a.status === 'absent').length
    alerts.push({
      id: 'shift:pm', level: 'info', time: fmtHM(WIN.PM.start), zoneName: '전 거점',
      message: `14:00 교대 — 오전조 퇴근·오후조 투입. 미출근 ${absent}명 예비 대체 검토 중`,
    })
  }
  // 읽음 표식을 입힌다 — 키는 id 가 아니라 id+내용이다(store 주석).
  const marked = alerts.map((a) => {
    const readKey = `${a.id}@${a.message}`
    return { ...a, readKey, read: isAlertRead(readKey) }
  })

  // 안 읽은 것 먼저 → 그 안에서 심각도순.
  //
  // 시간순으로 안 가는 이유: 경보는 이벤트가 아니라 '지금 상태'라 gap·chk 가 전부 time: nowHM 이다
  // (아래 push 들). 최신순으로 세우면 53건이 동률이라 무순이 된다 — 정렬이 아니라 우연이다.
  // 안 읽은 것을 앞으로 올리는 게 최신순이 하려던 일('새 것을 먼저')을 실제로 한다:
  // 그러지 않으면 안 읽은 경보가 9페이지 중 7페이지에 앉아 배지가 무용해진다.
  const order = { critical: 0, warning: 1, info: 2 }
  return marked.sort(
    (a, b) => Number(a.read) - Number(b.read) || order[a.level] - order[b.level]
  )
}

// 경보를 읽음으로 표시. 화면이 readKey 를 만들지 않고 getAlerts 가 준 걸 그대로 돌려준다 —
// 키 규칙이 두 곳으로 갈리면 화면이 만든 키가 store 의 키와 어긋나 읽음이 영영 안 붙는다.
export async function markAlertsRead(readKeys: string[]): Promise<void> {
  markAlertsReadInStore(readKeys)
}

// KPI — 교대 인지형.
// 모수는 자원봉사자(110)다. 운영인력은 2교대 배치 대상이 아니라 관제 주체이므로
// '배치 110 · 오전 55 · 오후 55'에 섞이면 RFP 기준 숫자가 흔들린다.
export async function getKpi(): Promise<KpiSummary> {
  const now = getNowMin()
  const shift = activeShiftAt(now)
  const list = roster(now).filter((a) => a.kind === '자원봉사자')
  const nonReserve = list.filter((a) => !a.isReserve)
  const cur = nonReserve.filter((a) => a.shift === shift)
  const gaps = await computeStaffingGaps()
  return {
    total: nonReserve.length,
    activeShift: shift,
    amExpected: nonReserve.filter((a) => a.shift === 'AM').length,
    pmExpected: nonReserve.filter((a) => a.shift === 'PM').length,
    expected: cur.length,
    present: cur.filter((a) => isPresent(a.status)).length,
    absent: cur.filter((a) => a.status === 'absent').length,
    gapAlerts: gaps.length,
    reserveAvailable: list.filter((a) => a.isReserve && !a.zoneId).length,
    minsSinceShiftStart: Math.max(0, now - WIN[shift].start),
  }
}

// ── 쓰기(명령형, R3 + 멱등 R4) ──────────────────────────
// 체크인은 GPS 셀프 단일 경로다. method 인자가 없어진 이유가 그것이다 —
// 이전엔 'QR'(관리자 스캔) | 'GPS' 둘이었는데, QR 출결을 폐기하면서 갈래가 하나만 남았다.
// QR 은 이제 서명(recordScan)이고 출결과 아무 관계가 없다.
export async function checkIn(
  assignmentId: string,
  opts: { gps?: Coords; ts: number; idempotencyKey: string; anomaly?: string }
): Promise<boolean> {
  return addEvent({
    idempotencyKey: opts.idempotencyKey, assignmentId, date: getNowDate(), kind: 'checkin',
    timeMin: opts.ts, gps: opts.gps, anomaly: opts.anomaly,
  })
}

// ⚠️ 폐기: checkOut — 퇴근 이벤트 쓰기. 소비자가 0이었다(현장앱에 퇴근 버튼이 없다).
// 퇴근은 시드 이벤트이거나, 조 종료(win.end) 경과로 파생된다 — derive 의 `now >= win.end`.
// 퇴근 버튼을 만들 거면 그때 다시 쓸 것. 안 불리는 쓰기 API 는 '있는 줄 알았다'를 만든다.

export async function hourlyCheck(
  assignmentId: string,
  opts: { slot: number; gps?: Coords; ts: number; idempotencyKey: string }
): Promise<boolean> {
  return addEvent({
    idempotencyKey: opts.idempotencyKey, assignmentId, date: getNowDate(), kind: 'hourly',
    timeMin: opts.ts, slot: opts.slot, gps: opts.gps,
  })
}

// B 플로우 — 경보 대상 거점에 예비인력 투입 + 즉시 체크인.
export async function assignReserve(alertId: string, reserveAssignmentId: string): Promise<boolean> {
  const zoneId = alertId.startsWith('gap:') ? alertId.slice(4) : null
  if (!zoneId) return false
  const now = getNowMin()
  const shift = activeShiftAt(now)
  const placed = placeReserve(reserveAssignmentId, zoneId, shift)
  if (!placed) return false
  addEvent({
    idempotencyKey: `assign:${reserveAssignmentId}:${getNowDate()}:${zoneId}:${now}`,
    assignmentId: reserveAssignmentId, date: getNowDate(), kind: 'checkin', timeMin: now,
  })
  return true
}

// ── 인력 현황(운영 대장) ────────────────────────────────
// 시간 비의존(R5 예외 아님 — 애초에 파생할 시각 축이 없는 마스터 사실만 반환).
// 스크러버를 밀어도 이 값들은 변하지 않는다 = 실시간 관제(인력 관리)와의 역할 분담.
const GOODS_NONE: GoodsIssue = { jacket: false, bag: false }
const PAYOUT_NONE: PayoutInfo = { idCard: false, bankbook: false }
// 정산 준비 완료 = 신분증·통장 사본 + 계좌번호까지 등록.
export const payoutReady = (p: PayoutInfo): boolean => p.idCard && p.bankbook && !!p.accountNo

const toPersonnel = (a: StoredAssignment): PersonnelRecord => ({
  id: a.id,
  personId: a.personId,
  education: educationOf(a.personId),
  personName: a.personName,
  phone: a.phone,
  kind: a.kind,
  role: a.role,
  employment: a.employment,
  shift: a.shift,
  zoneId: a.zoneId,
  isReserve: a.isReserve,
  lang: a.lang ?? [],
  goods: a.goods ?? GOODS_NONE,
  payout: a.payout ?? PAYOUT_NONE,
})

export async function getPersonnel(): Promise<PersonnelRecord[]> {
  return rawAssignments().map(toPersonnel)
}

// 활동물품·정산서류는 자원봉사자 항목이다(본공고 3-1 제작·배부 + 실비 지급용).
// 운영인력은 지급 대상도 실비 대상도 아니므로 모수에서 뺀다 — 넣으면 지급률·서류 등록률이 왜곡된다.
export async function getGoodsSummary(): Promise<GoodsSummary> {
  const all = rawAssignments().filter((a) => a.kind === '자원봉사자')
  const list = all.map((a) => a.goods ?? GOODS_NONE)
  const pay = all.map((a) => a.payout ?? PAYOUT_NONE)
  return {
    total: list.length,
    jacket: list.filter((g) => g.jacket).length,
    bag: list.filter((g) => g.bag).length,
    complete: list.filter((g) => g.jacket && g.bag).length,
    pending: list.filter((g) => !g.jacket || !g.bag).length,
    payoutReady: pay.filter(payoutReady).length,
    payoutPending: pay.filter((p) => !payoutReady(p)).length,
  }
}

// ── 교육 이수(사람 단위) ────────────────────────────────
// 인증자 목값 — 현재 로그인한 운영본부 관리자.
export const CURRENT_OPERATOR = '운영본부 총괄'

export const hasEducation = (recs: EducationRecord[], kind: EducationKind): boolean =>
  recs.some((r) => r.kind === kind)
export const educationRecord = (recs: EducationRecord[], kind: EducationKind) =>
  recs.find((r) => r.kind === kind)

export async function getEducation(personId: string): Promise<EducationRecord[]> {
  return educationOf(personId)
}

// 사전 통합교육은 자원봉사자 대상(운영인력은 자체 교육) → 이수율 모수 = 배치 봉사자 110.
export async function getEducationSummary(): Promise<EducationSummary> {
  const list = rawAssignments().filter((a) => !a.isReserve && a.kind === '자원봉사자')
  const done = list.filter((a) => hasEducation(educationOf(a.personId), '사전 통합교육')).length
  return {
    total: list.length,
    done,
    pending: list.length - done,
    rate: list.length ? Math.round((done / list.length) * 100) : 0,
    fieldDone: list.filter((a) => hasEducation(educationOf(a.personId), '현장교육')).length,
  }
}

// 일괄 인증(R3) — 오프라인 통합교육 참석자를 한 번에 처리. 증빙 3종(인증자·일시·교육구분) 기록.
export async function certifyEducationBatch(
  personIds: string[],
  kind: EducationKind
): Promise<number> {
  const at = `${opsDate()} ${getNowHM()}`
  return certifyEducation(personIds, kind, CURRENT_OPERATOR, at)
}

// 정산 서류·지급계좌 등록(R3). 정산은 행사 후 일괄이므로 대장에서 사전 등록해 둔다.
export async function setPayoutInfo(assignmentId: string, patch: Partial<PayoutInfo>): Promise<boolean> {
  return setPayout(assignmentId, patch, opsDate())
}

// 계좌번호 마스킹 — 개인정보 최소노출(Ⅳ-8). 뒤 4자리만 노출.
export const maskAccount = (no?: string): string => {
  if (!no) return '—'
  const tail = no.replace(/\D/g, '').slice(-4)
  return `****-${tail}`
}

// 활동물품 지급/회수 기록(R3 — 명령형 쓰기). 지급일은 운영일 기준.
export async function issueGoods(
  assignmentId: string,
  patch: Partial<Omit<GoodsIssue, 'issuedAt'>>
): Promise<boolean> {
  return setGoods(assignmentId, patch, opsDate())
}

// ── 먹거리 입점업체 등록(운영 대장) ─────────────────────
// 인력 현황과 동일 성격 — 시간 비의존 마스터. 클라이언트(업체)앱이 없으므로
// 업체 셀프 등록이 아니라 운영본부가 업체 정보·구비서류를 등록·관리한다.
const docsComplete = (v: FoodVendor) => v.docs.every((d) => d.done)

export async function getFoodVendors(kind?: VendorKind): Promise<FoodVendor[]> {
  const list = rawVendors()
  return kind ? list.filter((v) => v.kind === kind) : list
}


export async function getFoodSummary(): Promise<FoodSummary> {
  const list = rawVendors()
  const docs = list.flatMap((v) => v.docs)
  return {
    trucks: list.filter((v) => v.kind === 'truck').length,
    booths: list.filter((v) => v.kind === 'booth').length,
    total: list.length,
    registered: list.filter(docsComplete).length,
    docDone: docs.filter((d) => d.done).length,
    docTotal: docs.length,
    pendingVendors: list.filter((v) => !docsComplete(v)).length,
  }
}

export const getFoodParasols = async (): Promise<number> => foodParasols()

// 구비서류 등록/해제(R3 — 명령형 쓰기). 등록일은 운영일 기준.
export async function registerVendorDoc(vendorId: string, docId: string, done: boolean): Promise<boolean> {
  return setVendorDoc(vendorId, docId, done, opsDate())
}

// ── 엑셀 임포트 ─────────────────────────────────────────
// 대량 신규 등록. 개별 수동 입력에만 기대지 않기 위한 경로다.
//
// ⚠️ 임포트 스키마는 익스포트와 다르다. 익스포트는 화면 컬럼(표시층 값 — '거점관리'·'종합안내소')
// 을 그대로 적고, 임포트는 등록 시점 사실만 받는다. 같은 파일을 돌려 쓰면 roleLabel 이 표시층에서
// 입력층이 되어(D23 위반) 배지 문구를 바꾸는 날 임포트가 조용히 깨진다.
//
// ⚠️ 교육 이수·활동물품·정산 서류·구비서류는 받지 않는다. 등록 시점의 사실이 아니다 —
// 예시파일에 칸을 만들면 '등록하면서 물품을 지급'이 되고, 그게 D30 이 잡은 사고다.
// 그것들은 등록 후 콘솔에서 관리자가 토글한다.
//
// 갱신하지 않는다. 키가 겹치면 건너뛴다(addScan 과 같은 뜻) — 임포트가 덮어쓰면 화면에서
// 한 작업이 파일 한 번에 날아간다. 수정은 콘솔의 일이다.
export interface ImportResult {
  added: number
  skipped: number // 이미 있는 행(멱등, R4)
  errors: { row: number; message: string }[] // row = 엑셀 행 번호(헤더가 1행)
}

const ROLE_BY_LABEL: Record<string, StaffRole> = { 봉사자: '봉사자', 거점관리자: '거점관리자', 현장운영: '현장운영' }
const KIND_BY_LABEL: Record<string, StaffKind> = { 자원봉사자: '자원봉사자', 운영인력: '운영인력' }
const SHIFT_BY_LABEL: Record<string, 'AM' | 'PM'> = { 오전: 'AM', 오후: 'PM' }

export const PERSONNEL_IMPORT_HEADERS = ['이름', '연락처', '구분', '역할', '조', '배치 거점', '외국어']

export async function importPersonnel(rows: Record<string, string>[]): Promise<ImportResult> {
  const zones = rawZones()
  const out: ImportResult = { added: 0, skipped: 0, errors: [] }

  rows.forEach((r, i) => {
    const at = i + 2 // 헤더 1행 + 0-index
    const fail = (m: string) => out.errors.push({ row: at, message: m })

    const kind = KIND_BY_LABEL[r['구분']]
    const role = ROLE_BY_LABEL[r['역할']]
    const shift = SHIFT_BY_LABEL[r['조']]
    const zone = zones.find((z) => z.name === r['배치 거점'])

    if (!r['이름']) return fail('이름이 비었습니다.')
    if (!/^01\d-\d{3,4}-\d{4}$/.test(r['연락처'])) return fail(`연락처 형식이 아닙니다 — ${r['연락처'] || '(빈칸)'}`)
    if (!kind) return fail(`구분은 ${Object.keys(KIND_BY_LABEL).join(' · ')} 중 하나여야 합니다 — ${r['구분'] || '(빈칸)'}`)
    if (!role) return fail(`역할은 ${Object.keys(ROLE_BY_LABEL).join(' · ')} 중 하나여야 합니다 — ${r['역할'] || '(빈칸)'}`)
    if (!shift) return fail(`조는 오전 · 오후 중 하나여야 합니다 — ${r['조'] || '(빈칸)'}`)
    if (!zone) return fail(`없는 거점입니다 — ${r['배치 거점'] || '(빈칸)'}`)
    // 자원봉사자는 봉사자, 운영인력은 거점관리자·현장운영. 섞이면 정산 모수가 조용히 오염된다.
    if ((kind === '자원봉사자') !== (role === '봉사자')) return fail(`${kind}에 ${role} 역할은 맞지 않습니다.`)

    const added = addAssignment({
      personId: `p-imp-${zone.id}-${r['연락처']}-${shift}`,
      personName: r['이름'],
      phone: r['연락처'],
      kind,
      role,
      lang: r['외국어'] ? r['외국어'].split('·').map((s) => s.trim()).filter(Boolean) : [],
      isReserve: false,
      shift,
      zoneId: zone.id,
      // 조에서 파생 — 시드와 같은 규칙(data.ts). 임포트가 다른 시각을 쓰면 같은 조인데
      // 지각 판정 기준이 사람마다 갈린다(D34).
      plannedInMin: kind === '운영인력' ? 8 * 60 + 30 : shift === 'AM' ? 10 * 60 : 14 * 60,
      ...(kind === '운영인력' ? { plannedOutMin: 18 * 60 + 30 } : {}),
      // 자원봉사자 항목은 '아직 아무것도 안 한' 상태로 연다 — 받지 않은 사실을 지어내지 않는다.
      ...(kind === '자원봉사자'
        ? { goods: { jacket: false, bag: false }, payout: { idCard: false, bankbook: false } }
        : {}),
      absentDays: 0,
    })
    if (added) out.added++
    else out.skipped++
  })

  return out
}

export const VENDOR_IMPORT_HEADERS = ['구획', '상호', '주요 품목', '신청 운영시간', '대표 연락처']

export async function importVendors(rows: Record<string, string>[], kind: VendorKind): Promise<ImportResult> {
  const out: ImportResult = { added: 0, skipped: 0, errors: [] }
  // 구비서류 항목은 업체가 정하는 게 아니라 우리가 요구하는 목록이다 — 기존 업체에서 가져온다.
  const docTemplate = rawVendors().find((v) => v.kind === kind)?.docs ?? []

  rows.forEach((r, i) => {
    const at = i + 2
    const fail = (m: string) => out.errors.push({ row: at, message: m })

    if (!r['구획']) return fail('구획이 비었습니다.')
    if (!r['상호']) return fail('상호가 비었습니다.')
    if (!/^01\d-\d{3,4}-\d{4}$/.test(r['대표 연락처']))
      return fail(`대표 연락처 형식이 아닙니다 — ${r['대표 연락처'] || '(빈칸)'}`)

    const added = addVendor({
      name: r['상호'],
      kind,
      items: r['주요 품목'],
      spot: r['구획'],
      opHours: r['신청 운영시간'],
      contact: r['대표 연락처'],
      docs: docTemplate.map((d) => ({ ...d, done: false, at: undefined })),
      registeredAt: opsDate(),
    })
    if (added) out.added++
    else out.skipped++
  })

  return out
}

// ── 스캔(QR = 서명) ─────────────────────────────────────
// ⚠️ 증거 전용 층이다. 아무것도 구동하지 않는다 — 출결도, 물품지급 현황도, 이슈도.
// 스캔이 있는데 물품은 미지급으로 남아 있을 수 있고, 그건 모순이 아니라 설계다.
// 물품지급 현황(GoodsIssue)은 콘솔에서 관리자가 관리하는 마스터로 그대로 둔다.
//
// 이게 옛 순회 랜덤감사(getPatrolCandidates/recordPatrolAudit)를 대체한다. 그건 시스템이
// 대상을 뽑아주고 관리자는 [일치]/[불일치]를 클릭만 했다 — 자리에 앉아서도 통과하는
// 가짜 대면이었다. 이제 그 사람 앞에 가서 찍어야 하고, 불일치는 '스캔 없음 = 기록 없음'
// 으로 표현되며 실제 문제는 관리자가 이슈 보고로 올린다.
//
// 대가: 랜덤성을 잃었다. 관리자가 찍을 사람을 고른다 — 편한 사람만 찍을 여지가 있다.
// 편중은 봉사자별 대면확인 횟수(getScanCounts)로 사후에 드러난다.
//
// 거점 기반이 아니다 — 어디서 찍든 된다. 지오펜스는 게이트가 아니라 기록이다:
// 대상 봉사자의 거점 반경과 대조해 벗어나면 anomaly 를 남기되 스캔 자체는 통과시킨다.
// 기준이 '찍는 사람의 거점'이 아니라 '대상 봉사자의 거점'이라 겸직·순회·슈퍼어드민이
// 전부 특례 없이 처리된다. 대면이므로 찍는 사람의 위치 하나로 양쪽이 증명된다.
export async function recordScan(input: {
  subjectId: string
  scannerId: string | null
  kind: ScanKind
  note?: string
  gps?: Coords
  ts: number
  idempotencyKey: string
}): Promise<boolean> {
  const subject = findAssignment(input.subjectId)
  if (!subject) return false
  const zone = zoneOf(subject.zoneId)
  let anomaly: string | undefined
  if (input.gps && zone) {
    const g = checkGeofence(input.gps, zone.coords, zone.geofenceRadius)
    if (!g.within) anomaly = `${zone.name} 지오펜스(${zone.geofenceRadius}m) 밖 ${g.distance}m — 이상치 기록(차단 아님)`
  }
  return addScan({
    idempotencyKey: input.idempotencyKey,
    subjectId: input.subjectId,
    scannerId: input.scannerId,
    kind: input.kind,
    note: input.note?.trim() || undefined,
    date: getNowDate(),
    timeMin: input.ts,
    gps: input.gps,
    anomaly,
  })
}

// 한 사람에게 남은 서명들(현재 날짜·시각까지). 최신순.
export async function getScansFor(subjectId: string): Promise<ScanEvent[]> {
  const now = getNowMin()
  return rawScans()
    .filter((s) => s.subjectId === subjectId && s.date === getNowDate() && s.timeMin <= now)
    .sort((a, b) => b.timeMin - a.timeMin)
}

// 최근 스캔 피드(현재 날짜·시각까지). 콘솔 대조용.
export async function getRecentScans(limit = 8): Promise<ScanEvent[]> {
  const now = getNowMin()
  return rawScans()
    .filter((s) => s.date === getNowDate() && s.timeMin <= now)
    .sort((a, b) => b.timeMin - a.timeMin)
    .slice(0, limit)
}

// ⚠️ 폐기: getFaceCheckCounts — 봉사자별 대면확인 횟수. 되살리지 말 것.
// #08 §1-4 가 랜덤 감사를 버리면서 '관리자가 찍을 사람을 고른다'의 보완책으로 이 자리를 지목했다:
// 횟수를 노출하면 편중이 드러난다는 것. 화면을 붙이려고 실제 분포를 재보니 편중이 없었다 —
// 3일 누적 55건이 53명에게 흩어져 0회 57명 · 1회 51명 · 2회 2명(배치 110 기준).
// 시드가 라운드로빈(v.AM[d % len])으로 대상을 고르기 때문이다.
// → 110행 중 108행이 0 아니면 1인 컬럼이 된다. 임계도 행동도 없어 장식이다.
// → 0회 57명에 '미확인' 경고를 붙이는 것도 안 된다: 대면확인은 표본 감사고(순회 감사를 대체한 자리)
//    전원 확인 규칙이 없다. 없는 기준을 지어내는 게 된다.
// 편중을 실제로 드러내려면 시드에 편중을 심어야 하는데, 그건 탐지기를 보여주려고 결함을 심는 것이라
// 지어내기다. 관리자가 실제로 편중되게 찍는지 우리는 모른다.
// 개인별 서명 이력은 getScansFor(개인 상세 근태 탭), 전체 흐름은 getRecentScans(통합 운영현황)가 맡는다.

export async function reportIssue(input: {
  type: Issue['type']; zoneId: string | null; note: string; ts: number; idempotencyKey: string
}): Promise<Issue> {
  return addIssue({
    idempotencyKey: input.idempotencyKey, type: input.type, zoneId: input.zoneId,
    status: 'received', time: fmtHM(input.ts), message: input.note,
  })
}

// ── 안전·비상 (중대재해 6-3) ────────────────────────────
export type { SafetyState, HazardItem, Suspension } from './store'
export async function getSafety(): Promise<SafetyState> {
  return rawSafety()
}
// 안전사고·SOS 이슈(현장앱 SOS·순회감사 불일치가 흘러듦).
export async function getSafetyIssues(): Promise<Issue[]> {
  return rawIssues().filter((i) => i.type === '안전사고')
}
// 운영중단 발령/해제 — 현장앱 전파 대상(R3).
// zoneIds 를 비우거나 null 로 주면 전 거점(토털). 사유는 발주처 보고에 그대로 실린다.
export async function declareSuspension(reason: string, zoneIds: string[] | null): Promise<void> {
  setSuspension(true, reason, getNowHM(), zoneIds)
}
export async function liftSuspension(): Promise<void> {
  setSuspension(false, '', null, null)
}

// 이 거점이 운영중단 대상인가 — 콘솔 거점 현황·현장앱 배너가 공유하는 단일 판정(R5).
export function isZoneSuspended(s: SafetyState, zoneId: string | null): boolean {
  if (!s.suspension.active) return false
  if (s.suspension.zoneIds === null) return true // 전 거점
  return zoneId !== null && s.suspension.zoneIds.includes(zoneId)
}
// 위험요인 점검 토글.
export async function toggleHazard(id: string, checked: boolean): Promise<void> {
  setHazard(id, checked, getNowHM())
}
// 사고 초동보고 — 안전사고 이슈로 접수 + 초동조치 메모.
export async function fileIncidentReport(input: {
  zoneId: string; summary: string; firstAction: string; ts: number; idempotencyKey: string
}): Promise<Issue> {
  return addIssue({
    idempotencyKey: input.idempotencyKey, type: '안전사고', zoneId: input.zoneId,
    status: 'in_progress', time: fmtHM(input.ts),
    message: `[초동보고] ${input.summary} · 초동조치: ${input.firstAction}`,
  })
}

// 멱등 조회(호출측 재시도 판단용) — export 표면 유지.

// ── 운영 기준 정보(정적) ─────────────────────────────────
export const OPS_INFO = {
  eventName: '2026 제32회 강릉 ITS 세계총회 부대행사',
  operationDate: '2026-10-21 (수)',
  shiftLabel: '2교대 · 오전 10:00–14:00 / 오후 14:00–18:00 (금 1교대)',
  totalZones: rawZones().length,
}
