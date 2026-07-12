// 서비스 레이어 — 화면은 오직 이 함수들만 호출한다.
// 지금은 목 데이터 반환. 나중에 이 파일 구현만 Supabase 호출로 교체하면
// 화면 코드는 한 줄도 안 바뀐다. (재사용의 핵심 경계 — SPEC §3)

import {
  zones,
  assignments,
  attendanceEvents,
  dutyLogs,
  issues,
  notices,
  alerts,
  kpi,
} from '../mock/data'
import type {
  Zone,
  Assignment,
  AttendanceEvent,
  DutyLogEntry,
  Issue,
  Notice,
  OpsAlert,
  KpiSummary,
} from '../types'

// ── 데이터 척추 5 getter ─────────────────────────────────
export async function getZones(): Promise<Zone[]> {
  return zones
}
export async function getAssignments(): Promise<Assignment[]> {
  return assignments
}
export async function getAssignment(id: string): Promise<Assignment | undefined> {
  return assignments.find((a) => a.id === id)
}
export async function getDutyLog(id: string): Promise<DutyLogEntry[]> {
  return dutyLogs[id] ?? []
}
export async function getAttendanceEvents(): Promise<AttendanceEvent[]> {
  return attendanceEvents
}
export async function getIssues(): Promise<Issue[]> {
  return issues
}
export async function getNotices(): Promise<Notice[]> {
  return notices
}

// ── 파생 뷰 getter ──────────────────────────────────────
export async function getAlerts(): Promise<OpsAlert[]> {
  return alerts
}
export async function getKpi(): Promise<KpiSummary> {
  return kpi
}

// ── 운영 기준 정보(정적) ─────────────────────────────────
export const OPS_INFO = {
  eventName: '2026 제32회 강릉 ITS 세계총회 부대행사',
  operationDate: '2026-10-20 (화)',
  shiftLabel: '단일 근무조 · 10:00–18:00 (금 13:00)',
  totalZones: zones.length,
}
