// 방문객앱 발행 콘텐츠 — 단일 원본(콘솔 데이터) → 발행 뷰(방문객).
//
// CMS 없음(D54): 산문·구조화 콘텐츠는 코드에 둔다. 편집 = 코드 변경.
// - 척추 재사용: 관광 6거점·행사장 구역·음식부스·비상·셔틀은 store/info 에서 그대로 가져온다.
// - 신규 발행 엔티티: 공연 타임테이블 · 도심 맛집(§2-3, 행사장 FoodVendor 와 별개 D55) · 편의시설.
//   실 데이터는 발주기관 확정분으로 교체할 자리 — 지금은 대표 더미(공식홈/RFP 근거 반영).

import { rawZones, rawVendors } from './store'
import { EMERGENCY_CONTACTS, SHUTTLE_INFO } from './info'
import { OPS_INFO } from './services'

export { EMERGENCY_CONTACTS, SHUTTLE_INFO }

// ── 행사 개요(공식홈 히어로 + RFP 행사개요) ──────────────
export const EVENT = {
  name: OPS_INFO.eventName, // 2026 제32회 강릉 ITS 세계총회 부대행사
  tagline: 'Beyond Mobility, Connected World',
  period: '2026.10.19(월) – 10.23(금)',
  startDate: '2026-10-19',
  endDate: '2026-10-23',
  place: '강릉 올림픽파크 일원',
  host: '국토교통부 · 강릉시',
  organizer: '제32회 강릉 ITS 세계총회 조직위원회 · ITS Korea',
}

// RFP 과업목적 요약(개요 산문) — 해설 아닌 소개 문안.
export const ABOUT_INTRO = [
  '전시·학술 중심의 국제행사를 넘어, 일반 방문객이 함께 즐기는 축제형 국제행사입니다.',
  '공연·음식·포토존·도시 홍보로 강릉의 도시 브랜드를 알리고, 방문객의 체류와 지역 관광·소비를 잇습니다.',
]

// ── 척추 재사용: 구역·관광거점·행사장 음식부스 ───────────
export const VENUE_ZONES = rawZones().filter((z) => z.kind === 'venue')
export const TOURIST_ZONES = rawZones().filter((z) => z.kind === 'tourist')
export const VENUE_VENDORS = rawVendors() // 행사장 음식판매·휴게 구역(부스5·푸드트럭5)

// ── 공연 타임테이블(신규 발행 엔티티) ────────────────────
// org='조직위' = 조직위 운영 구역(드론쇼·아이스쇼). 나머지 = 강릉시 부대행사.
export interface Performance {
  time: string
  title: string
  place: string
  org?: '조직위'
}
export const PERFORMANCES: Performance[] = [
  { time: '11:00', title: '개막 축하공연', place: '공연구역' },
  { time: '13:00', title: '전통국악 버스킹', place: '공연구역' },
  { time: '14:30', title: '다문화 어울림 무대', place: '공연구역' },
  { time: '16:00', title: '청년 K-POP 커버 무대', place: '공연구역' },
  { time: '17:30', title: '어쿠스틱 버스킹', place: '음식·휴게구역' },
  { time: '19:00', title: '드론 라이트 쇼', place: '올림픽파크 상공', org: '조직위' },
  { time: '20:00', title: '아이스 쇼', place: '강릉 아이스아레나', org: '조직위' },
]

// 체험·포토존
export const EXPERIENCES = [
  { title: 'ITS 상징 포토존', place: '도시홍보 구역' },
  { title: '스카시 포토존', place: '강릉 홍보관 앞' },
  { title: '전통문화·다문화 체험', place: '문화관광 구역', org: '조직위' },
  { title: 'AI 로봇·VR 체험', place: '기술체험 구역', org: '조직위' },
]

