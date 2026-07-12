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

// 실제처럼 보이는 목 데이터 (제안서 캡쳐용). 기준 시각 = 2026-10-20(화) 14:20.
// 거점: 행사장(유인 스캔) 6 + 관광지(무인 GPS) 6 — 과업 3-2.
// 근태: 단일 근무조 10:00–18:00. 정시(1h) 체크 = 상시 근무 무결성(무인 중심, 유인 보조).
// checks[] = SLOTS['10:00','11:00','12:00','13:00','14:00'] 정렬.

// ① 거점 ─────────────────────────────────────────────────
export const zones: Zone[] = [
  { id: 'z-info', name: '종합안내소', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7726, lng: 128.9476 }, geofenceRadius: 60, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 8, present: 8 },
  { id: 'z-stage', name: '공연구역', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7731, lng: 128.9481 }, geofenceRadius: 80, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 7, present: 7 },
  { id: 'z-food', name: '음식·휴게구역', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7719, lng: 128.9469 }, geofenceRadius: 70, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 6, present: 5 },
  { id: 'z-photo', name: 'ITS 상징 포토존', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7724, lng: 128.9487 }, geofenceRadius: 40, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 4, present: 4 },
  { id: 'z-support', name: '행사지원구역', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7733, lng: 128.9464 }, geofenceRadius: 60, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 5, present: 5 },
  { id: 'z-sky', name: '스카시 포토존', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7716, lng: 128.9491 }, geofenceRadius: 40, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 3, present: 3 },
  { id: 'z-market', name: '중앙시장·월화거리', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7519, lng: 128.8961 }, geofenceRadius: 120, opWindow: { start: '10:00', end: '17:00' }, status: 'open', quota: 4, present: 4 },
  { id: 'z-gyeongpo', name: '경포해변', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7955, lng: 128.9106 }, geofenceRadius: 150, opWindow: { start: '10:00', end: '17:00' }, status: 'open', quota: 4, present: 3 },
  { id: 'z-anmok', name: '안목해변', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7735, lng: 128.9473 }, geofenceRadius: 120, opWindow: { start: '10:00', end: '17:00' }, status: 'open', quota: 3, present: 3 },
  { id: 'z-jumunjin', name: '주문진수산시장', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.8925, lng: 128.8317 }, geofenceRadius: 130, opWindow: { start: '10:00', end: '16:00' }, status: 'open', quota: 4, present: 2 },
  { id: 'z-gangmun', name: '강문해변', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7907, lng: 128.9169 }, geofenceRadius: 120, opWindow: { start: '11:00', end: '17:00' }, status: 'open', quota: 3, present: 3 },
  { id: 'z-ojuk', name: '오죽헌시립박물관', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7794, lng: 128.8784 }, geofenceRadius: 100, opWindow: { start: '10:00', end: '17:00' }, status: 'open', quota: 4, present: 4 },
]

