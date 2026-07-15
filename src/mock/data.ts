// 시드 데이터 (이벤트 소싱) — store.ts 만 이 파일을 import 한다(R1).
// 화면·컴포넌트는 절대 여기를 직접 읽지 않는다. 반드시 services 경유.
//
// 설계: 상태·checks·present·KPI 는 저장하지 않는다. 원시 사실만 담는다.
//
// 두 층으로 나뉜다 — 이 구분이 이 파일의 뼈대다:
//   · 현황(마스터) — 날짜를 갖지 않는다. 행사 5일 내내 같다.
//       배치(StoredAssignment) · 활동물품 · 정산서류 · 결근일수(5일 누적) · 교육이수 · 업체 · 거점
//   · 라이브 — 날짜를 갖는다. 그날그날 달라지는 사실.
//       이벤트(StoredEvent: 체크인·퇴근·정시체크) · 근태 프로필(StoredDutyProfile: 미출근·휴게·이동)
//
// 배치를 날짜별로 복제하지 않는 이유: 같은 110명이 5일 내내 같은 거점·같은 조로 나온다
// (DEPLOYMENT_PLAN). 복제하면 총원 139 가 417 이 되고, 물품 토글이 하루치 배치에만 먹으며,
// 현장앱 세션({assignmentId})이 날짜를 넘길 때마다 깨진다. 날짜를 가져야 하는 건 이벤트뿐이다.
//
// services 가 '현재 날짜 + 현재 시각'을 기준으로 이 사실들에서 상태·checks 를 파생한다.
// 기준 = 2026-10-21(수) 14:20 → 오전조 퇴근완료, 오후조 출근 중(미출근 3명 = B플로우 트리거).

import type {
  Zone, Issue, Notice, Coords, VendorDoc, PayoutInfo, EducationRecord, Employment,
  ScanEvent, ScanKind,
} from '../types'
import type { StoredAssignment, StoredEvent, StoredDutyProfile, StoredVendor } from '../lib/store'

// 오늘 = 3일차. 지난 이틀은 완주한 날이라 이벤트가 18:00 까지 꽉 차 있고,
// 오늘만 14:20 에서 멈춰 있다(오후조 진행 중).
export const D1 = '2026-10-19'
export const D2 = '2026-10-20'
export const SEED_DATE = '2026-10-21'
export const SEED_DATES = [D1, D2, SEED_DATE] as const

// ── 시각 헬퍼(시드 전용, clock 비의존) ────────────────────
const H = (h: number, m = 0) => h * 60 + m

// ① 거점 — 행사장 5구역 + 관광지 6거점. 조당 정원(quota) 합계 = 55.
//   ※ 유인/무인 구분(checkMode)은 없다. 출결은 전 거점 GPS 셀프 단일이고, 거점관리자 11명이
//     전 거점에 상주하므로 '무인 거점'이 존재하지 않는다. kind 는 장소 성격일 뿐이다.
//   행사장 30(8+6+6+5+5) · 관광지 25(4+4+4+5+4+4). 두 조 동일 배분 → 총 110.
//   ※ 스카시 포토존은 종합안내소 구역 내부 → 별도 거점 아님.
//   ※ 조직위 운영 구역은 우리 배치 대상 아님 → 거점 없음.
export const zones: Zone[] = [
  { id: 'z-info', name: '종합안내소', kind: 'venue', coords: { lat: 37.7726, lng: 128.9476 }, geofenceRadius: 60, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 8, present: 0 },
  { id: 'z-stage', name: '공연구역', kind: 'venue', coords: { lat: 37.7731, lng: 128.9481 }, geofenceRadius: 80, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 6, present: 0 },
  { id: 'z-food', name: '음식판매·휴게구역', kind: 'venue', coords: { lat: 37.7719, lng: 128.9469 }, geofenceRadius: 70, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 6, present: 0 },
  { id: 'z-photo', name: 'ITS 상징 포토존', kind: 'venue', coords: { lat: 37.7724, lng: 128.9487 }, geofenceRadius: 40, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 5, present: 0 },
  { id: 'z-support', name: '행사지원구역', kind: 'venue', coords: { lat: 37.7733, lng: 128.9464 }, geofenceRadius: 60, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 5, present: 0 },
  { id: 'z-market', name: '중앙시장·월화거리', kind: 'tourist', coords: { lat: 37.7519, lng: 128.8961 }, geofenceRadius: 120, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 4, present: 0 },
  { id: 'z-gyeongpo', name: '경포해변', kind: 'tourist', coords: { lat: 37.7955, lng: 128.9106 }, geofenceRadius: 150, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 4, present: 0 },
  { id: 'z-anmok', name: '안목해변', kind: 'tourist', coords: { lat: 37.7735, lng: 128.9473 }, geofenceRadius: 120, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 4, present: 0 },
  { id: 'z-jumunjin', name: '주문진항·수산시장', kind: 'tourist', coords: { lat: 37.8925, lng: 128.8317 }, geofenceRadius: 130, opWindow: { start: '10:00', end: '17:00' }, status: 'open', quota: 5, present: 0 },
  { id: 'z-gangmun', name: '강문해변', kind: 'tourist', coords: { lat: 37.7907, lng: 128.9169 }, geofenceRadius: 120, opWindow: { start: '11:00', end: '18:00' }, status: 'open', quota: 4, present: 0 },
  { id: 'z-ojuk', name: '오죽헌시립박물관', kind: 'tourist', coords: { lat: 37.7794, lng: 128.8784 }, geofenceRadius: 100, opWindow: { start: '10:00', end: '17:00' }, status: 'open', quota: 4, present: 0 },
]

