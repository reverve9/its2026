// 서비스 레이어 — 화면은 오직 이 함수들만 호출한다(R1). 전부 async(R2).
// 저장소는 원시 사실만 보관하고, '현재 시각'(clock) 기준 파생값은 전부 여기서 계산한다(R5).
// 쓰기는 명령형 함수(R3) + 멱등키(R4). 나중에 Supabase 로 교체해도 이 시그니처는 불변.

import { getNowMin, fmtHM } from './clock'
import {
  rawZones,
  rawAssignments,
  rawEvents,
  rawIssues,
  rawNotices,
  deploymentPlan,
  expenseUnitPerDay,
  activityGoodsSets,
  findAssignment,
  zoneOf,
  addEvent,
  addIssue,
  placeReserve,
  hasEventKey,
} from './store'
import type { StoredAssignment, StoredEvent } from './store'
import type {
  Zone,
  Assignment,
  AttendanceEvent,
  DutyLogEntry,
  Issue,
  Notice,
  OpsAlert,
  KpiSummary,
  ExpenseSummary,
  Shift,
  DutyStatus,
  CheckState,
  CheckMethod,
  Coords,
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
      id: a.id, personName: a.personName, zoneId: null, role: a.role, shift: a.shift,
      date: a.date, isReserve: true, status: 'before', lang: a.lang, phone: a.phone, checks: [],
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
    id: a.id, personName: a.personName, zoneId: a.zoneId, role: a.role, shift: a.shift,
    date: a.date, isReserve: a.isReserve, status, lang: a.lang, phone: a.phone,
    checkedInAt: checkedIn ? fmtHM(checkinEv!.timeMin) : undefined,
    checkedOutAt: checkedOut ? fmtHM(checkoutEv!.timeMin) : undefined,
    checks,
  }
}

const roster = (now: number): Assignment[] => rawAssignments().map((a) => derive(a, now))
const isPresent = (s: DutyStatus) => s === 'on' || s === 'break' || s === 'moving'

// 거점 present/status 파생.
function deriveZone(z: Zone, list: Assignment[], now: number): Zone {
  const shift = activeShiftAt(now)
  const present = list.filter((a) => a.zoneId === z.id && a.shift === shift && isPresent(a.status)).length
  const start = hm(z.opWindow.start), end = hm(z.opWindow.end)
  const status: Zone['status'] = now < start ? 'before' : now >= end ? 'closed' : 'open'
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
export async function getNotices(): Promise<Notice[]> {
  return rawNotices()
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

// 실비 — 배치계획 × 단가(연인원 기준). 활동물품은 별도(placeholder).
export async function computeExpenses(): Promise<ExpenseSummary> {
  const plan = deploymentPlan()
  const unit = expenseUnitPerDay()
  const breakdown = plan.map((p) => ({ date: p.date, headcount: p.headcount, shifts: p.shifts, amount: p.headcount * unit }))
  const personDays = plan.reduce((s, p) => s + p.headcount, 0)
  const perDiemTotal = personDays * unit
  return {
    unitPerDay: unit, personDays, perDiemTotal,
    activityGoodsSets: activityGoodsSets(), activityGoodsCost: null,
    breakdown, grandTotal: perDiemTotal,
  }
}
export const getExpenses = computeExpenses

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
export async function getKpi(): Promise<KpiSummary> {
  const now = getNowMin()
  const shift = activeShiftAt(now)
  const list = roster(now)
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
  opts: { method: CheckInMethod; gps?: Coords; ts: number; idempotencyKey: string }
): Promise<boolean> {
  return addEvent({
    idempotencyKey: opts.idempotencyKey, assignmentId, kind: 'checkin',
    timeMin: opts.ts, method: toCheckMethod(opts.method), gps: opts.gps,
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

export async function reportIssue(input: {
  type: Issue['type']; zoneId: string; note: string; ts: number; idempotencyKey: string
}): Promise<Issue> {
  return addIssue({
    idempotencyKey: input.idempotencyKey, type: input.type, zoneId: input.zoneId,
    status: 'received', time: fmtHM(input.ts), message: input.note,
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
