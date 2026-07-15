// in-memory 저장소 — 원시 사실만 보관. 파생값(상태·checks·present·KPI)은 저장하지 않는다.
// 화면은 이 파일도 직접 쓰지 않는다(services 경유). store 는 데이터 소유 + 저수준 뮤테이션만.
// 나중에 Supabase 로 교체 시 이 파일이 DB 클라이언트로 바뀌고, services 시그니처는 불변.

import type {
  Coords, CheckMethod, EducationKind, EducationRecord, Employment, FoodVendor, GoodsIssue, Issue,
  PayoutInfo, StaffKind, StaffRole, Zone,
} from '../types'
import { emitChange } from './clock'
import {
  zones as seedZones,
  assignments as seedAssignments,
  events as seedEvents,
  issues as seedIssues,
  notices as seedNotices,
  DEPLOYMENT_PLAN,
  EXPENSE_UNIT_PER_DAY,
  ACTIVITY_GOODS_SETS,
  ACTIVITY_GOODS_UNIT_COST,
  WITHHOLDING_RATE,
  SEED_DATE,
  foodVendors as seedVendors,
  FOOD_PARASOLS,
  readiness as seedReadiness,
  STAFF_HOURLY_WAGE,
  STAFF_HOURS_PER_DAY,
  DAILY_WAGE_DEDUCTION,
  DAILY_WAGE_TAX_RATE,
} from '../mock/data'

// ── 저장 스키마(원시 사실) ──────────────────────────────
export interface StoredAssignment {
  id: string
  personId: string // 사람 단위 키 — 교육 이수는 이 키에 귀속(배치 id 아님)
  personName: string
  phone: string
  kind: StaffKind // 자원봉사자 | 운영인력 — 정산 방식·발주처 보고 경계가 여기서 갈린다
  role: StaffRole // 봉사자 | 거점관리자 | 현장운영
  employment?: Employment // 운영인력만 — 직원(급여·미산정) | 일용(시급×시간)
  lang?: string[]
  isReserve: boolean
  date: string
  shift: 'AM' | 'PM'
  zoneId: string | null
  plannedInMin: number // 예정 출근 시각(분)
  plannedOutMin?: number // 예정 퇴근(분) — 현장운영(본부 상주)만. 봉사자·거점관리자는 조 창(WIN)에서 파생
  breaks?: { startMin: number; endMin: number; note?: string }[]
  moving?: { startMin: number; endMin: number; note?: string }
  noShow?: boolean // 미출근(이벤트 없음)
  standby?: Coords // 예비인력 대기 위치
  goods?: GoodsIssue // 활동물품 지급 현황(마스터)
  payout?: PayoutInfo // 정산 서류·지급계좌(마스터)
  // 정산용 결근 이력(5일 누적, 마스터). 계획일수는 조에서 파생(오전 5일 / 오후 4일 — 금 1교대).
  // 오늘의 실시간 미출근(noShow)과 별개 — 이건 행사 기간 누적 사실이다.
  absentDays?: number
}

// 먹거리 입점업체 등록 레코드 — 시간 비의존 마스터(파생 없음 → FoodVendor 와 동형).
export type StoredVendor = FoodVendor

export type EventKind = 'checkin' | 'checkout' | 'hourly' | 'audit'
export interface StoredEvent {
  id: string
  idempotencyKey: string
  assignmentId: string
  kind: EventKind
  timeMin: number
  method?: CheckMethod
  slot?: number // hourly 슬롯(분)
  gps?: Coords
  anomaly?: string
}

// ── 가변 상태(시드 복제 — 시드 모듈 상수는 불변 유지) ─────
const zones: Zone[] = seedZones.map((z) => ({ ...z }))
const assignments: StoredAssignment[] = seedAssignments.map((a) => ({ ...a }))
const events: StoredEvent[] = seedEvents.map((e) => ({ ...e }))
const issues: Issue[] = seedIssues.map((i) => ({ ...i }))
// 교육 이수 — personId 키(사람 단위). 배치가 아니라 사람에 귀속.
const readiness: Record<string, EducationRecord[]> = Object.fromEntries(
  Object.entries(seedReadiness).map(([k, v]) => [k, v.map((r) => ({ ...r }))])
)
// 서류 배열까지 깊은 복제(시드 상수 불변 유지 — 토글이 시드를 오염시키지 않게).
const vendors: StoredVendor[] = seedVendors.map((v) => ({ ...v, docs: v.docs.map((d) => ({ ...d })) }))

let eventSeq = events.length
let issueSeq = issues.length