// ── 이름·연락처·외국어 결정적 생성(랜덤·시각 비의존) ──────
const SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '유', '고', '문', '양', '손', '배', '백', '허', '남', '심']
const GIV = ['민준', '서연', '도윤', '하은', '시우', '지우', '예준', '수아', '주원', '지호', '건우', '채원', '우진', '다은', '현우', '유진', '지훈', '서윤', '준서', '하린', '도현', '예은', '시윤', '가은', '승우', '수빈', '지안', '유나', '태호', '서준', '민서', '하준', '예린', '지원', '도경', '세아', '현서', '나윤', '승현', '민재']
const LANGS = ['영어', '중국어', '일본어', '러시아어']

const nameOf = (i: number) => SUR[i % SUR.length] + GIV[(i * 7 + 3) % GIV.length]
const phoneOf = (i: number) =>
  `010-${String(2000 + ((i * 37) % 8000)).padStart(4, '0')}-${String(1000 + ((i * 53) % 9000)).padStart(4, '0')}`
const langOf = (i: number): string[] | undefined => (i % 3 === 0 ? [LANGS[(i * 5) % LANGS.length]] : undefined)
// 활동물품 지급 — 대부분 사전지급, 일부 미지급(물품지급 화면 대비 데이터 변주).
const goodsOf = (i: number) => ({ jacket: i % 13 !== 0, bag: i % 9 !== 0, issuedAt: '2026-10-18' })
// 정산 서류·지급계좌 — 실비 지급 사전 등록. 일부 미등록으로 두어 보완 동선이 살아있게 한다.
// 계좌번호는 가상 생성값(결정적). 실제 개인정보 아님.
const BANKS = ['농협', '신한', '국민', '카카오뱅크', '하나', '우리']
const payoutOf = (i: number, name: string): PayoutInfo => {
  const none = i % 17 === 0 // 완전 미등록
  const partial = !none && i % 23 === 0 // 서류만 있고 계좌 미등록
  if (none) return { idCard: false, bankbook: false }
  if (partial) return { idCard: true, bankbook: false, registeredAt: '2026-10-16' }
  return {
    idCard: true,
    bankbook: true,
    bankName: BANKS[i % BANKS.length],
    accountNo: `${String(100 + (i % 800)).padStart(3, '0')}-${String((i * 17) % 100).padStart(2, '0')}-${String(100000 + ((i * 971) % 900000))}`,
    holder: name,
    registeredAt: '2026-10-16',
  }
}
// 교육 이수(사람 단위) — 오프라인 통합교육 후 관리자 일괄 인증의 결과 기록.
// 사전 통합교육: 대부분 이수(미이수 소수 = 일괄 인증·미이수 드릴다운이 화면에서 의미 있게).
// 현장교육: 일부만 이수 → 개인 상세 이력 섹션이 교육구분별로 변화 있게 보인다.
const CERTIFIERS = ['운영본부 총괄', '자원봉사 담당', '거점 총괄']
// 교육 이수는 자원봉사자 항목이다(운영인력은 자체 교육 — gid 111~132 은 여기 안 들어온다).
// gid 1~110 배치 봉사자 · 133~139 예비. 예비 중 1명(p-135)을 미이수로 둬야 근무공백 대응의
// '미이수 soft 경고 + 이수자 우선 정렬'이 화면에서 실제로 보인다(전원 이수면 캡쳐 불가).
// 이수율 KPI 는 배치 봉사자만 세므로 이 예외는 92% 수치에 영향 없다.
const eduOf = (i: number): EducationRecord[] => {
  const recs: EducationRecord[] = []
  if (i % 13 !== 5 && i !== 135) // 미이수 소수(≈8%) — 나머지는 사전 통합교육 이수
    recs.push({
      kind: '사전 통합교육',
      certifiedBy: CERTIFIERS[i % CERTIFIERS.length],
      certifiedAt: `2026-10-17 ${14 + (i % 3)}:${String((i * 7) % 60).padStart(2, '0')}`,
    })
  if (i % 3 === 0) // 현장교육은 일부만
    recs.push({
      kind: '현장교육',
      certifiedBy: CERTIFIERS[(i + 1) % CERTIFIERS.length],
      certifiedAt: `2026-10-19 09:${String((i * 11) % 60).padStart(2, '0')}`,
    })
  return recs
}

