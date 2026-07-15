// 서비스 레이어 — 화면은 오직 이 함수들만 호출한다(R1). 전부 async(R2).
// 저장소는 원시 사실만 보관하고, '현재 시각'(clock) 기준 파생값은 전부 여기서 계산한다(R5).
// 쓰기는 명령형 함수(R3) + 멱등키(R4). 나중에 Supabase 로 교체해도 이 시그니처는 불변.

import { getNowMin, getNowHM, fmtHM } from './clock'
import { distanceM } from './geo'
import {
  rawZones,
  rawAssignments,
  rawEvents,
  rawIssues,
  rawNotices,
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
  revokeEducation,
  rawVendors,
  findVendor,
  foodParasols,
  setVendorDoc,
  placeReserve,
  hasEventKey,
  rawSafety,
  setWorkStop,
  setSuspension,
  setHazard,
} from './store'
import type { StoredAssignment, StoredEvent, SafetyState } from './store'
import type {
  Zone,
  Assignment,
  AttendanceEvent,
  DutyLogEntry,
  Issue,
  Notice,
  Audience,
  StaffKind,
  OpsAlert,
  KpiSummary,
  ExpenseSummary,
  Shift,
  DutyStatus,
  CheckState,
  CheckMethod,
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

const activeShiftAt = (now: number): Shift => (now < WIN.PM.start ? 'AM' : 'PM')
export const shiftLabel = (s: Shift): string => (s === 'AM' ? '오전조' : '오후조')
export function getShiftSlots(s: Shift): string[] {
  return SLOTS[s].map(fmtHM)
}
export const shiftSlotMins = (s: Shift): number[] => SLOTS[s]
export const shiftWindow = (s: Shift) => WIN[s]

// ── 파생 헬퍼 ───────────────────────────────────────────
const eventsOf = (id: string): StoredEvent[] => rawEvents().filter((e) => e.assignmentId === id)
const inWindow = (w?: { startMin: number; endMin: number }, t?: number) =>
  !!w && t !== undefined && t >= w.startMin && t < w.endMin
const inBreak = (a: StoredAssignment, t: number) => (a.breaks ?? []).some((b) => inWindow(b, t))

// 원시 배치 → 현재 시각 기준 도메인 Assignment(상태·checks·출퇴근 파생).
function derive(a: StoredAssignment, now: number): Assignment {
  // 예비인력(미배정) — 대기 상태, 정시체크 없음.
  if (a.isReserve && !a.zoneId) {
    return {
      id: a.id, personId: a.personId, personName: a.personName, zoneId: null,
      kind: a.kind, role: a.role, employment: a.employment, shift: a.shift,
      date: a.date, isReserve: true, status: 'before', lang: a.lang, phone: a.phone, checks: [],
      standby: a.standby, goods: a.goods,
    }
  }

  // 운영인력·현장운영 — 운영본부 상주. 거점 배치도 정시체크도 없고 2교대에 속하지 않는다.
  // 근태는 예정 출퇴근(10시간 상주)으로만 파생한다.
  // 운영인력(거점관리자·현장운영)은 교대가 아니라 1일 10시간 상주 — 조 슬롯이 아니라
  // plannedIn/OutMin 으로만 근태를 파생하고, 정시체크(checks)는 자원봉사자 관제 항목이라 비운다.
  // 거점관리자는 거점에 상주하므로 zoneId 를 유지한다(현장운영은 애초에 null).
  if (a.kind === '운영인력' && a.plannedOutMin !== undefined) {
    const status: DutyStatus =
      now < a.plannedInMin ? 'before' : now >= a.plannedOutMin ? 'off' : 'on'
    return {
      id: a.id, personId: a.personId, personName: a.personName, zoneId: a.zoneId,
      kind: a.kind, role: a.role, employment: a.employment, shift: a.shift,
      date: a.date, isReserve: false, status, lang: a.lang, phone: a.phone, checks: [],
      checkedInAt: now >= a.plannedInMin ? fmtHM(a.plannedInMin) : undefined,
      checkedOutAt: now >= a.plannedOutMin ? fmtHM(a.plannedOutMin) : undefined,
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
  if (a.noShow || (!checkedIn && now >= a.plannedInMin + GRACE)) status = 'absent'
  else if (!checkedIn) status = 'before'
  else if (checkedOut || now >= win.end) status = 'off'
  else if (inBreak(a, now)) status = 'break'
  else if (inWindow(a.moving, now)) status = 'moving'
  else status = 'on'

  // checks — 조 슬롯 중 현재 시각까지 지난(due) 것만. 미래 슬롯은 미포함(개인상세가 '예정'으로 표시).
  const checks: CheckState[] = []
  for (const slot of SLOTS[a.shift]) {
    if (slot > now) break
    if (status === 'absent') { checks.push('absent'); continue }
    if (inBreak(a, slot)) { checks.push('break'); continue }
    const hit = evs.some((e) => e.kind === 'hourly' && e.slot === slot && e.timeMin <= now)
    checks.push(hit ? 'ok' : checkedIn ? 'missed' : 'absent')
  }

  return {
    id: a.id, personId: a.personId, personName: a.personName, zoneId: a.zoneId,
    kind: a.kind, role: a.role, employment: a.employment, shift: a.shift,
    date: a.date, isReserve: a.isReserve, status, lang: a.lang, phone: a.phone,
    checkedInAt: checkedIn ? fmtHM(checkinEv!.timeMin) : undefined,
    checkedOutAt: checkedOut ? fmtHM(checkoutEv!.timeMin) : undefined,
    checks,
    standby: a.standby, goods: a.goods,
  }
}

const roster = (now: number): Assignment[] => rawAssignments().map((a) => derive(a, now))
const isPresent = (s: DutyStatus) => s === 'on' || s === 'break' || s === 'moving'

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
export const getRoster = getAssignments
export async function getAssignment(id: string): Promise<Assignment | undefined> {
  const a = findAssignment(id)
  return a ? derive(a, getNowMin()) : undefined
}
export async function getReserves(): Promise<Assignment[]> {
  return roster(getNowMin()).filter((a) => a.isReserve)
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
  role: string
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
  if (!a || a.noShow) return []
  const now = getNowMin()
  const entries: DutyLogEntry[] = []
  for (const e of eventsOf(a.id)) {
    if (e.timeMin > now) continue
    if (e.kind === 'checkin')
      entries.push({ time: fmtHM(e.timeMin), label: '출근 체크인', status: 'on', via: e.method, note: e.anomaly })
    else if (e.kind === 'checkout')
      entries.push({ time: fmtHM(e.timeMin), label: '퇴근', status: 'off', via: e.method })
    else if (e.kind === 'audit')
      entries.push({ time: fmtHM(e.timeMin), label: e.anomaly ? '순회 감사 — 불일치' : '순회 감사 — 정위치 확인', status: 'on', note: e.anomaly })
    else
      entries.push({ time: fmtHM(e.timeMin), label: `정시(1h) 체크 ${fmtHM(e.slot ?? e.timeMin)}`, status: 'on', via: e.method })
  }
  for (const b of a.breaks ?? []) {
    if (b.startMin <= now) entries.push({ time: fmtHM(b.startMin), label: '휴게 시작', status: 'break', note: b.note })
    if (b.endMin <= now) entries.push({ time: fmtHM(b.endMin), label: '휴게 종료·복귀', status: 'on' })
  }
  if (a.moving && a.moving.startMin <= now)
    entries.push({ time: fmtHM(a.moving.startMin), label: '거점 간 이동', status: 'moving', note: a.moving.note })
  return entries.sort((x, y) => hm(x.time) - hm(y.time))
}

// 실시간 출결 피드 — 최근 체크인·정시체크 이벤트(현재 시각 이하).
export async function getAttendanceEvents(): Promise<AttendanceEvent[]> {
  const now = getNowMin()
  return rawEvents()
    .filter((e) => (e.kind === 'checkin' || e.kind === 'hourly') && e.timeMin <= now)
    .sort((x, y) => y.timeMin - x.timeMin)
    .slice(0, 6)
    .map((e) => {
      const a = findAssignment(e.assignmentId)
      return {
        id: e.id, idempotencyKey: e.idempotencyKey, personName: a?.personName ?? '—',
        zoneId: e.assignmentId && a?.zoneId ? a.zoneId : '', method: (e.method ?? 'scan') as CheckMethod,
        time: fmtHM(e.timeMin), gps: e.gps, anomaly: e.anomaly,
      }
    })
}

export async function getIssues(): Promise<Issue[]> {
  return rawIssues()
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
export function matchesAudience(
  person: { kind: StaffKind; role: StaffRole; zoneId: string | null },
  aud: Audience,
): boolean {
  if (aud.kinds?.length && !aud.kinds.includes(person.kind)) return false
  if (aud.roles?.length && !aud.roles.includes(person.role)) return false
  // 거점을 지목한 공지는 거점 없는 인력(현장운영·예비)에게 가지 않는다.
  if (aud.zoneIds?.length && (person.zoneId === null || !aud.zoneIds.includes(person.zoneId))) return false
  return true
}

// 특정 배치(=사람)가 받아야 할 공지 — 현장앱 수신함.
// 주소(audience)로 한 번, 발령 시각으로 한 번 거른다.
export async function getNoticesFor(assignmentId: string): Promise<Notice[]> {
  const a = rawAssignments().find((x) => x.id === assignmentId)
  if (!a) return []
  return issuedNotices(getNowMin()).filter((n) => matchesAudience(a, n.audience))
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

// 충원율(현재 조) — present / expected.
export async function computeFillRate(): Promise<number> {
  const now = getNowMin()
  const shift = activeShiftAt(now)
  const list = roster(now).filter((a) => !a.isReserve && a.shift === shift)
  const present = list.filter((a) => isPresent(a.status)).length
  return list.length ? Math.round((present / list.length) * 100) : 0
}

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
export function dailyWageWithholding(dailyWage: number, workedDays: number): number {
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
  const alerts: OpsAlert[] = []

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
  const order = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.level] - order[b.level])
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
    onDuty: cur.filter((a) => a.status === 'on').length,
    breakOrMoving: cur.filter((a) => a.status === 'break' || a.status === 'moving').length,
    absent: cur.filter((a) => a.status === 'absent').length,
    gapAlerts: gaps.length,
    reserveAvailable: list.filter((a) => a.isReserve && !a.zoneId).length,
    minsSinceShiftStart: Math.max(0, now - WIN[shift].start),
  }
}

// ── 쓰기(명령형, R3 + 멱등 R4) ──────────────────────────
type CheckInMethod = 'QR' | 'GPS'
const toCheckMethod = (m: CheckInMethod): CheckMethod => (m === 'QR' ? 'scan' : 'gps')

export async function checkIn(
  assignmentId: string,
  opts: { method: CheckInMethod; gps?: Coords; ts: number; idempotencyKey: string; anomaly?: string }
): Promise<boolean> {
  return addEvent({
    idempotencyKey: opts.idempotencyKey, assignmentId, kind: 'checkin',
    timeMin: opts.ts, method: toCheckMethod(opts.method), gps: opts.gps, anomaly: opts.anomaly,
  })
}

export async function checkOut(
  assignmentId: string,
  opts: { ts: number; idempotencyKey: string }
): Promise<boolean> {
  return addEvent({ idempotencyKey: opts.idempotencyKey, assignmentId, kind: 'checkout', timeMin: opts.ts })
}

export async function hourlyCheck(
  assignmentId: string,
  opts: { slot: number; gps?: Coords; ts: number; idempotencyKey: string }
): Promise<boolean> {
  return addEvent({
    idempotencyKey: opts.idempotencyKey, assignmentId, kind: 'hourly',
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
  const method: CheckMethod = zoneOf(zoneId)?.checkMode === 'self_gps' ? 'gps' : 'scan'
  addEvent({
    idempotencyKey: `assign:${reserveAssignmentId}:${zoneId}:${now}`,
    assignmentId: reserveAssignmentId, kind: 'checkin', timeMin: now, method,
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

export async function getPersonnelRecord(id: string): Promise<PersonnelRecord | undefined> {
  const a = findAssignment(id)
  return a ? toPersonnel(a) : undefined
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

export async function revokeEducationOf(personId: string, kind: EducationKind): Promise<boolean> {
  return revokeEducation(personId, kind)
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

export async function getFoodVendor(id: string): Promise<FoodVendor | undefined> {
  return findVendor(id)
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

// 순회 랜덤감사 — 무인(관광지) 거점 셀프체크 무결성의 3번째 층(핸드오프 §3).
// 대상 후보 = 현재 근무 중인 무인 거점 인력.
// 순회 감사 대상 = 셀프체크(GPS) 거점의 자원봉사자. 검증하려는 건 '셀프체크 무결성'이므로
// 셀프체크를 하지 않는 운영인력은 대상이 아니다 — kind 를 안 가리면 관광 거점에 상주하는
// 거점관리자가 자기들끼리 감사 대상으로 잡힌다(전 거점 관리자 배치 이후 발생).
export async function getPatrolCandidates(): Promise<Assignment[]> {
  const now = getNowMin()
  return roster(now).filter(
    (a) =>
      !a.isReserve &&
      a.kind === '자원봉사자' &&
      isPresent(a.status) &&
      zoneOf(a.zoneId)?.checkMode === 'self_gps'
  )
}

// 감사 결과 기록. mismatch(불일치)면 audit 이벤트에 사유 + 운영본부 이슈 접수.
export async function recordPatrolAudit(
  assignmentId: string,
  opts: { result: 'ok' | 'mismatch'; ts: number; idempotencyKey: string }
): Promise<boolean> {
  const anomaly = opts.result === 'mismatch' ? '순회감사 불일치 — 위치·본인 확인 필요' : undefined
  const ok = addEvent({ idempotencyKey: opts.idempotencyKey, assignmentId, kind: 'audit', timeMin: opts.ts, anomaly })
  if (opts.result === 'mismatch') {
    const a = findAssignment(assignmentId)
    addIssue({
      idempotencyKey: `${opts.idempotencyKey}:issue`, type: '안전사고',
      zoneId: a?.zoneId ?? '', status: 'received', time: fmtHM(opts.ts),
      message: `순회감사 불일치 — ${a?.personName ?? assignmentId} 위치·본인 확인 필요`,
    })
  }
  return ok
}

export async function reportIssue(input: {
  type: Issue['type']; zoneId: string; note: string; ts: number; idempotencyKey: string
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
// 작업중지 발령/해제 — 중대재해 6-3 핵심.
export async function declareWorkStop(reason: string): Promise<void> {
  setWorkStop(true, reason, getNowHM())
}
export async function liftWorkStop(): Promise<void> {
  setWorkStop(false, '', null)
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
export const isDuplicateEvent = (idempotencyKey: string): boolean => hasEventKey(idempotencyKey)

// ── 운영 기준 정보(정적) ─────────────────────────────────
export const OPS_INFO = {
  eventName: '2026 제32회 강릉 ITS 세계총회 부대행사',
  operationDate: '2026-10-21 (수)',
  shiftLabel: '2교대 · 오전 10:00–14:00 / 오후 14:00–18:00 (금 1교대)',
  totalZones: rawZones().length,
}