// ── 안전 상태(중대재해 6-3) — 작업중지·위험요인 점검·기상특보 ──
export interface HazardItem {
  id: string
  label: string
  checked: boolean
  checkedAt?: string
}
export interface SafetyState {
  workStop: { active: boolean; reason: string; at: string | null } // 작업중지 발령
  weatherStop: { active: boolean; at: string | null } // 기상특보 야외운영중단
  hazards: HazardItem[] // 위험요인 점검표
}
const safety: SafetyState = {
  workStop: { active: false, reason: '', at: null },
  weatherStop: { active: false, at: null },
  hazards: [
    { id: 'hz-elec', label: '전기·발전기 배선 접지·절연 상태', checked: true, checkedAt: '09:30' },
    { id: 'hz-struct', label: '무대·천막·구조물 결속·전도 방지', checked: true, checkedAt: '09:35' },
    { id: 'hz-path', label: '보행 동선·비상통로 확보', checked: true, checkedAt: '09:40' },
    { id: 'hz-fire', label: '소화기·소화전·비상구 위치 점검', checked: true, checkedAt: '09:42' },
    { id: 'hz-med', label: '응급의료·제세동기(AED) 대기 상태', checked: false },
    { id: 'hz-wind', label: '강풍·기상 악화 대비 야외물 고정', checked: false },
  ],
}
export const rawSafety = (): SafetyState => safety

export function setWorkStop(active: boolean, reason: string, at: string | null): void {
  safety.workStop = { active, reason: active ? reason : '', at: active ? at : null }
  emitChange()
}
export function setWeatherStop(active: boolean, at: string | null): void {
  safety.weatherStop = { active, at: active ? at : null }
  emitChange()
}
export function setHazard(id: string, checked: boolean, at: string | null): void {
  const h = safety.hazards.find((x) => x.id === id)
  if (!h) return
  h.checked = checked
  h.checkedAt = checked ? at ?? undefined : undefined
  emitChange()
}

// ── 읽기(store 내부 원시 — services 만 호출) ──────────────
export const rawZones = (): Zone[] => zones
export const rawAssignments = (): StoredAssignment[] => assignments
export const rawEvents = (): StoredEvent[] => events
export const rawIssues = (): Issue[] => issues
export const rawNotices = () => seedNotices
export const deploymentPlan = () => DEPLOYMENT_PLAN
export const expenseUnitPerDay = () => EXPENSE_UNIT_PER_DAY
export const activityGoodsSets = () => ACTIVITY_GOODS_SETS

// 물품 세트 단가 — 사용자 입력값. 이 한 값이 일일 지급기준·실지급 총액을 결정한다.
let goodsUnitCost = ACTIVITY_GOODS_UNIT_COST
export const activityGoodsUnitCost = () => goodsUnitCost
export function setGoodsUnitCost(won: number): void {
  goodsUnitCost = Math.max(0, Math.round(won))
  emitChange()
}

// 원천징수율(%) — 사용자 입력값. 기본 3.3%(사업소득 3% + 지방소득세 0.3%).
// 현물(활동물품)은 원천징수 대상이 아니므로 일당(현금) 부분에만 적용한다.
let withholdingRate = WITHHOLDING_RATE
export const withholding = () => withholdingRate
export function setWithholdingRate(pct: number): void {
  withholdingRate = Math.min(100, Math.max(0, pct))
  emitChange()
}
// 운영인력 일용 — 시급 × 1일 근무시간 = 일급. 둘 다 사용자 입력값(자원봉사자의 물품단가와 같은 취급).
// 시급을 올려 일급이 15만원을 넘기면 일용근로소득 원천징수가 살아난다 → 화면에서 반응이 보인다.
let staffHourlyWage = STAFF_HOURLY_WAGE
export const staffWage = () => staffHourlyWage
export function setStaffHourlyWage(won: number): void {
  staffHourlyWage = Math.max(0, Math.round(won))
  emitChange()
}
let staffHours = STAFF_HOURS_PER_DAY
export const staffHoursPerDay = () => staffHours
export function setStaffHoursPerDay(h: number): void {
  staffHours = Math.min(24, Math.max(0, h))
  emitChange()
}
export const dailyWageDeduction = () => DAILY_WAGE_DEDUCTION
export const dailyWageTaxRate = () => DAILY_WAGE_TAX_RATE

export const opsDate = () => SEED_DATE // 운영일(YYYY-MM-DD) — 물품 지급일 등 마스터 기록용
export const rawVendors = (): StoredVendor[] => vendors
export const foodParasols = () => FOOD_PARASOLS
export const findVendor = (id: string): StoredVendor | undefined => vendors.find((v) => v.id === id)

export const findAssignment = (id: string): StoredAssignment | undefined =>
  assignments.find((a) => a.id === id)
