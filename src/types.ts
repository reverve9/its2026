// 도메인 타입 — 데이터 척추 (SPEC §3). 나중에 Supabase 스키마와 1:1 대응.
// 화면은 이 타입 + services 레이어만 안다. 목/실DB 교체는 services 안쪽에서 처리.
// 상태·checks·present·KPI 등 파생값은 services가 '현재시각' 기준으로 계산해 채운다.

// ── 공통 ─────────────────────────────────────────────────
export type ZoneKind = 'venue' | 'tourist' // 행사장(유인) / 관광지(무인)
export type CheckMode = 'manager_scan' | 'self_gps' // 유인 관리자 스캔 / 무인 GPS 셀프
// 운영 전 / 운영 중 / 운영 종료 / 운영중단(본부 발령 — 시간이 아니라 조치로 닫힌 상태)
// 'closed'(운영시간 종료)와 'suspended'(중단 발령)는 다르다 — 전자는 예정된 끝, 후자는 개입이다.
export type ZoneStatus = 'before' | 'open' | 'closed' | 'suspended'

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
// 인력은 2축으로 나뉜다. 이전 StaffRole 은 직무와 고용형태를 한 칸에 뒤섞어서
// '거점관리자는 자원봉사자인가?'에 답할 수 없었다 — 그래서 축을 갈랐다.
//
//   구분(kind)       자원봉사자 | 운영인력          ← 크게 둘. 정산 방식·보고 경계가 여기서 갈린다
//   직무(role)       봉사자 | 거점관리자 | 현장운영   ← 작게 셋
//   고용형태(employment) 직원 | 일용                ← 운영인력만. 정산 총액을 가른다
//
// RFP 3-1 의 110명은 '자원봉사자' 수다(SPEC §32·§125). 거점관리자는 그 110 밖의
// 운영인력이며 직원일 수도 일용일 수도 있다 → 실비 총액 11,880,000 은 영향받지 않는다.
export type StaffKind = '자원봉사자' | '운영인력'
export type StaffRole = '봉사자' | '거점관리자' | '현장운영'
export type Employment = '직원' | '일용' // 직원 = 급여(정산 미산정) · 일용 = 시급×시간
export interface Assignment {
  id: string
  personId: string // 사람 단위 식별자 — 교육 이수 등 '사람에 귀속되는' 사실의 키(배치 id와 별개)
  personName: string
  zoneId: string | null // 예비인력은 미배정(null)
  kind: StaffKind
  role: StaffRole
  employment?: Employment // 운영인력만 — 자원봉사자는 고용관계가 없으므로 undefined
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
  payout?: PayoutInfo // 정산 서류·지급계좌(인력 현황 대장에서 등록)
}

// 활동물품(바람막이·가방) 지급 — 본공고 3-1 제작·배부. 시간 비의존 마스터 데이터.
export interface GoodsIssue {
  jacket: boolean // 바람막이 지급
  bag: boolean // 가방 지급
  issuedAt?: string // 지급일(YYYY-MM-DD)
}

// 정산 구비서류·지급계좌 — 실비 지급을 위한 사전 등록 항목(시간 비의존 마스터).
// 정산은 일일 단위가 아니라 행사 후 일괄이므로, 일일보고가 아니라 인력 현황(대장)에서 관리한다.
// ※ 개인정보 최소수집 — 행사 종료 후 즉시 파기(제안요청서 Ⅳ-8). 화면 표기는 마스킹.
export interface PayoutInfo {
  idCard: boolean // 신분증 사본 첨부
  bankbook: boolean // 통장 사본 첨부
  bankName?: string // 은행
  accountNo?: string // 계좌번호
  holder?: string // 예금주(본인 확인)
  registeredAt?: string // 등록일(YYYY-MM-DD)
}