// 결근 이력(5일 누적) — 정산은 계획일수가 아니라 실근무일수 기준.
// 대부분 무결근, 일부만 1~2일 결근(집행 잔액이 0이 아니게 하는 변주).
const absentDaysOf = (i: number) => (i % 37 === 0 ? 2 : i % 11 === 0 ? 1 : 0)

// 거점 좌표 근처의 GPS 좌표(체크인 이벤트용) — 결정적 미세 변위.
const nearby = (c: Coords, i: number): Coords => ({
  lat: +(c.lat + ((i % 5) - 2) * 0.0002).toFixed(6),
  lng: +(c.lng + (((i * 3) % 5) - 2) * 0.0002).toFixed(6),
})

// ── 운영인력(직영 스태프) ────────────────────────────────
// 자원봉사자 110명과 별개. 실비(24,000) 대상이 아니며 발주처 보고 대상도 아니다 —
// 직원은 급여라 정산에서 미산정, 일용만 시급 기준으로 산정한다.
//
// 거점관리자 11명 중 직원 2명(관리자 순번 1·2 = 종합안내소·공연구역).
// 나머지 9명은 일용 — 거점 상주·대면 확인은 일용으로 충당하는 현실 구성.
const MANAGER_EMPLOYEE_SEQ = new Set([1, 2])

// 현장운영 11명 — 운영본부 상주. 직원 4(책임 직무) + 일용 7.
// '거점 순회'를 3 → 2로 줄이고 1명을 거점관리자로 돌렸다(아래 ② 참조) — 순회 감사는
// SPEC §33 이 거점관리자 업무로 규정해 중복이었고, 거점에 상주시키는 편이 그 규정에 맞다.
const STAFF_ROSTER: { duty: string; employment: Employment }[] = [
  { duty: '운영 총괄', employment: '직원' },
  { duty: '안전 관리', employment: '직원' },
  { duty: '인력·정산', employment: '직원' },
  { duty: '민원 대응', employment: '직원' },
  { duty: '물품 관리', employment: '일용' },
  { duty: '물품 관리', employment: '일용' },
  { duty: '거점 순회', employment: '일용' },
  { duty: '거점 순회', employment: '일용' },
  { duty: '본부 지원', employment: '일용' },
  { duty: '본부 지원', employment: '일용' },
  { duty: '본부 지원', employment: '일용' },
]

// 현장운영 근무시간 — 1일 10시간(08:30~18:30). 봉사자 4시간 교대보다 길다(설치·정리 포함).
// 시급 × 이 시간 = 일급. 둘 다 화면 입력값이므로 여기 값은 초기값일 뿐이다.
const STAFF_IN_MIN = H(8, 30)
const STAFF_OUT_MIN = H(18, 30)
export const STAFF_HOURS_PER_DAY = 10
export const STAFF_HOURLY_WAGE = 12000 // 일급 120,000 = 12,000 × 10h

// 일용근로소득 원천징수 — 사업소득 3.3%(자원봉사자)와 세목이 다르다.
//   (일급 − 150,000) × 6% × (1 − 55% 근로소득세액공제) = (일급 − 150,000) × 2.7%
//   + 지방소득세 10% → 총 2.97%. 15만원 공제는 1일당이라 근무일수와 무관하게 매일 적용된다.
//   → 일급 15만원 이하면 과세표준이 0이라 원천징수도 0원.
export const DAILY_WAGE_DEDUCTION = 150000
export const DAILY_WAGE_TAX_RATE = 2.97

// ── 특수 프로필 태그 — (zoneId|shift|localIdx) 키 ─────────
// 오늘(10/21) 14:20 시나리오를 의도적으로 심는다. §5 보고용 근거.
// ⚠️ 오늘 전용이다 — 지난 이틀에 그대로 적용하면 '3일 내리 같은 3명이 미출근'이라는
// 시드가 지어낸 우연이 생긴다. 지난 날의 미출근은 absentDays(마스터)에서 유도한다(pastNoShow).
const NOSHOW = new Set(['z-jumunjin|PM|0', 'z-jumunjin|PM|1', 'z-gyeongpo|PM|0']) // 오후조 미출근 3명 → 근무공백 2거점
const PM_MISSED = new Set(['z-info|PM|2']) // 출근했으나 14:00 정시체크 누락 → soft 경보
const PM_BREAK = new Set(['z-food|PM|1']) // 오후 휴게 로테이션 중
const PM_MOVING = new Set(['z-photo|PM|1']) // 거점 간 이동 중
const AM_MISSED = new Set(['z-info|AM|3']) // 오전조 13:00 정시체크 누락(이력)

const key = (zoneId: string, shift: 'AM' | 'PM', idx: number | 'mgr') => `${zoneId}|${shift}|${idx}`

