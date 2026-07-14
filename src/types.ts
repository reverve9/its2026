// 도메인 타입 — 데이터 척추 (SPEC §3). 나중에 Supabase 스키마와 1:1 대응.
// 화면은 이 타입 + services 레이어만 안다. 목/실DB 교체는 services 안쪽에서 처리.
// 상태·checks·present·KPI 등 파생값은 services가 '현재시각' 기준으로 계산해 채운다.

// ── 공통 ─────────────────────────────────────────────────
export type ZoneKind = 'venue' | 'tourist' // 행사장(유인) / 관광지(무인)
export type CheckMode = 'manager_scan' | 'self_gps' // 유인 관리자 스캔 / 무인 GPS 셀프
export type ZoneStatus = 'before' | 'open' | 'closed' // 운영 전 / 운영 중 / 운영 종료

// 근무조 — 본공고 3-1: 1일 2교대(오전 55 / 오후 55). 금요일만 1교대.
export type Shift = 'AM' | 'PM'

// 근태 상태 — services가 현재시각 기준으로 파생.
// before: 근무 시작 전 대기 / on: 근무중 / break: 휴게 / moving: 이동
// off: 근무 종료(퇴근완료) / absent: 미출근
export type DutyStatus = 'before' | 'on' | 'break' | 'moving' | 'off' | 'absent'

// 정시(1h) 체크: 정상·누락(확인필요=soft)·휴게면제·미출근
export type CheckState = 'ok' | 'missed' | 'break' | 'absent'

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
  quota: number // 조당 정원(운영 중 목표 인원)
  present: number // 파생 — 현재 근무 인원(active shift 기준)
}

// ② 근무배치(assignments) ────────────────────────────────
export type StaffRole = '봉사자' | '거점관리자' | '운영인력'
export interface Assignment {
  id: string
  personName: string
  zoneId: string | null // 예비인력은 미배정(null)
  role: StaffRole
  shift: Shift // 오전조/오후조
  date: string // YYYY-MM-DD — 5일치 구분(2026-10-19 ~ 2026-10-23)
  isReserve: boolean // 예비인력(결원·공백 대비)
  status: DutyStatus // 파생(현재시각 기준)
  lang?: string[] // 가능 외국어
  checkedInAt?: string // HH:mm 출근(파생 — 체크인 이벤트 최초 시각)
  checkedOutAt?: string // HH:mm 퇴근(파생 — 지났을 때만 채움)
  phone: string // 연락처 — 즉각 소통(정시 체크 누락·근무공백 대응)
  checks: CheckState[] // 파생 — 조별 슬롯 정렬, 현재시각까지 지난 슬롯만
  standby?: Coords // 예비인력 대기 위치(근무공백 대응 거리 산정용)
  goods?: GoodsIssue // 활동물품 지급 현황(인력 행정 — 물품지급 화면·상세 모달 공유)
}

// 활동물품(바람막이·가방) 지급 — 본공고 3-1 제작·배부. 시간 비의존 마스터 데이터.
export interface GoodsIssue {
  jacket: boolean // 바람막이 지급
  bag: boolean // 가방 지급
  issuedAt?: string // 지급일(YYYY-MM-DD)
}

// ③ 출결 이벤트(scan/gps) — 실시간 로그·멱등 ─────────────
export type CheckMethod = 'scan' | 'gps'
export interface AttendanceEvent {
  id: string
  idempotencyKey: string // 멱등키(중복 방지, R4)
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
  idempotencyKey?: string // 멱등키(R4 — reportIssue 발급)
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
  gapZoneId?: string // 근무공백 경보면 대상 거점 id — 예비 투입 액션에 사용
}

// 교대 인지형 KPI 요약 — 대시보드 스트립.
export interface KpiSummary {
  total: number // 배치 인원(비예비) — 110
  activeShift: Shift // 현재 시각이 속한 조
  amExpected: number // 오전조 정원(55)
  pmExpected: number // 오후조 정원(55)
  expected: number // 현재 조 정원
  present: number // 현재 조 출근(근무·휴게·이동)
  onDuty: number // 현재 조 근무중('on')
  breakOrMoving: number // 현재 조 휴게·이동
  absent: number // 현재 조 미출근
  gapAlerts: number // 근무공백 경보 거점 수(운영 중 기준)
  reserveAvailable: number // 투입 가능 예비인력
  minsSinceShiftStart: number // 현재 조 시작 후 경과 분(교대 직후 리스크 표시)
}

// 실비 정산 요약(파생) — 배치계획 × 단가.
export interface ExpenseSummary {
  unitPerDay: number // 1인 1일 단가(원) — 본공고 3-1
  personDays: number // 연인원
  perDiemTotal: number // 실비 소계(연인원 × 단가)
  activityGoodsSets: number // 활동물품 세트 수(바람막이·가방)
  activityGoodsCost: number | null // 활동물품 제작·배부비(별도 산출 — 미정 placeholder)
  breakdown: { date: string; headcount: number; shifts: number; amount: number }[]
  grandTotal: number // 실비 소계 + 활동물품(있으면)
}