// 인력 명부 레코드(운영 대장) — 시간 비의존 마스터.
// 근태·상태·정시체크는 여기 없다(그건 Assignment = 오늘의 실시간 배치).
// 인력 현황 화면의 축은 '사람', 인력 관리 화면의 축은 '지금'.
export interface PersonnelRecord {
  id: string // assignment id — 개인 상세 모달 공유 키
  personId: string // 사람 단위 키 — 교육 이수 조회용
  education: EducationRecord[] // 이수 이력(사람 단위에서 끌어옴)
  personName: string
  phone: string
  kind: StaffKind
  role: StaffRole
  employment?: Employment
  shift: Shift
  zoneId: string | null
  isReserve: boolean
  lang: string[]
  goods: GoodsIssue
  payout: PayoutInfo
}

// 활동물품 지급 집계(파생) — 인력 현황 상단 요약.
export interface GoodsSummary {
  total: number // 명부 총원
  jacket: number // 바람막이 지급 완료
  bag: number // 가방 지급 완료
  complete: number // 2종 모두 지급
  pending: number // 1종 이상 미지급
  payoutReady: number // 정산 서류(신분증·통장·계좌) 등록 완료
  payoutPending: number // 정산 서류 미비
}

// 교육 이수 집계(파생) — 대시보드 KPI·인력 현황 요약.
export interface EducationSummary {
  total: number // 대상 인원(배치 인력)
  done: number // 사전 통합교육 이수
  pending: number // 사전 통합교육 미이수
  rate: number // 이수율(%)
  fieldDone: number // 현장교육 이수
}

// ②-2 교육 이수 — **봉사자(사람) 단위** 귀속 ───────────────
// 배치(assignment)가 아니라 사람에 붙는다: 한 번 이수하면 그 사람의 모든 배치에 적용.
// 이수 처리는 오프라인 통합교육 후 관리자가 일괄(batch) 인증하며, 봉사자 self-확인은 없다.
// 미이수는 soft 플래그 — 예비 투입을 막지 않고 경고·정렬로만 다룬다.
export type EducationKind = '사전 통합교육' | '현장교육' // 확장 가능(향후 종류 추가)
export const EDUCATION_KINDS: EducationKind[] = ['사전 통합교육', '현장교육']

// 증빙 3종 — 누가(인증자) · 언제(이수 일시) · 무슨 교육(교육구분).
export interface EducationRecord {
  kind: EducationKind
  certifiedBy: string // 인증한 관리자
  certifiedAt: string // 이수 일시 'YYYY-MM-DD HH:mm'
}

