// 도메인 타입 — 데이터 척추 (SPEC §3). 나중에 Supabase 스키마와 1:1 대응.
// 화면은 이 타입 + services 레이어만 안다. 목/실DB 교체는 services 안쪽에서 처리.
// 상태·checks·present·KPI 등 파생값은 services가 '현재시각' 기준으로 계산해 채운다.

// ── 공통 ─────────────────────────────────────────────────
export type ZoneKind = 'venue' | 'tourist' // 행사장 / 관광지
//
// ⚠️ CheckMode('manager_scan' | 'self_gps')는 폐기됐다. 되살리지 말 것.
// QR 출결을 버리면서(아래 ScanKind 주석) 전 거점이 GPS 셀프 단일 경로가 됐고,
// 거점관리자 11명이 전 거점에 상주하게 되면서 '무인 거점'이라는 전제 자체가 없어졌다.
//
// 운영 전 / 운영 중 / 운영 종료 / 운영중단(본부 발령 — 시간이 아니라 조치로 닫힌 상태)
// 'closed'(운영시간 종료)와 'suspended'(중단 발령)는 다르다 — 전자는 예정된 끝, 후자는 개입이다.
export type ZoneStatus = 'before' | 'open' | 'closed' | 'suspended'

// 근무조 — 본공고 3-1: 1일 2교대(오전 55 / 오후 55). 금요일만 1교대.
export type Shift = 'AM' | 'PM'

// 근태 상태 — services가 현재시각 기준으로 파생.
// before: 근무 시작 전 대기 / on: 근무중 / off: 근무 종료(퇴근완료) / absent: 미출근
//
// ⚠️ 폐기: 'break'(휴게) · 'moving'(이동) — 되살리지 말 것.
// 2교대(오전 4h · 오후 4h)로 확정되면서 휴게가 설 자리가 없어졌다. 4시간 근무에 휴게를 그리면
// 근무시간이 얼마인지가 모호해지고(4h 중 30분이 휴게면 실근무 3.5h?), 실비 24,000원은
// 교대근무자 1인 1일 기준이라 휴게로 갈라지지 않는다 — 화면이 정산과 다른 말을 하게 된다.
// 이동은 거점 고정 배치라 애초에 없다(봉사자는 자기 거점에 서 있고, 거점 간 이동은 배치 변경이다).
export type DutyStatus = 'before' | 'on' | 'off' | 'absent'

// 정시(1h) 체크: 정상 · 누락(확인필요=soft) · 미출근
// ⚠️ 폐기: 'break'(휴게면제) — 휴게가 없어졌으므로 면제할 것도 없다.
export type CheckState = 'ok' | 'missed' | 'absent'

export interface Coords {
  lat: number
  lng: number
}

