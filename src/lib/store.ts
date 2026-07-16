// in-memory 저장소 — 원시 사실만 보관. 파생값(상태·checks·present·KPI)은 저장하지 않는다.
// 화면은 이 파일도 직접 쓰지 않는다(services 경유). store 는 데이터 소유 + 저수준 뮤테이션만.
// 나중에 Supabase 로 교체 시 이 파일이 DB 클라이언트로 바뀌고, services 시그니처는 불변.

import type {
  Coords, EducationKind, EducationRecord, Employment, FoodVendor, GoodsIssue, Issue,
  PayoutInfo, ScanEvent, StaffKind, StaffRole, Zone,
} from '../types'
import { emitChange, getNowDate } from './clock'
import {
  zones as seedZones,
  assignments as seedAssignments,
  events as seedEvents,
  dutyProfiles as seedDutyProfiles,
  scans as seedScans,
  issues as seedIssues,
  notices as seedNotices,
  DEPLOYMENT_PLAN,
  EXPENSE_UNIT_PER_DAY,
  ACTIVITY_GOODS_SETS,
  ACTIVITY_GOODS_UNIT_COST,
  WITHHOLDING_RATE,
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
  shift: 'AM' | 'PM'
  zoneId: string | null
  plannedInMin: number // 예정 출근 시각(분)
  plannedOutMin?: number // 예정 퇴근(분) — 현장운영(본부 상주)만. 봉사자·거점관리자는 조 창(WIN)에서 파생
  standby?: Coords // 예비인력 대기 위치
  goods?: GoodsIssue // 활동물품 지급 현황(마스터)
  payout?: PayoutInfo // 정산 서류·지급계좌(마스터)
  // 정산용 결근 이력(5일 누적, 마스터). 계획일수는 조에서 파생(오전 5일 / 오후 4일 — 금 1교대).
  // 라이브 근태(StoredDutyProfile.noShow)와 별개의 층이다 — 이건 행사 5일 누적 확정 사실이고
  // 정산이 여기 위에 선다. 시드는 둘을 정합시킨다: 지난 날(10/19·20)의 noShow 는 이 값에서
  // 유도되므로 '어제 결근인데 정산은 결근 0일' 같은 모순이 생기지 않는다.
  // 오늘(10/21)의 noShow 는 아직 확정 전(예비 투입으로 메울 수 있다)이라 여기 안 들어온다.
  absentDays?: number
}

// ── 라이브 근태 프로필(날짜별) ──────────────────────────
// 배치(위 StoredAssignment)는 '현황'이라 행사 5일 고정 — 날짜를 갖지 않는다.
// 미출근은 그날그날의 사실이라 여기 얹는다. 이전엔 배치 필드로 붙어 있어서
// 날짜 축이 생기는 순간 '어제도 똑같은 3명이 미출근'이 되는 구조였다.
//
// ⚠️ breaks(휴게) · moving(이동) 폐기 — 되살리지 말 것. 근거는 types.ts 의 DutyStatus.
// 남은 게 noShow 하나뿐이라 이 테이블이 얇아 보이지만, 날짜를 타는 근태 사실이 더 생기면
// 여기가 그 자리다(배치에 붙이면 날짜 축이 다시 깨진다).
export interface StoredDutyProfile {
  assignmentId: string
  date: string
  noShow?: boolean // 미출근(이벤트 없음)
}

// 먹거리 입점업체 등록 레코드 — 시간 비의존 마스터(파생 없음 → FoodVendor 와 동형).
export type StoredVendor = FoodVendor

// 스캔 이벤트(QR = 서명) — 원시 사실 그대로라 도메인 타입과 동형(FoodVendor 와 같은 취급).
// 근태 이벤트(StoredEvent)와 나란히 있지만 다른 물건이다: 저건 '있었다'의 기록이고
// 이건 '받았다·전달했다'의 서명이다. 출결 파생(status·checks)은 이걸 쳐다보지 않는다.
export type StoredScan = ScanEvent

export type EventKind = 'checkin' | 'checkout' | 'hourly' | 'audit'
export interface StoredEvent {
  id: string
  idempotencyKey: string
  assignmentId: string
  kind: EventKind
  date: string // 라이브 사실 — 이벤트만 날짜를 갖는다(현황은 5일 고정)
  timeMin: number
  slot?: number // hourly 슬롯(분)
  gps?: Coords
  anomaly?: string
}