// ── 편의시설(신규 발행) ──────────────────────────────────
export const FACILITIES = [
  { label: '종합안내소', spot: '중앙 광장' },
  { label: '화장실', spot: '공연구역 · 음식구역 · 주차장' },
  { label: '수유실', spot: '종합안내소 옆' },
  { label: '의무실', spot: '행사지원 구역' },
  { label: '물품보관·유실물', spot: '종합안내소' },
  { label: '휴대폰 충전', spot: '휴게 구역' },
]

// ── 교통(RFP 이동거점) ───────────────────────────────────
export const TRANSPORT = {
  hubs: ['강릉역', '시외버스터미널', '월화거리', '안목해변', '경포권'],
  parking: '올림픽파크 제1·2주차장 · 행사 기간 혼잡, 대중교통·셔틀 권장',
  transit: '강릉역·터미널에서 시내버스 202·300번 · 택시 10–15분',
}

// ── 도심 맛집(§2-3 음식점 지도 · 행사장 FoodVendor 와 별개 D55) ──
// 쿠폰 = 자율 혜택형(표시만) · 정산형 없음. 참여업소 확정분으로 교체할 자리.
export interface CityRestaurant {
  name: string
  category: string
  area: string
  signature: string
  price: string
  hours: string
  coupon?: string // 자율 혜택(할인·음료·사은품) — 표시만
  foreignMenu?: boolean
}
// category = 필터 taxonomy(소개로 카테고리 개념) · signature = 대표메뉴 상세.
export const CITY_RESTAURANTS: CityRestaurant[] = [
  { name: '초당할머니순두부', category: '한식', area: '초당동', signature: '초당순두부백반', price: '9,000', hours: '07:00–20:00', coupon: '식혜 1잔 제공', foreignMenu: true },
  { name: '안목 물회마을', category: '해산물', area: '안목해변', signature: '모둠물회', price: '16,000', hours: '10:00–21:00', coupon: '10% 할인' },
  { name: '봉봉 커피로스터스', category: '카페', area: '안목 커피거리', signature: '핸드드립·강릉커피', price: '6,000', hours: '09:00–22:00', coupon: '사이즈 업', foreignMenu: true },
  { name: '중앙시장 닭강정', category: '분식', area: '중앙시장', signature: '강릉 닭강정', price: '12,000', hours: '09:00–21:00', coupon: '토핑 추가' },
  { name: '교동짬뽕', category: '중식', area: '교동', signature: '차돌짬뽕', price: '10,000', hours: '10:30–20:30' },
  { name: '초당막국수', category: '한식', area: '초당동', signature: '메밀막국수·수육', price: '9,000', hours: '10:00–20:00', foreignMenu: true },
  { name: '주문진 회센터', category: '해산물', area: '주문진항', signature: '자연산 모둠회', price: '35,000', hours: '09:00–21:00', coupon: '음료 제공' },
  { name: '경포 베이커리', category: '카페', area: '경포호', signature: '수제 소금빵·커피', price: '5,500', hours: '08:00–22:00', foreignMenu: true },
]

// 맛집 카테고리 칩(소개로 개념) — '전체' + 등장 카테고리.
export const RESTAURANT_CATEGORIES = ['전체', ...Array.from(new Set(CITY_RESTAURANTS.map((r) => r.category)))]

// 쿠폰(자율 혜택형 · 표시만) — 마이페이지 쿠폰북 발행분.
export interface Coupon {
  store: string
  benefit: string
  note: string
}
export const COUPONS: Coupon[] = CITY_RESTAURANTS.filter((r) => r.coupon).map((r) => ({
  store: r.name,
  benefit: r.coupon!,
  note: '행사 기간 · 1회 · 현장 제시',
}))

// 홈 하이라이트(오늘) — 대표 소식(런타임 공지는 별도).
export const HIGHLIGHTS = [
  { tag: '오늘', title: '19:00 드론 라이트 쇼', place: '올림픽파크 상공' },
  { tag: '쿠폰', title: '도심 맛집 쿠폰북 오픈', place: '맛집 · 마이페이지' },
  { tag: '포토존', title: 'ITS 상징 포토존 운영', place: '도시홍보 구역' },
]