// 지난 날의 미출근 — absentDays(정산 마스터, 5일 누적)에서 유도한다.
// 정산이 "결근 2일"이라 적어놓고 관제 이력엔 개근으로 보이면 화면 둘이 서로 다른 말을 한다.
// 오늘(10/21)의 NOSHOW 3명은 여기 안 들어온다 — 오늘은 아직 안 끝났고(예비 투입으로 메워질 수
// 있다) absentDays 는 확정 사실이라, 둘을 잇는 건 오늘이 끝난 뒤의 일이다(store 주석 참조).
const pastNoShow = (g: number, date: string): boolean => {
  const ad = absentDaysOf(g)
  if (ad >= 2) return date === D1 || date === D2
  // 1일 결근은 두 날에 갈라 심는다 — 전부 1일차에 몰면 '첫날만 12명 결근'이라는 없는 사건이 생긴다.
  if (ad === 1) return date === (g % 2 === 0 ? D1 : D2)
  return false
}

// ── 배치(현황) + 이벤트·근태 프로필(라이브) 생성 ─────────
const assignments: StoredAssignment[] = []
const events: StoredEvent[] = []
const dutyProfiles: StoredDutyProfile[] = []
const volunteersOf: Record<string, { AM: string[]; PM: string[] }> = {} // zoneId → 조별 봉사자 배치 id
let gid = 0
let eid = 0

const AM_SLOTS = [H(10), H(11), H(12), H(13)]
const PM_SLOTS = [H(14), H(15), H(16), H(17)]

function pushEvent(
  a: StoredAssignment,
  kind: StoredEvent['kind'],
  date: string,
  timeMin: number,
  extra: Partial<StoredEvent> = {}
) {
  if (!a.zoneId) return
  eid++
  events.push({
    id: `ev-${eid}`,
    // ⚠️ 날짜가 멱등키에 들어가야 한다. 없으면 3일치가 같은 키를 갖고 hasEventKey 가
    // 뒤 이틀을 통째로 삼킨다(store.addEvent 는 키 중복이면 조용히 무시한다).
    idempotencyKey: `seed:${a.id}:${date}:${kind}:${extra.slot ?? timeMin}`,
    assignmentId: a.id,
    kind,
    date,
    timeMin,
    slot: extra.slot,
    gps: extra.gps,
    anomaly: extra.anomaly,
  })
}

const zoneById = (id: string) => zones.find((z) => z.id === id)!

// 하루치 근태 이벤트 생성.
// isToday 가 갈림길이다: 오늘은 14:20 에서 시간이 멈춰 있어 오후조가 진행 중이므로 15·16·17시
// 슬롯과 퇴근이 아직 없다. 지난 이틀은 완주한 날이라 18:00 까지 꽉 차야 한다 —
// 안 그러면 스크러버를 10/20 17:00 으로 밀었을 때 오후조 전원이 '정시체크 누락'으로 뜬다.
function seedDutyEvents(a: StoredAssignment, z: Zone, g: number, k: string, date: string) {
  const isToday = date === SEED_DATE
  // 전 거점 GPS 셀프 — 이전엔 checkMode 로 유인 거점(scan)과 갈렸고, 유인 거점 이벤트에는
  // gps 좌표가 아예 없었다. 그 경로가 사라져 전 거점이 좌표를 남긴다.
  const gps = nearby(z.coords, g)
  // 시각 변주에 날짜를 섞는다 — 안 그러면 3일이 초 단위까지 똑같아 복붙 티가 난다.
  const j = g + SEED_DATES.indexOf(date as (typeof SEED_DATES)[number]) * 3

  if (a.shift === 'AM') {
    // 오전조: 출근(09:50~09:58, 첫 슬롯 前) → 정시 10·11·12·13 → 퇴근(13:58~14:06)
    pushEvent(a, 'checkin', date, H(9, 50) + (j % 9), { gps: gps && nearby(z.coords, j + 1) })
    for (const slot of AM_SLOTS) {
      if (isToday && AM_MISSED.has(k) && slot === H(13)) continue // 13:00 누락(이력)
      pushEvent(a, 'hourly', date, slot + (j % 4), { slot, gps: gps && nearby(z.coords, j + slot) })
    }
    pushEvent(a, 'checkout', date, H(13, 58) + (j % 8))
  } else {
    // 오후조: 출근(13:52~14:00, 첫 슬롯 前) → 정시 14·15·16·17 → 퇴근(17:58~18:06)
    const anomaly =
      isToday && k === 'z-market|PM|1'
        ? `지오펜스 경계(${z.geofenceRadius}m) 근접 — 이상치 기록(차단 아님)`
        : undefined
    pushEvent(a, 'checkin', date, H(13, 52) + (j % 9), { gps: gps && nearby(z.coords, j + 2), anomaly })
    for (const slot of PM_SLOTS) {
      if (isToday && slot > H(14)) break // 오늘은 14:20 — 15시 이후는 아직 오지 않은 슬롯
      if (isToday && PM_MISSED.has(k) && slot === H(14)) continue
      pushEvent(a, 'hourly', date, slot + (j % 5), { slot, gps: gps && nearby(z.coords, j + slot) })
    }
    if (!isToday) pushEvent(a, 'checkout', date, H(17, 58) + (j % 8))
  }
}