// ── 가변 상태(시드 복제 — 시드 모듈 상수는 불변 유지) ─────
const zones: Zone[] = seedZones.map((z) => ({ ...z }))
const assignments: StoredAssignment[] = seedAssignments.map((a) => ({ ...a }))
const events: StoredEvent[] = seedEvents.map((e) => ({ ...e }))
const dutyProfiles: StoredDutyProfile[] = seedDutyProfiles.map((p) => ({ ...p }))
const scans: StoredScan[] = seedScans.map((sc) => ({ ...sc }))
const issues: Issue[] = seedIssues.map((i) => ({ ...i }))
// 교육 이수 — personId 키(사람 단위). 배치가 아니라 사람에 귀속.
const readiness: Record<string, EducationRecord[]> = Object.fromEntries(
  Object.entries(seedReadiness).map(([k, v]) => [k, v.map((r) => ({ ...r }))])
)
// 서류 배열까지 깊은 복제(시드 상수 불변 유지 — 토글이 시드를 오염시키지 않게).
const vendors: StoredVendor[] = seedVendors.map((v) => ({ ...v, docs: v.docs.map((d) => ({ ...d })) }))

let eventSeq = events.length
let scanSeq = scans.length
let issueSeq = issues.length
let asgSeq = assignments.length
let vendorSeq = vendors.length

// ── 안전 상태 — 운영중단 · 위험요인 점검 ──────────────
export interface HazardItem {
  id: string
  label: string
  checked: boolean
  checkedAt?: string
}

// 운영중단 — 과업지시서는 '작업중지'와 '운영중단'을 나란히 다른 조치로 쓴다. 이 플랫폼에는
// 운영중단만 있다.
//   작업중지: 위험작업(고소·전기·중량물·구조물·야간) 중지. 대상 = 작업자·하도급 종사자.
//             설치·철거에 몰려 있어 이 플랫폼이 다루는 행사 5일(프로덕션) 밖이다.
//             게다가 우리가 '발령'하는 것도 아니다 — 과업지시서는 발주기관·관계기관이 요구하면
//             즉시 이행할 의무로 규정한다. 모델링 대상이 아니라 통째로 뺐다(콘솔 섹션·배너·
//             setWorkStop 전부 삭제). 되살리지 말 것.
//   운영중단: 거점 운영 중지. 대상 = 거기 서 있는 자원봉사자·거점관리자 → 현장앱에 전파해야 한다.
//
// 범위가 핵심이다. 이전 모델(weatherStop: boolean)은 전역이라 '강풍인데 실내 거점만 살린다'가
// 표현 불가능했고, 콘솔은 "야외 거점(해변·포토존) 운영중단을 일괄 전파"라 써놓고 거점을 고를
// 수단이 없어 스스로 모순이었다.
//   zoneIds: null   전 거점(토털) — 국가 비상사태·애도 등. 확률은 낮아도 무시할 수 없다
//   zoneIds: [...]  해당 거점만 — 기상특보(해변·포토존은 닫고 박물관은 운영)·시설물 이상
//
// 발령은 런타임 이벤트다 — 전날 예고가 아니라 행사 당일 오후, 이미 배치된 인원이 거점에 서 있는
// 상태에서 떨어진다(선례). 그래서 at(발령 시각)이 기록되고 현장앱에 즉시 닿아야 한다.
export interface Suspension {
  active: boolean
  reason: string
  at: string | null // HH:mm 발령 시각
  zoneIds: string[] | null // null = 전 거점
}