// ② 근무배치 — 정시 체크(checks) + 연락처(phone) ─────────────
export const assignments: Assignment[] = [
  { id: 'as-1', personName: '최유진', zoneId: 'z-info', role: '봉사자', isReserve: false, status: 'on', lang: ['영어'], checkedInAt: '09:58', phone: '010-2841-0102', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-2', personName: '정민재', zoneId: 'z-stage', role: '봉사자', isReserve: false, status: 'on', checkedInAt: '10:09', phone: '010-3392-4415', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-3', personName: '박준호', zoneId: 'z-food', role: '봉사자', isReserve: false, status: 'break', checkedInAt: '10:01', phone: '010-5540-7789', checks: ['ok', 'ok', 'ok', 'ok', 'break'] },
  { id: 'as-4', personName: '한지우', zoneId: 'z-market', role: '봉사자', isReserve: false, status: 'on', lang: ['영어', '중국어'], checkedInAt: '09:55', phone: '010-2277-9931', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-5', personName: '이하늘', zoneId: 'z-anmok', role: '봉사자', isReserve: false, status: 'on', checkedInAt: '10:12', phone: '010-8813-2240', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-6', personName: '김서연', zoneId: 'z-gyeongpo', role: '봉사자', isReserve: false, status: 'absent', checkedInAt: undefined, phone: '010-4419-6607', checks: ['absent', 'absent', 'absent', 'absent', 'absent'] },
  { id: 'as-7', personName: '오세훈', zoneId: 'z-info', role: '거점관리자', isReserve: false, status: 'on', checkedInAt: '09:45', phone: '010-3061-5528', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-8', personName: '나미래', zoneId: 'z-jumunjin', role: '봉사자', isReserve: false, status: 'on', lang: ['일본어'], checkedInAt: '10:05', phone: '010-7724-3316', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-9', personName: '서지안', zoneId: 'z-support', role: '봉사자', isReserve: false, status: 'on', checkedInAt: '09:52', phone: '010-9902-1187', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-10', personName: '문가온', zoneId: 'z-photo', role: '봉사자', isReserve: false, status: 'moving', checkedInAt: '10:03', phone: '010-3358-4471', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-11', personName: '배서준', zoneId: 'z-sky', role: '봉사자', isReserve: false, status: 'on', lang: ['영어'], checkedInAt: '09:59', phone: '010-6612-8890', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-12', personName: '임도현', zoneId: 'z-food', role: '봉사자', isReserve: false, status: 'on', checkedInAt: '10:07', phone: '010-2043-7752', checks: ['ok', 'ok', 'break', 'ok', 'ok'] },
  { id: 'as-13', personName: '윤채원', zoneId: 'z-ojuk', role: '봉사자', isReserve: false, status: 'on', lang: ['영어', '일본어'], checkedInAt: '10:02', phone: '010-5590-1123', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-14', personName: '신태호', zoneId: 'z-gyeongpo', role: '운영인력', isReserve: false, status: 'on', checkedInAt: '09:40', phone: '010-8871-3390', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-15', personName: '오세영', zoneId: 'z-info', role: '봉사자', isReserve: false, status: 'on', lang: ['중국어'], checkedInAt: '09:56', phone: '010-3314-2076', checks: ['ok', 'ok', 'ok', 'ok', 'ok'] },
  { id: 'as-16', personName: '한도현', zoneId: 'z-jumunjin', role: '봉사자', isReserve: false, status: 'on', checkedInAt: '10:00', phone: '010-6650-8842', checks: ['ok', 'ok', 'ok', 'missed', 'missed'] }, // 정시 체크 누락 → 확인 필요
  // 예비인력 (거점 미배정, 투입 대기 — 정시 체크 대상 아님)
  { id: 'rs-1', personName: '유지호', zoneId: null, role: '봉사자', isReserve: true, status: 'on', lang: ['영어'], phone: '010-2298-5540', checks: [] },
  { id: 'rs-2', personName: '강도윤', zoneId: null, role: '봉사자', isReserve: true, status: 'on', phone: '010-7741-0693', checks: [] },
]

// ③ 출결/정시체크 이벤트 (최근 — 실시간 로그) ─────────────
export const attendanceEvents: AttendanceEvent[] = [
  { id: 'ev-1', idempotencyKey: 'k-anmok-이하늘-1400', personName: '이하늘', zoneId: 'z-anmok', method: 'gps', time: '14:02', gps: { lat: 37.7736, lng: 128.9472 } },
  { id: 'ev-2', idempotencyKey: 'k-market-한지우-1401', personName: '한지우', zoneId: 'z-market', method: 'gps', time: '14:01', gps: { lat: 37.7521, lng: 128.8959 } },
  { id: 'ev-3', idempotencyKey: 'k-info-최유진-1400', personName: '최유진', zoneId: 'z-info', method: 'scan', time: '14:00' },
  { id: 'ev-4', idempotencyKey: 'k-jumunjin-나미래-1403', personName: '나미래', zoneId: 'z-jumunjin', method: 'gps', time: '14:03', gps: { lat: 37.8931, lng: 128.8309 }, anomaly: '지오펜스 경계(130m) 근접' },
  { id: 'ev-5', idempotencyKey: 'k-ojuk-윤채원-1401', personName: '윤채원', zoneId: 'z-ojuk', method: 'gps', time: '14:01', gps: { lat: 37.7792, lng: 128.8786 } },
]

// ④ 이슈 이벤트 ─────────────────────────────────────────
export const issues: Issue[] = [
  { id: 'is-1', type: '분실물', zoneId: 'z-info', status: 'in_progress', time: '13:34', message: '검정 백팩 습득 — 종합안내소 보관, 소유자 확인 중' },
  { id: 'is-2', type: '미아', zoneId: 'z-stage', status: 'resolved', time: '12:20', message: '미아(여, 6세) 보호 → 보호자 인계 완료' },
  { id: 'is-3', type: '시설이상', zoneId: 'z-food', status: 'received', time: '14:11', message: '음식구역 손세정대 수압 약함 — 점검 요청' },
  { id: 'is-4', type: '민원', zoneId: 'z-photo', status: 'received', time: '14:17', message: '포토존 대기줄 안내 인력 보강 요청' },
]

// ⑤ 공지·안내기준 ───────────────────────────────────────
export const notices: Notice[] = [
  { id: 'nt-1', title: '기상 안내', body: '오후 3시경 강풍 예보 — 야외 포토존 안전고지 문안 통일 배포', scope: 'all', time: '13:50' },
  { id: 'nt-2', title: '셔틀 운행 안내 문안', body: '방문객 문의 대비 셔틀 배차 간격·정류장 안내 표준 문안', scope: ['z-info', 'z-market', 'z-gyeongpo'], time: '09:10' },
]

// ── 파생 뷰 ─────────────────────────────────────────────
export const alerts: OpsAlert[] = [
  { id: 'a1', level: 'critical', time: '14:15', zoneName: '주문진수산시장', message: '근무공백 — 배정 4명 중 2명 근무. 예비인력 투입 필요' },
  { id: 'a2', level: 'warning', time: '14:05', zoneName: '주문진수산시장', message: '한도현 봉사자 13:00·14:00 정시 체크 누락 — 연락 확인 필요' },
  { id: 'a3', level: 'warning', time: '14:08', zoneName: '음식·휴게구역', message: '박준호 봉사자 휴게 20분 초과' },
  { id: 'a4', level: 'info', time: '14:00', zoneName: '전 거점', message: '14:00 정시 체크 — 배치 인력 96% 확인' },
  { id: 'a5', level: 'info', time: '13:52', zoneName: '경포해변', message: '김서연 봉사자 미출근 지속 — 예비 대체 검토' },
]

export const kpi: KpiSummary = {
  total: 110,
  onDuty: 52,
  breakOrMoving: 6,
  absent: 3,
  gapAlerts: 2,
  reserveAvailable: 7,
}

// 개인 근퇴 타임라인 (assignment id 키). 상세 없는 사람은 체크인 1건으로 합성(컴포넌트).
export const dutyLogs: Record<string, DutyLogEntry[]> = {
  'as-1': [
    { time: '09:58', label: '출근 체크인', status: 'on', via: 'scan' },
    { time: '12:10', label: '휴게 시작', status: 'break', note: '식사 로테이션' },
    { time: '12:40', label: '휴게 종료·복귀', status: 'on' },
    { time: '13:30', label: '외국어 응대 지원(영어)', status: 'on', note: '해외 참가자 안내' },
  ],
  'as-3': [
    { time: '10:01', label: '출근 체크인', status: 'on', via: 'scan' },
    { time: '12:20', label: '휴게 시작', status: 'break' },
    { time: '12:50', label: '휴게 종료·복귀', status: 'on' },
    { time: '14:05', label: '휴게 시작', status: 'break', note: '오후 로테이션' },
  ],
  'as-8': [
    { time: '10:05', label: '출근 체크인 (GPS)', status: 'on', via: 'gps', note: '지오펜스 경계 130m 근접 — 이상치 기록(차단 아님)' },
    { time: '14:03', label: '정시 체크 (GPS)', status: 'on', via: 'gps' },
  ],
  'as-10': [
    { time: '10:03', label: '출근 체크인', status: 'on', via: 'scan' },
    { time: '14:10', label: '거점 간 이동', status: 'moving', note: '포토존 → 행사지원구역' },
  ],
  'as-16': [
    { time: '10:00', label: '출근 체크인', status: 'on', via: 'scan' },
    { time: '13:00', label: '정시 체크 누락', status: 'on', note: '13:00·14:00 미확인 — 연락 확인 필요(차단 아님)' },
  ],
  'as-6': [], // 김서연 — 미출근(배정시간 10:00 경과)
}