// ── ① 자원봉사자 110명 (gid 1~110) ──────────────────────
// 거점 정원(quota)은 '자원봉사자 정원'이다 — RFP 3-1 의 110명은 자원봉사자 수(SPEC §32·§125).
// 거점관리자는 이 정원 밖의 운영인력이므로 아래 ②에서 따로 얹는다.
for (const z of zones) {
  for (const shift of ['AM', 'PM'] as const) {
    for (let idx = 0; idx < z.quota; idx++) {
      gid++
      const k = key(z.id, shift, idx)
      const a: StoredAssignment = {
        id: `as-${gid}`,
        personId: `p-${gid}`,
        personName: nameOf(gid),
        phone: phoneOf(gid),
        kind: '자원봉사자',
        role: '봉사자',
        lang: langOf(gid),
        isReserve: false,
        shift,
        zoneId: z.id,
        plannedInMin: shift === 'AM' ? H(10) : H(14),
        goods: goodsOf(gid),
        absentDays: absentDaysOf(gid),
        payout: payoutOf(gid, nameOf(gid)),
      }
      assignments.push(a)
      ;(volunteersOf[z.id] ??= { AM: [], PM: [] })[shift].push(a.id)

      // 라이브 — 날짜마다 따로. 미출근이면 이벤트 없이 프로필만 남는다(미출근의 증거는 부재다).
      for (const date of SEED_DATES) {
        const noShow = date === SEED_DATE ? NOSHOW.has(k) : pastNoShow(gid, date)
        if (noShow) {
          dutyProfiles.push({ assignmentId: a.id, date, noShow: true })
          continue
        }
        if (date === SEED_DATE && PM_BREAK.has(k))
          dutyProfiles.push({
            assignmentId: a.id, date,
            breaks: [{ startMin: H(14, 8), endMin: H(14, 40), note: '오후 휴게 로테이션' }],
          })
        if (date === SEED_DATE && PM_MOVING.has(k))
          dutyProfiles.push({
            assignmentId: a.id, date,
            moving: { startMin: H(14, 12), endMin: H(14, 32), note: '포토존 → 행사지원구역 지원' },
          })
        seedDutyEvents(a, z, gid, k, date)
      }
    }
  }
}

// ── ② 운영인력 · 거점관리자 11명 (gid 111~121) ───────────
// 거점 11개 × 1명 — 전 거점에 관리자를 둔다. 이전 시드는 유인(venue) 5개 거점에만
// 조별 1명씩(=10명) 두어 관광(tourist) 6개 거점의 자원봉사자 50명이 무관리 상태였다.
//
// 관리자는 교대하지 않는다. 자원봉사자는 실비 대상 4시간 교대지만 관리자는 직영 운영인력이라
// 1일 10시간 상주하며 오전조·오후조를 모두 관장한다. 정산은 이미 이 전제로 지급 중이었고
// (getStaffSettlement: 운영인력 = 시급 × 10h × 5일, 교대 무관) 시드만 교대에 묶여 어긋나 있었다.
// → shift 는 스키마 필수라 'AM'을 넣되 의미 없다. 근태는 plannedIn/OutMin 으로만 파생한다(현장운영과 동일).
//
// 활동물품·정산서류·교육이수는 자원봉사자 항목이므로 부여하지 않는다.
let mgrSeq = 0
const managerOf: Record<string, string> = {} // zoneId → 관리자 배치 id(스캔을 찍는 사람)
for (const z of zones) {
  gid++
  mgrSeq++
  managerOf[z.id] = `as-${gid}`
  assignments.push({
    id: `as-${gid}`,
    personId: `p-${gid}`,
    personName: nameOf(gid),
    phone: phoneOf(gid),
    kind: '운영인력',
    role: '거점관리자',
    employment: MANAGER_EMPLOYEE_SEQ.has(mgrSeq) ? '직원' : '일용',
    lang: langOf(gid),
    isReserve: false,
    shift: 'AM',
    zoneId: z.id,
    plannedInMin: STAFF_IN_MIN,
    plannedOutMin: STAFF_OUT_MIN,
    absentDays: 0, // 관리자는 무결근(거점 공백 불가)
  })
}