// ① 거점(zones) ──────────────────────────────────────────
export interface Zone {
  id: string
  name: string
  kind: ZoneKind
  coords: Coords
  geofenceRadius: number // m — GPS 판정 반경(전 거점 공통). 벗어나면 anomaly 기록, 차단은 아니다
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
  date: string // YYYY-MM-DD — 파생: '지금 보고 있는 날짜'. 배치(현황)는 5일 고정이라 날짜가 없다
  isReserve: boolean // 예비인력(결원·공백 대비)
  status: DutyStatus // 파생(현재시각 기준)
  lang?: string[] // 가능 외국어
  checkedInAt?: string // HH:mm 출근(파생 — 체크인 이벤트 최초 시각)
  checkedOutAt?: string // HH:mm 퇴근(파생 — 지났을 때만 채움)
  // 출근 지연(분) — 파생. 예정 출근 대비 실제 체크인이 늦은 만큼. 정시·조퇴 시 undefined.
  // +1~4 = 유예 내(지각 아님, 봐주지만 기록은 남는다) · +5 이상 = 지각(LATE_GRACE).
  // 판정을 화면에 두지 않고 여기 담는 이유: 목록과 상세가 같은 수를 봐야 한다(R5).
  lateMin?: number
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

// ③ 출결 이벤트 — 실시간 로그·멱등 ─────────────────────
//
// ⚠️ CheckMethod('scan' | 'gps')는 폐기됐다. 출결은 전 거점 GPS 셀프 단일 경로라
// 방식을 기록할 갈래가 없다. 'scan'(관리자 QR 스캔)이 사라지자 생산자가 0인 죽은 변종이
// 됐고, 값이 하나뿐인 필드를 화면에 배지로 띄우는 건 정보가 아니라 장식이다.
export interface AttendanceEvent {
  id: string
  idempotencyKey: string // 멱등키(중복 방지, R4)
  personName: string
  zoneId: string
  time: string // HH:mm
  gps?: Coords
  anomaly?: string // 이상치 플래그(차단 아님, 기록만)
}

// ③-2 스캔 이벤트(QR = 서명) ────────────────────────────
// QR 은 출결 수단이 아니다. 출결은 GPS 셀프 단일 경로다.
//
// 왜 출결에서 뺐나 — RFP(과업지시서·제안요청서) 전문에 QR·스캔·앱은 0건이고, 출결 요구는
// "자원봉사자 출결 확인"뿐 방법 지정이 없다. 즉 QR 도 GPS 도 전부 우리 설계 선택이었고,
// 그중 QR 이 명백히 약했다: GPS 는 checkGeofence 로 위치를 검증하는데 관리자 스캔은 검증이
// 아예 없었고, QR 값이 정적 assignmentId 라 스크린샷만 보내도 대리 출근이 됐다.
// 셀프 출결이 안 되는 상황은 예외지 병렬 주경로를 둘 이유가 아니다 — 예외는 관리자가
// 콘솔에서 수동 처리하고, 그게 RFP 의 "거점별 담당자가 출결을 관리"다.
//
// 그럼 QR 은 무엇인가 — 서명이다. "명령 인수 · 접수 · 물품수령증의 사인의 온라인 역할".
// 네 용도가 전부 같은 문장이다: "이 사람이, 이 시각에, 여기서, 이걸 받았다."
// 서명의 주인은 수령자이고 건네주는 쪽이 찍는다 → QR 은 봉사자(수령자)에게 붙는다.
//
// ⚠️ '지시인수'는 온라인 공지 수신확인(ack)이 아니다. 거점에서 대면으로 이뤄지는 인스턴트
// 지시의 확인이다 — 관리자가 직접 말하고 찍어 "내가 이 사람에게 전달했다"를 남긴다.
// 온라인 공지 ack 은 여전히 별개 미결 문제다.
//
// ⚠️ '대면확인'이 옛 순회 감사를 대체한다. 랜덤 모달의 [정위치]/[불일치] 이분법은 없앴다 —
// 자리에 앉아서 클릭만 해도 통과하는 가짜 대면이었기 때문이다. 이제 그 사람 앞에 가서
// 찍어야 하고, 불일치는 '스캔 없음 = 기록 없음'으로 표현된다.
export type ScanKind = '활동물품수령' | '현장물품수령' | '지시인수' | '대면확인'

export interface ScanEvent {
  id: string
  idempotencyKey: string // 멱등키(중복 방지, R4)
  subjectId: string // 서명한 사람 = QR 주인(배치 id). 이 스캔의 귀속처
  scannerId: string | null // 찍은 사람. 슈퍼어드민은 배치가 없어 null 가능
  kind: ScanKind
  note?: string // 세부 자유 텍스트 — '생수 2병' · '강풍 대피 지시 전달'
  // 직무별 데이터 모델을 만들지 않는 이유가 이 한 칸이다. 물품 관리든 본부 지원이든
  // 같은 스캐너 + 다른 note. 덕분에 현장운영 11명의 실제 직무를 몰라도 착수할 수 있었다.
  date: string // 라이브 사실 — 이벤트는 날짜를 갖는다(현황은 5일 고정)
  timeMin: number
  gps?: Coords // 찍은 사람의 위치. 대면이므로 이 하나로 양쪽이 증명된다
  anomaly?: string // 대상 봉사자의 거점 지오펜스를 벗어남 등. 기록만, 차단 아님
}

// 개인 근퇴 타임라인 (출결 + 상태전환 — 개인 상세용 파생)
export interface DutyLogEntry {
  time: string // HH:mm
  label: string // '출근 체크인' · '퇴근' (휴게·이동 폐기)
  status: DutyStatus // 이 이벤트 이후 상태
  note?: string
}

// ④ 이슈 이벤트(issues) ──────────────────────────────────
export type IssueType = '민원' | '분실물' | '미아' | '시설이상' | '안전사고'
export type IssueStatus = 'received' | 'in_progress' | 'resolved' // 접수·처리중·완료
export interface Issue {
  id: string
  idempotencyKey?: string // 멱등키(R4 — reportIssue 발급)
  type: IssueType
  // null = 운영본부. 이슈는 거점 사실이 아니다 — 거점에서 나기도 하고 본부에서 나기도 한다.
  // 이전엔 string(필수)이라 거점 없는 운영인력(현장운영 11명·슈퍼어드민)이 구조적으로
  // 이슈를 못 올렸고, 그래서 현장앱의 이슈 보고 카드가 거점 게이트 안에 갇혀 있었다.
  zoneId: string | null
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
  // 슈퍼어드민(관리자) 수신 여부. role 로 담지 않는 이유: 슈퍼어드민은 StaffRole 셋 중
  // 어느 것도 아니고(role 을 지어내면 주소 판정이 오염된다 — SUPER_ADMIN 주석), 로그인 분기가
  // 가르는 그 신원(assignmentId·role 이 null)으로 판정한다. 구분 축(roles + admin)에서 OR.
  admin?: boolean
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
  // 읽음 표식의 키 = id + 내용. id 만으로는 안 된다 — 경보는 파생 판정이라 id 가 고정인 채
  // 내용이 자란다(store.markAlertsRead 주석). 내용이 바뀌면 키가 바뀌어 다시 안 읽음이 된다.
  readKey: string
  read: boolean
}

// 교대 인지형 KPI 요약 — 대시보드 스트립.
export interface KpiSummary {
  total: number // 배치 인원(비예비) — 110
  activeShift: Shift // 현재 시각이 속한 조
  amExpected: number // 오전조 정원(55)
  pmExpected: number // 오후조 정원(55)
  expected: number // 현재 조 정원
  present: number // 현재 조 근무중('on')
  // ⚠️ 폐기: onDuty · breakOrMoving — 휴게·이동이 없어지면서 present 와 같은 수가 됐다.
  // 같은 수를 세 칸에 담으면 화면이 셋을 다른 사실처럼 보여준다.
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
