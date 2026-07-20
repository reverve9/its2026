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
export interface MenuItem {
  name: string
  price: string // 원 단위 콤마 표기
  sig?: boolean // 대표메뉴(모달에서 배지)
}
export interface CityRestaurant {
  name: string
  category: string
  area: string
  address: string // 상세주소(소개로 상세 IA — 모달 표기)
  phone: string // 연락처(모달 표기 · tel 링크)
  signature: string
  price: string
  hours: string
  desc: string // 매장 소개글(소개로 상세) — 모달 전용
  menu: MenuItem[] // 상세 메뉴(무산 부스 모달 메뉴 리스트) — 모달 전용. sig=대표(=signature/price)
  tags?: string[] // 편의(주차·포장·단체석·뷰 등) — 표시만
  coupon?: string // 자율 혜택(할인·음료·사은품) — 표시만
  foreignMenu?: boolean
}
// category = 필터 taxonomy(소개로 카테고리 개념) · signature/price = 카드 요약(=menu 대표).
// address/phone/desc/menu/tags = 모달 상세(소개로 IA + 무산 메뉴)·더미. 참여업소 확정분으로 교체.
export const CITY_RESTAURANTS: CityRestaurant[] = [
  {
    name: '초당할머니순두부', category: '한식', area: '초당동', address: '강릉시 초당순두부길 47', phone: '033-652-2058',
    signature: '초당순두부백반', price: '9,000', hours: '07:00–20:00',
    desc: '3대째 이어온 초당 순두부. 매일 아침 짜낸 손두부로 끓여내는 순두부백반이 대표 메뉴다.',
    menu: [
      { name: '초당순두부백반', price: '9,000', sig: true },
      { name: '얼큰순두부', price: '9,500' },
      { name: '순두부전골(2인)', price: '22,000' },
      { name: '모두부', price: '8,000' },
    ],
    tags: ['주차', '포장', '단체석'], coupon: '식혜 1잔 제공', foreignMenu: true,
  },
  {
    name: '안목 물회마을', category: '해산물', area: '안목해변', address: '강릉시 창해로14번길 20', phone: '033-653-7000',
    signature: '모둠물회', price: '16,000', hours: '10:00–21:00',
    desc: '안목해변 앞 물회 전문점. 제철 활어를 시원한 얼음육수에 말아내는 모둠물회로 유명하다.',
    menu: [
      { name: '모둠물회', price: '16,000', sig: true },
      { name: '회덮밥', price: '13,000' },
      { name: '물회비빔', price: '15,000' },
      { name: '해물매운탕', price: '20,000' },
    ],
    tags: ['바다뷰', '주차'], coupon: '10% 할인',
  },
  {
    name: '봉봉 커피로스터스', category: '카페', area: '안목 커피거리', address: '강릉시 창해로17번길 8', phone: '033-651-8800',
    signature: '핸드드립·강릉커피', price: '6,000', hours: '09:00–22:00',
    desc: '안목 커피거리의 로스터리 카페. 직접 볶은 원두로 내리는 핸드드립이 시그니처다.',
    menu: [
      { name: '핸드드립(강릉)', price: '6,000', sig: true },
      { name: '아메리카노', price: '4,500' },
      { name: '카페라떼', price: '5,000' },
      { name: '수제 밀크티', price: '5,500' },
    ],
    tags: ['테라스', '와이파이', '포장'], coupon: '사이즈 업', foreignMenu: true,
  },
  {
    name: '중앙시장 닭강정', category: '분식', area: '중앙시장', address: '강릉시 금성로21번길 24 중앙시장', phone: '033-641-1234',
    signature: '강릉 닭강정', price: '12,000', hours: '09:00–21:00',
    desc: '강릉 중앙시장 명물 닭강정. 바삭하게 튀긴 닭에 매콤달콤한 소스를 버무린다.',
    menu: [
      { name: '강릉 닭강정(중)', price: '12,000', sig: true },
      { name: '닭강정(대)', price: '18,000' },
      { name: '순살 닭강정', price: '14,000' },
      { name: '반반(양념·간장)', price: '13,000' },
    ],
    tags: ['포장', '택배'], coupon: '토핑 추가',
  },
  {
    name: '교동짬뽕', category: '중식', area: '교동', address: '강릉시 경강로2100번길 15', phone: '033-642-5959',
    signature: '차돌짬뽕', price: '10,000', hours: '10:30–20:30',
    desc: '불맛 가득한 차돌짬뽕으로 소문난 동네 중식당. 점심시간 대기가 길다.',
    menu: [
      { name: '차돌짬뽕', price: '10,000', sig: true },
      { name: '짜장면', price: '7,000' },
      { name: '탕수육(소)', price: '15,000' },
      { name: '볶음밥', price: '8,000' },
    ],
    tags: ['주차', '단체석'],
  },
  {
    name: '초당막국수', category: '한식', area: '초당동', address: '강릉시 초당원길 22', phone: '033-653-6555',
    signature: '메밀막국수·수육', price: '9,000', hours: '10:00–20:00',
    desc: '직접 뽑은 메밀면 막국수와 부드러운 수육을 함께 내는 향토 막국수집.',
    menu: [
      { name: '메밀막국수', price: '9,000', sig: true },
      { name: '비빔막국수', price: '9,000' },
      { name: '온막국수', price: '9,500' },
      { name: '수육(소)', price: '18,000' },
    ],
    tags: ['주차', '포장', '단체석'], foreignMenu: true,
  },
  {
    name: '주문진 회센터', category: '해산물', area: '주문진항', address: '강릉시 주문진읍 해안로 1758', phone: '033-662-3000',
    signature: '자연산 모둠회', price: '35,000', hours: '09:00–21:00',
    desc: '주문진항 수산시장 2층, 그날 들어온 자연산 활어를 바로 떠주는 모둠회 전문점.',
    menu: [
      { name: '자연산 모둠회(중)', price: '35,000', sig: true },
      { name: '모둠회(대)', price: '55,000' },
      { name: '회덮밥', price: '15,000' },
      { name: '해물매운탕', price: '25,000' },
    ],
    tags: ['바다뷰', '주차', '단체석'], coupon: '음료 제공',
  },
  {
    name: '경포 베이커리', category: '카페', area: '경포호', address: '강릉시 경포로 365', phone: '033-644-2020',
    signature: '수제 소금빵·커피', price: '5,500', hours: '08:00–22:00',
    desc: '경포호 산책길 옆 수제 베이커리. 갓 구운 소금빵과 드립커피를 즐길 수 있다.',
    menu: [
      { name: '수제 소금빵', price: '3,500', sig: true },
      { name: '크루아상', price: '4,000' },
      { name: '드립커피', price: '5,000' },
      { name: '아메리카노', price: '4,500' },
    ],
    tags: ['호수뷰', '테라스', '포장'], foreignMenu: true,
  },
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

// ── 방문객 공지(헤더 메뉴 '공지사항') ────────────────────
// 발행 공지 더미 — 콘솔 Notices(발령) 연동은 이후. 지금은 대표 공지.
export interface VisitorNotice {
  date: string
  title: string
  body: string
}
export const VISITOR_NOTICES: VisitorNotice[] = [
  { date: '10.19', title: '개막식 및 드론 라이트 쇼', body: '19:00 올림픽파크 상공에서 드론 라이트 쇼가 진행됩니다. 공연구역에서 관람하세요.' },
  { date: '10.19', title: '음식·휴게구역 운영 시간', body: '음식판매·휴게구역은 매일 10:00–21:00 운영합니다.' },
  { date: '10.20', title: '셔틀버스 증편 운행', body: '주말 혼잡으로 강릉역·터미널–행사장 셔틀을 증편 운행합니다.' },
  { date: '10.21', title: '기상 안내', body: '오후 소나기가 예보되어 있습니다. 야외 일정은 현장 공지를 확인해 주세요.' },
]

// ── 자주 묻는 질문(헤더 메뉴 'FAQ') — 고정 콘텐츠 ────────
export interface Faq {
  q: string
  a: string
}
export const FAQS: Faq[] = [
  { q: '입장료가 있나요?', a: '부대행사는 무료입니다. 일부 유료 공연·체험은 현장 안내를 확인해 주세요.' },
  { q: '주차는 어디에 하나요?', a: '올림픽파크 제1·2주차장을 이용하실 수 있습니다. 혼잡하니 대중교통·셔틀을 권장합니다.' },
  { q: '반려동물 동반이 가능한가요?', a: '야외 구역은 목줄 착용 시 동반 가능하며, 실내 전시·공연장은 제한됩니다.' },
  { q: '다국어 안내가 있나요?', a: '주요 안내는 국문·영문을 병기하며, 종합안내소에서 통역 도움을 받을 수 있습니다.' },
  { q: '유실물은 어디서 찾나요?', a: '종합안내소의 물품보관·유실물 창구에서 확인해 주세요.' },
  { q: '우천 시에도 진행하나요?', a: '실내 프로그램은 정상 운영하며, 야외 일정은 현장 공지로 안내합니다.' },
]