export const zoneOf = (id: string | null): Zone | undefined =>
  id ? zones.find((z) => z.id === id) : undefined

// 멱등 — 같은 키 이벤트가 이미 있으면 참.
export const hasEventKey = (idempotencyKey: string): boolean =>
  events.some((e) => e.idempotencyKey === idempotencyKey)

// ── 저수준 뮤테이션(멱등 + 통지) ────────────────────────
// 새 이벤트 기록. 멱등키 중복이면 무시(중복 방지, R4). 기록 시 true.
export function addEvent(ev: Omit<StoredEvent, 'id'>): boolean {
  if (hasEventKey(ev.idempotencyKey)) return false
  eventSeq++
  events.push({ ...ev, id: `ev-${eventSeq}` })
  emitChange()
  return true
}

// 예비인력을 거점에 투입(B 플로우). 배정 + 즉시 체크인 이벤트는 services 가 addEvent 로.
export function placeReserve(reserveId: string, zoneId: string, shift: 'AM' | 'PM'): boolean {
  const a = findAssignment(reserveId)
  if (!a || !a.isReserve || a.zoneId) return false
  a.zoneId = zoneId
  a.shift = shift
  a.isReserve = false // 이제 정규 배치로 편입
  emitChange()
  return true
}

// 활동물품 지급 토글(마스터 데이터 — 시간 비의존). 둘 다 미지급이면 지급일 소거.
export function setGoods(id: string, patch: Partial<Omit<GoodsIssue, 'issuedAt'>>, at: string): boolean {
  const a = findAssignment(id)
  if (!a) return false
  const next: GoodsIssue = { jacket: false, bag: false, ...a.goods, ...patch }
  next.issuedAt = next.jacket || next.bag ? a.goods?.issuedAt ?? at : undefined
  a.goods = next
  emitChange()
  return true
}

export const rawReadiness = (): Record<string, EducationRecord[]> => readiness
export const educationOf = (personId: string): EducationRecord[] => readiness[personId] ?? []

// 교육 이수 일괄 인증 — 오프라인 통합교육 참석자 여러 명을 한 번에 처리(이 기능의 핵심).
// 이미 같은 교육을 이수한 사람은 건너뛴다(중복 기록 방지). 처리된 인원 수를 반환.
export function certifyEducation(
  personIds: string[],
  kind: EducationKind,
  certifiedBy: string,
  certifiedAt: string
): number {
  let n = 0
  for (const pid of personIds) {
    const recs = readiness[pid] ?? (readiness[pid] = [])
    if (recs.some((r) => r.kind === kind)) continue
    recs.push({ kind, certifiedBy, certifiedAt })
    n++
  }
  if (n) emitChange()
  return n
}

// 이수 취소(오기입 정정). 인증과 대칭으로 열어둔다.
export function revokeEducation(personId: string, kind: EducationKind): boolean {
  const recs = readiness[personId]
  if (!recs) return false
  const i = recs.findIndex((r) => r.kind === kind)
  if (i < 0) return false
  recs.splice(i, 1)
  emitChange()
  return true
}

// 정산 서류·지급계좌 등록(마스터). 서류·계좌가 하나라도 들어오면 등록일을 찍는다.
export function setPayout(id: string, patch: Partial<PayoutInfo>, at: string): boolean {
  const a = findAssignment(id)
  if (!a) return false
  const next: PayoutInfo = { idCard: false, bankbook: false, ...a.payout, ...patch }
  const any = next.idCard || next.bankbook || !!next.accountNo
  next.registeredAt = any ? a.payout?.registeredAt ?? at : undefined
  a.payout = next
  emitChange()
  return true
}

// 입점업체 구비서류 등록/해제 토글(마스터 — 시간 비의존).
export function setVendorDoc(vendorId: string, docId: string, done: boolean, at: string): boolean {
  const d = findVendor(vendorId)?.docs.find((x) => x.id === docId)
  if (!d) return false
  d.done = done
  d.at = done ? d.at ?? at : undefined
  emitChange()
  return true
}

// 이슈 상태 전이(접수→처리중→완료).
export function setIssueStatus(id: string, status: Issue['status']): void {
  const i = issues.find((x) => x.id === id)
  if (!i) return
  i.status = status
  emitChange()
}

// 이슈 접수(멱등). 기록 시 생성된 Issue 반환, 중복이면 기존 반환.
export function addIssue(input: Omit<Issue, 'id'>): Issue {
  if (input.idempotencyKey) {
    const dup = issues.find((i) => i.idempotencyKey === input.idempotencyKey)
    if (dup) return dup
  }
  issueSeq++
  const issue: Issue = { ...input, id: `is-${issueSeq}` }
  issues.unshift(issue)
  emitChange()
  return issue
}