export interface SafetyState {
  suspension: Suspension // 운영중단 발령 — 현장앱 전파 대상
  hazards: HazardItem[] // 위험요인 점검표
}
const safety: SafetyState = {
  suspension: { active: false, reason: '', at: null, zoneIds: null },
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

// zoneIds: null = 전 거점. 해제하면 범위도 같이 지운다(잔상이 남으면 다음 발령이 오염된다).
export function setSuspension(active: boolean, reason: string, at: string | null, zoneIds: string[] | null): void {
  safety.suspension = active
    ? { active: true, reason, at, zoneIds: zoneIds?.length ? zoneIds : null }
    : { active: false, reason: '', at: null, zoneIds: null }
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
// 그날의 근태 프로필. 없으면 undefined = 평범하게 나와서 평범하게 일한 날.
export const dutyProfileOf = (assignmentId: string, date: string): StoredDutyProfile | undefined =>
  dutyProfiles.find((p) => p.assignmentId === assignmentId && p.date === date)
export const rawScans = (): StoredScan[] => scans
export const hasScanKey = (idempotencyKey: string): boolean =>
  scans.some((s) => s.idempotencyKey === idempotencyKey)
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

// 운영일(YYYY-MM-DD) — 물품 지급일·서류 등록일 등 마스터 기록의 스탬프.
// 시계의 현재 날짜를 따른다: 스크러버를 10/20 로 밀고 물품을 지급하면 10/20 으로 찍혀야 한다.
export const opsDate = () => getNowDate()
export const rawVendors = (): StoredVendor[] => vendors
export const foodParasols = () => FOOD_PARASOLS
// 내부 전용 — setVendorDoc 만 쓴다(services 의 getFoodVendor 는 소비자 0 이라 폐기).
const findVendor = (id: string): StoredVendor | undefined => vendors.find((v) => v.id === id)

export const findAssignment = (id: string): StoredAssignment | undefined =>
  assignments.find((a) => a.id === id)
export const zoneOf = (id: string | null): Zone | undefined =>
  id ? zones.find((z) => z.id === id) : undefined

// 멱등 — 같은 키 이벤트가 이미 있으면 참.
// 내부 전용 — addEvent 의 멱등 가드. services 의 isDuplicateEvent 래퍼는 소비자 0 이라 폐기했다.
const hasEventKey = (idempotencyKey: string): boolean =>
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

// 스캔 기록(QR = 서명). 멱등키 중복이면 무시(R4) — 같은 코드를 두 번 찍어도 서명은 하나다.
export function addScan(sc: Omit<StoredScan, 'id'>): boolean {
  if (hasScanKey(sc.idempotencyKey)) return false
  scanSeq++
  scans.push({ ...sc, id: `sc-${scanSeq}` })
  emitChange()
  return true
}

// ── 명부·업체 신규 등록(엑셀 임포트 전용 경로) ──────────
// 시드가 유일한 명부 소스였다 — 런타임에 사람이 늘어난 적이 없다. 여기가 그 첫 경로다.
//
// 멱등키(R4)는 addEvent·addScan 과 같은 뜻이지만 키를 밖에서 받지 않고 행에서 만든다.
// 임포트 파일엔 우리가 발급한 id 가 없다(사람이 엑셀에 채워 넣은 행이다) — 같은 파일을 두 번
// 올려도 명부가 두 배가 되지 않으려면 '무엇이 같은 행인가'를 데이터로 판정해야 한다.
//
// 사람 키가 연락처만이 아닌 이유: 한 사람이 배치를 여럿 가진다(personId ≠ 배치 id).
// 연락처로만 막으면 '오전조 김OO'를 넣은 뒤 '오후조 김OO'가 중복으로 튕긴다.
const rosterKey = (a: Pick<StoredAssignment, 'phone' | 'shift' | 'zoneId'>): string =>
  `${a.phone}|${a.shift}|${a.zoneId ?? 'reserve'}`

export function addAssignment(input: Omit<StoredAssignment, 'id'>): boolean {
  if (assignments.some((a) => rosterKey(a) === rosterKey(input))) return false
  asgSeq++
  assignments.push({ ...input, id: `as-${asgSeq}` })
  emitChange()
  return true
}

// 업체 키 = 구획. 자리는 하나뿐이라 같은 구획에 두 업체가 설 수 없다.
export function addVendor(input: Omit<StoredVendor, 'id'>): boolean {
  if (vendors.some((v) => v.spot === input.spot)) return false
  vendorSeq++
  vendors.push({ ...input, id: `fv-${vendorSeq}`, docs: input.docs.map((d) => ({ ...d })) })
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

// ⚠️ 폐기: revokeEducation(이수 취소) — '인증과 대칭으로 열어둔다'며 만들었는데 소비자가 0이었다.
// 대칭은 설계 근거가 아니다. 이수 처리는 인력 현황의 일괄 인증 한 방향뿐이고, 취소 동선은 화면에 없다.
// 취소가 필요해지면 그때 화면과 같이 만들 것.

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