// ── ③ 운영인력 · 현장운영 12명 (gid 121~132) ─────────────
// 운영본부 상주 — 거점 배치·정시체크 없음(교대가 아니라 1일 10시간 상주 근무).
// shift 는 스키마 필수라 'AM'으로 두되, 근태는 plannedIn/OutMin 으로만 파생한다.
STAFF_ROSTER.forEach((s, i) => {
  gid++
  assignments.push({
    id: `as-${gid}`,
    personId: `p-${gid}`,
    personName: nameOf(gid),
    phone: phoneOf(gid),
    kind: '운영인력',
    role: '현장운영',
    employment: s.employment,
    lang: langOf(gid),
    isReserve: false,
    shift: 'AM',
    zoneId: null,
    plannedInMin: STAFF_IN_MIN,
    plannedOutMin: STAFF_OUT_MIN,
    absentDays: s.employment === '일용' && i % 5 === 0 ? 1 : 0, // 일용 일부 결근 → 정산 일할계산 근거
  })
})

// ── 예비인력 pool(별도 유지 — 배치 안 된 상태, 110 에 미포함) ──
// 대기 위치를 권역별로 분산 → 근무공백 발생 시 '거리' 산정이 실데이터가 됨.
const STANDBY_POINTS: Coords[] = [
  zoneById('z-info').coords, // 행사장(운영본부권)
  zoneById('z-gyeongpo').coords, // 북부 해변권
  zoneById('z-market').coords, // 시내권
]
const RESERVE_COUNT = 7
for (let r = 0; r < RESERVE_COUNT; r++) {
  gid++
  assignments.push({
    id: `rs-${r + 1}`,
    personId: `p-${gid}`,
    personName: nameOf(gid),
    phone: phoneOf(gid),
    kind: '자원봉사자', // 예비도 자원봉사자 — 결원 발생 시 봉사자 자리를 메운다
    role: '봉사자',
    lang: r % 2 === 0 ? [LANGS[r % LANGS.length]] : undefined,
    isReserve: true,
    shift: 'PM', // 현재 조 대기
    zoneId: null,
    plannedInMin: H(14),
    standby: nearby(STANDBY_POINTS[r % STANDBY_POINTS.length], gid),
    goods: goodsOf(gid),
    payout: payoutOf(gid, nameOf(gid)),
  })
}

// ── ⑦ 스캔 시드(QR = 서명) ──────────────────────────────
// 스캔은 증거 전용 층이다 — 아무것도 구동하지 않는다. 출결도 물품지급 현황도 안 건드린다.
// 그래서 이 시드가 없어도 화면은 전부 정상이고, 있으면 '사후 대조할 기록'이 생긴다.
//
// ⚠️ '활동물품수령'은 일부러 안 심는다. 시드상 활동물품은 10/18 사전 일괄배부(goodsOf)라
//    행사 당일 수령 서명을 만들면 그 자체가 모순이다. 남은 미지급자 수령은 라이브로 찍는다.
//
// 거점 기반이 아니다 — ScanEvent 에 zoneId 가 없다. 아래에서 관리자가 자기 거점 봉사자를
// 찍는 건 모델의 제약이 아니라 그냥 물리적으로 그렇게 되기 때문이다.
const scans: ScanEvent[] = []
let scid = 0
function pushScan(
  subjectId: string, scannerId: string, kind: ScanKind, date: string, timeMin: number, note: string, zoneId: string
) {
  // 오늘은 14:20 에서 멈춰 있다 — 그 뒤 시각의 서명은 아직 존재하지 않는다.
  if (date === SEED_DATE && timeMin > H(14, 20)) return
  scid++
  const z = zoneById(zoneId)
  scans.push({
    id: `sc-${scid}`,
    idempotencyKey: `seed:${subjectId}:${date}:${kind}:${timeMin}`, // 날짜 없으면 3일치가 충돌한다
    subjectId, scannerId, kind, note, date, timeMin,
    gps: nearby(z.coords, scid), // 찍은 사람의 위치. 대면이므로 이 하나로 양쪽이 증명된다
  })
}

for (const date of SEED_DATES) {
  for (const z of zones) {
    const mgr = managerOf[z.id]
    const v = volunteersOf[z.id]
    if (!mgr || !v) continue
    const d = SEED_DATES.indexOf(date)
    // 대면확인 — 옛 순회 감사를 대체한다. 관리자가 그 사람 앞에 가서 찍는다.
    if (v.AM[d % v.AM.length]) pushScan(v.AM[d % v.AM.length], mgr, '대면확인', date, H(11, 10 + d * 7), '정위치 근무 확인', z.id)
    if (v.PM[(d + 1) % v.PM.length]) pushScan(v.PM[(d + 1) % v.PM.length], mgr, '대면확인', date, H(15, 20 + d * 5), '정위치 근무 확인', z.id)
    // 현장물품수령 — RFP 11. "근무 기간 중 생수, 간식 등 물품 배부". 반복·정산 무관이라
    // GoodsIssue(1인 1세트 마스터)로는 표현이 불가능했던 자리다.
    if (v.AM[(d + 2) % v.AM.length]) pushScan(v.AM[(d + 2) % v.AM.length], mgr, '현장물품수령', date, H(12, 30 + d * 3), d === 2 ? '생수 2병' : '생수 2병·간식', z.id)
  }
}
// 지시인수 — 거점 대면 인스턴트 지시의 확인. 온라인 공지 ack 이 아니다.
// 오늘 오후 강풍 예보(nt-2, 13:50)에 붙는 현장 지시.
for (const zid of ['z-gyeongpo', 'z-anmok', 'z-gangmun', 'z-photo']) {
  const v = volunteersOf[zid]
  if (v?.PM[0]) pushScan(v.PM[0], managerOf[zid], '지시인수', SEED_DATE, H(14, 12), '강풍 대비 — 야외 게시물 결속·대피 동선 전달', zid)
}

