// 도메인 타입 — 데이터 척추 5 (SPEC §3). 나중에 Supabase 스키마와 1:1 대응.
// 화면은 이 타입 + services 레이어만 안다. 목/실DB 교체는 services에서 처리.

// ── 공통 ─────────────────────────────────────────────────
export type ZoneKind = 'venue' | 'tourist' // 행사장(유인) / 관광지(무인)
export type CheckMode = 'manager_scan' | 'self_gps' // 유인 관리자 스캔 / 무인 GPS 셀프
export type ZoneStatus = 'before' | 'open' | 'closed' // 운영 전 / 운영 중 / 운영 종료
export type DutyStatus = 'on' | 'break' | 'moving' | 'absent' // 근무·휴게·이동·미출근
export type CheckState = 'ok' | 'missed' | 'break' | 'absent' // 정시 체크: 정상·누락(확인필요)·휴게면제·미출근

export interface Coords {
  lat: number
  lng: number
}

// ① 거점(zones) ──────────────────────────────────────────
export interface Zone {
  id: string
  name: string
  kind: ZoneKind
  checkMode: CheckMode
  coords: Coords
  geofenceRadius: number // m — 무인 GPS 판정 반경
  opWindow: { start: string; end: string } // HH:mm — 거점별 운영시간 윈도우
  status: ZoneStatus // 파생(현재시각 vs opWindow). 공백·인원 집계는 'open'만 대상
  quota: number // 운영 중 정원
  present: number // 현재 근무 인원
}

// ② 근무배치(assignments) ────────────────────────────────
export type StaffRole = '봉사자' | '거점관리자' | '운영인력'
export interface Assignment {
  id: string
  personName: string
  zoneId: string | null // 예비인력은 미배정 가능
  role: StaffRole
  isReserve: boolean // 예비인력(결원·공백 대비)
  status: DutyStatus
  lang?: string[] // 가능 외국어
  checkedInAt?: string // HH:mm 출근
  checkedOutAt?: string // HH:mm 퇴근(근무 중이면 undefined)
  phone: string // 연락처 — 즉각 소통(정시 체크 누락·근무공백 대응)
  checks: CheckState[] // 정시(1h) 체크 이력, SLOTS 정렬(예비는 빈 배열)
}

// ③ 출결 이벤트(scan/gps) ────────────────────────────────
export type CheckMethod = 'scan' | 'gps'
export interface AttendanceEvent {
  id: string
  idempotencyKey: string // 멱등키(중복 방지)
  personName: string
  zoneId: string
  method: CheckMethod
  time: string // HH:mm
  gps?: Coords
  anomaly?: string // 이상치 플래그(차단 아님, 기록만)
}

// 개인 근퇴 타임라인 (출결 + 상태전환 — 개인 상세용 파생)
export interface DutyLogEntry {
  time: string // HH:mm
  label: string // '출근 체크인' · '휴게 시작' · '휴게 종료·복귀' · '이동' · '퇴근'
  status: DutyStatus // 이 이벤트 이후 상태
  via?: CheckMethod // 체크인/아웃 방식
  note?: string
}

// ④ 이슈 이벤트(issues) ──────────────────────────────────
export type IssueType = '민원' | '분실물' | '미아' | '시설이상' | '안전사고'
export type IssueStatus = 'received' | 'in_progress' | 'resolved' // 접수·처리중·완료
export interface Issue {
  id: string
  type: IssueType
  zoneId: string
  status: IssueStatus
  time: string // HH:mm
  message: string
}

// ⑤ 공지·안내기준(notices) ───────────────────────────────
export interface Notice {
  id: string
  title: string
  body: string
  scope: 'all' | string[] // 전체 / 특정 거점 id[]
  time: string // HH:mm
}

// ── 파생 뷰(척추에서 계산) ───────────────────────────────
export type AlertLevel = 'critical' | 'warning' | 'info'
export interface OpsAlert {
  id: string
  level: AlertLevel
  time: string // HH:mm
  zoneName: string
  message: string
}

export interface KpiSummary {
  total: number
  onDuty: number
  breakOrMoving: number
  absent: number
  gapAlerts: number // 근무공백 경보 거점 수(운영 중 기준)
  reserveAvailable: number // 투입 가능 예비인력
}
