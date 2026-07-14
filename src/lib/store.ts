// in-memory 저장소 — 원시 사실만 보관. 파생값(상태·checks·present·KPI)은 저장하지 않는다.
// 화면은 이 파일도 직접 쓰지 않는다(services 경유). store 는 데이터 소유 + 저수준 뮤테이션만.
// 나중에 Supabase 로 교체 시 이 파일이 DB 클라이언트로 바뀌고, services 시그니처는 불변.

import type { Coords, CheckMethod, GoodsIssue, Issue, Zone } from '../types'
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
} from '../mock/data'

// ── 저장 스키마(원시 사실) ──────────────────────────────
export interface StoredAssignment {
  id: string
  personName: string
  phone: string
  role: '봉사자' | '거점관리자' | '운영인력'
  lang?: string[]
  isReserve: boolean
  date: string
  shift: 'AM' | 'PM'
  zoneId: string | null
  plannedInMin: number // 예정 출근 시각(분)
  breaks?: { startMin: number; endMin: number; note?: string }[]
  moving?: { startMin: number; endMin: number; note?: string }
  noShow?: boolean // 미출근(이벤트 없음)
  standby?: Coords // 예비인력 대기 위치
  goods?: GoodsIssue // 활동물품 지급 현황(마스터)
}

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