export { assignments, events, dutyProfiles, scans }

// 교육 이수 시드 — personId 키. 배치가 아니라 '사람'에 귀속되므로 별도 테이블로 둔다.
// (같은 사람이 여러 날 배치를 가져도 이수는 한 번만 기록된다.)
// 사전 통합교육은 자원봉사자 대상 — 운영인력은 직영 스태프라 자체 교육 체계이므로 여기 없다.
export const readiness: Record<string, EducationRecord[]> = Object.fromEntries(
  assignments
    .map((a, i) => [a, i + 1] as const)
    .filter(([a]) => a.kind === '자원봉사자')
    .map(([a, n]) => [a.personId, eduOf(n)])
)

// ④ 이슈 ────────────────────────────────────────────────
export const issues: Issue[] = [
  { id: 'is-1', type: '분실물', zoneId: 'z-info', status: 'in_progress', time: '13:34', message: '검정 백팩 습득 — 종합안내소 보관, 소유자 확인 중' },
  { id: 'is-2', type: '미아', zoneId: 'z-stage', status: 'resolved', time: '12:20', message: '미아(여, 6세) 보호 → 보호자 인계 완료' },
  { id: 'is-3', type: '시설이상', zoneId: 'z-food', status: 'received', time: '14:11', message: '음식구역 손세정대 수압 약함 — 점검 요청' },
  { id: 'is-4', type: '민원', zoneId: 'z-photo', status: 'received', time: '14:17', message: '포토존 대기줄 안내 인력 보강 요청' },
]

// ⑤ 먹거리 입점업체 등록 — 본공고 3-1: 푸드트럭 5 · 음식부스 5(파라솔 80).
// 상호는 품목 기반 가명(블라인드 — 실존 업체·제휴사명 금지). 강릉 로컬 품목으로 구성.
// 등록 대장이므로 시간 비의존. 서류 일부 미비를 심어 이행률이 100%가 아니게 둔다.
const DOC_LABELS: { id: string; label: string }[] = [
  { id: 'd-permit', label: '영업신고증 사본' },
  { id: 'd-health', label: '종사자 건강진단결과서' },
  { id: 'd-insure', label: '영업배상책임보험 증권' },
  { id: 'd-fire', label: '소화기 비치 확인(K급 포함)' },
  { id: 'd-gas', label: 'LPG·화기 취급 안전점검' },
]
// missing = 미등록 서류 id. 나머지는 등록 완료(at = 등록일).
const docsOf = (missing: string[], at: string): VendorDoc[] =>
  DOC_LABELS.map((d) => (missing.includes(d.id) ? { ...d, done: false } : { ...d, done: true, at }))