// 사람 단위 준비도. 향후 물품수령·개인정보 동의 등을 형제 필드로 붙일 수 있게 열어둔다.
export interface Readiness {
  personId: string
  education: EducationRecord[] // 이수한 것만 담는다(없으면 미이수)
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

// ⑤ 먹거리 입점업체 등록(food) ───────────────────────────
// 본공고 3-1 정량 스펙: 음식부스 5 · 푸드트럭 5 (파라솔 80). 음식판매·휴게구역 입점.
// 성격 = 업체 정보 '등록 대장'. 클라이언트(업체)앱이 없으므로 업체 셀프 등록이 아니라
// 운영본부가 입점업체 정보·구비서류를 등록·관리한다. 시간 비의존 마스터(인력 현황과 동일 성격).
// ※ 블라인드 유지(SPEC §2.9) — 상호는 품목 기반 가명. 실존 업체·제휴사명 금지.
export type VendorKind = 'truck' | 'booth'

// 구비서류·확인 항목 — 식중독·LPG 화재 리스크 관리(안전·비상 6-3과 같은 결).
export interface VendorDoc {
  id: string
  label: string
  done: boolean
  at?: string // 등록일(YYYY-MM-DD)
}

export interface FoodVendor {
  id: string
  name: string // 품목 기반 가명
  kind: VendorKind
  items: string // 주요 품목
  spot: string // 배치 구획(음식판매·휴게구역 내)
  opHours: string // 신청 운영시간(등록 정보 — 실시간 상태 아님)
  contact: string // 대표 연락처
  docs: VendorDoc[] // 구비서류 등록 상태
  registeredAt?: string // 업체 등록일(YYYY-MM-DD)
  note?: string
}

// 업체 등록 집계(파생).
export interface FoodSummary {
  trucks: number
  booths: number
  total: number
  registered: number // 서류까지 등록 완료된 업체
  docDone: number // 등록 완료 서류 항목 수
  docTotal: number // 전체 서류 항목 수
  pendingVendors: number // 서류 미비 업체 수
}

// ⑥ 공지·안내기준(notices) ───────────────────────────────

// 상황전파 수신자 주소 — 본부→현장 방향의 '누구에게'.
//
// 이전 모델은 Notice.scope = 'all' | string[](거점 id) 뿐이라 거점 축밖에 없었다.
// 그래서 zoneId: null 인 현장운영 12명은 'all' 로 쏴도 구조적으로 수신 대상이 아니었고,
// '자원봉사자에게만' · '거점관리자에게만' 같은 주소가 아예 표현 불가능했다.
// → 축을 셋으로 갈랐다: 대상 = 구분 × 역할 × 거점.
//
// 규칙: 축이 없으면(undefined) 그 축은 거르지 않는다. 축 '안'은 OR, 축 '사이'는 AND.
//   {}                                    전원 — 운영총괄이 전 인력에 쏘는 경우
//   { kinds: ['자원봉사자'] }               자원봉사자 전원(거점 무관 · 예비 포함)
//   { roles: ['거점관리자'] }               거점관리자 10명
//   { zoneIds: ['z-info'] }                해당 거점 소속 전원
//   { kinds: ['자원봉사자'], zoneIds: [x] } x 거점의 자원봉사자만
//
// ⚠️ zoneIds 를 지정하면 zoneId: null 인 인력(현장운영·예비)은 제외된다 — 의도된 것이다.
// 거점을 지목한 공지는 거점에 없는 사람에게 갈 이유가 없다. 그들에게 보내려면 zoneIds 를 비운다.
export interface Audience {
  kinds?: StaffKind[]
  roles?: StaffRole[]
  zoneIds?: string[]
}

export interface Notice {
  id: string
  title: string
  body: string
  audience: Audience
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

// 실비 정산 요약(파생) — RFP 3-1: 자원봉사자 1인당(교대근무자별) 24,000원.
// ※ 이 24,000원 안에 지급물품(바람막이·가방) 대금이 포함된다 → 물품은 총액에 '더하는' 게 아니라
//   총액에서 '빼내는' 항목이다. 일일 지급기준 = 24,000 − (물품세트단가 ÷ 1인 평균 근무일).
//   총액(11,880,000원)은 RFP 기준이라 고정 — 물품 단가를 바꿔도 총액은 불변, 내부 구성만 이동한다.
export interface ExpenseSummary {
  unitPerDay: number // 1인 1일 기준 단가(원) — RFP 3-1. 물품 대금 포함
  personDays: number // 연인원(495 = 110×4 + 55)
  headcount: number // 실인원(110 = 연인원 ÷ 평균 근무일)
  avgDays: number // 1인 평균 근무일(4.5 — 금요일 1교대 반영)
  perDiemTotal: number // 총 실비(연인원 × 단가) — RFP 기준 총액, 고정
  goodsSets: number // 활동물품 세트 수(110 — 1인 1세트)
  goodsUnitCost: number // 물품 세트 단가(입력값 — 바람막이+가방)
  goodsTotal: number // 물품 총액(세트 수 × 단가)
  payoutTotal: number // 일당 총액(총 실비 − 물품 총액) — 현금 지급분
  dailyPayout: number // 일일 지급기준(일당 총액 ÷ 연인원)
  withholdingRate: number // 원천징수율(%) — 입력값. 기본 3.3%
  withholdingTotal: number // 원천징수 총액(일당 총액 × 요율) — 현물은 대상 아님
  netPayoutTotal: number // 실수령 총액(일당 총액 − 원천징수)
  perPersonTotal: number // 1인 총액(평균 근무일 × 단가)
  perPersonPayout: number // 1인 일당(1인 총액 − 물품 세트 단가)
  perPersonNet: number // 1인 실수령(일당 − 원천징수)
  breakdown: { date: string; headcount: number; shifts: number; amount: number }[] // 일자별 일당
}