export const foodVendors: StoredVendor[] = [
  // ── 푸드트럭 5 (T존) ──
  { id: 'fv-t1', name: '강릉 커피트럭', kind: 'truck', items: '핸드드립·아메리카노·라떼', spot: 'T-1', opHours: '10:00–18:00', contact: '010-3921-4477', docs: docsOf([], '2026-10-12'), registeredAt: '2026-10-12' },
  { id: 'fv-t2', name: '감자옹심이 트럭', kind: 'truck', items: '감자옹심이·감자전', spot: 'T-2', opHours: '11:00–18:00', contact: '010-2884-1063', docs: docsOf([], '2026-10-12'), registeredAt: '2026-10-12' },
  { id: 'fv-t3', name: '소떡소떡 트럭', kind: 'truck', items: '소떡소떡·핫도그', spot: 'T-3', opHours: '10:00–17:00', contact: '010-5517-2290', docs: docsOf(['d-gas'], '2026-10-13'), registeredAt: '2026-10-13', note: 'LPG 안전점검 미완 — 개장 전 확인 필요' },
  { id: 'fv-t4', name: '수제버거 트럭', kind: 'truck', items: '수제버거·감자튀김', spot: 'T-4', opHours: '11:00–19:00', contact: '010-7302-8815', docs: docsOf([], '2026-10-13'), registeredAt: '2026-10-13' },
  { id: 'fv-t5', name: '아이스크림 트럭', kind: 'truck', items: '소프트아이스크림·에이드', spot: 'T-5', opHours: '12:00–19:00', contact: '010-4468-9931', docs: docsOf(['d-health'], '2026-10-14'), registeredAt: '2026-10-14', note: '종사자 1명 건강진단결과서 미제출' },
  // ── 음식부스 5 (B존) ──
  { id: 'fv-b1', name: '초당순두부 부스', kind: 'booth', items: '순두부백반·모두부', spot: 'B-1', opHours: '10:00–18:00', contact: '010-6640-3372', docs: docsOf([], '2026-10-12'), registeredAt: '2026-10-12' },
  { id: 'fv-b2', name: '강릉짬뽕 부스', kind: 'booth', items: '짬뽕·탕수육', spot: 'B-2', opHours: '11:00–18:00', contact: '010-2215-7708', docs: docsOf([], '2026-10-12'), registeredAt: '2026-10-12' },
  { id: 'fv-b3', name: '닭강정 부스', kind: 'booth', items: '닭강정·튀김', spot: 'B-3', opHours: '10:00–18:00', contact: '010-8873-1154', docs: docsOf(['d-insure'], '2026-10-14'), registeredAt: '2026-10-14', note: '배상책임보험 증권 갱신본 대기' },
  { id: 'fv-b4', name: '막국수 부스', kind: 'booth', items: '메밀막국수·수육', spot: 'B-4', opHours: '11:00–17:00', contact: '010-3097-5526', docs: docsOf([], '2026-10-13'), registeredAt: '2026-10-13' },
  { id: 'fv-b5', name: '오징어순대 부스', kind: 'booth', items: '오징어순대·해산물전', spot: 'B-5', opHours: '10:00–16:00', contact: '010-5734-2681', docs: docsOf(['d-permit', 'd-health'], '2026-10-15'), registeredAt: '2026-10-15', note: '신규 입점 — 영업신고증·건강진단결과서 접수 대기' },
]

export const FOOD_PARASOLS = 80 // 음식판매·휴게구역 파라솔(본공고 3-1 정량 스펙)

// ⑥ 공지·안내기준 ───────────────────────────────────────
// audience = 구분 × 역할 × 거점(types.ts §Audience). {} = 전원.
export const notices: Notice[] = [
  { id: 'nt-1', title: '오후조 교대 안내', body: '14:00 오전조 퇴근·오후조 투입 완료 확인. 미출근 인력 즉시 예비 대체.', audience: {}, time: '13:55' },
  { id: 'nt-2', title: '기상 안내', body: '오후 3시경 강풍 예보 — 야외 포토존·해변거점 안전고지 문안 통일 배포.', audience: {}, time: '13:50' },
  { id: 'nt-3', title: '셔틀 운행 안내 문안', body: '방문객 문의 대비 셔틀 배차 간격·정류장 안내 표준 문안.', audience: { zoneIds: ['z-info', 'z-market', 'z-gyeongpo'] }, time: '09:10' },
  { id: 'nt-4', title: '거점 순회점검 결과 보고 요청', body: '오후조 투입 완료 후 거점별 안전·위생 점검 결과를 15:30까지 본부로 회신.', audience: { roles: ['거점관리자'] }, time: '14:05' },
  { id: 'nt-5', title: '운영인력 본부 상황공유', body: '금일 방문객 증가 추세 — 민원·물품 지원 요청 대기. 본부 무전 채널 상시 청취.', audience: { kinds: ['운영인력'] }, time: '13:40' },
]

// ── 실비 배치계획(5일) — computeExpenses 근거. 월~목 110 · 금 55(1교대). ──
export const DEPLOYMENT_PLAN: { date: string; headcount: number; shifts: number }[] = [
  { date: '2026-10-19', headcount: 110, shifts: 2 }, // 월
  { date: '2026-10-20', headcount: 110, shifts: 2 }, // 화
  { date: '2026-10-21', headcount: 110, shifts: 2 }, // 수
  { date: '2026-10-22', headcount: 110, shifts: 2 }, // 목
  { date: '2026-10-23', headcount: 55, shifts: 1 }, // 금 — 10:00~13:00 1교대(탄력 조정)
]

export const EXPENSE_UNIT_PER_DAY = 24000 // RFP 3-1: 자원봉사자 1인당(교대근무자별) 24,000원 — 지급물품 대금 포함
export const ACTIVITY_GOODS_SETS = 110 // 바람막이·가방 세트 — 1인 1세트
// 물품 세트 단가 초기값(원). 확정 단가가 아니라 화면에서 조정하는 입력값의 시작점.
// 이 값이 일일 지급기준을 결정한다: 일일 지급기준 = 24,000 − (세트단가 ÷ 4.5).
export const ACTIVITY_GOODS_UNIT_COST = 35000
// 원천징수율 초기값(%) — 3.3% = 사업소득 3% + 지방소득세 0.3%. 화면에서 조정하는 입력값.
export const WITHHOLDING_RATE = 3.3
