// 방문객앱 네비 = 단일 출처(consoleNav 와 같은 원칙, D46). 셸·하단탭이 같은 배열을 본다.
//
// 구조(PEA식): 홈은 로고 진입이라 하단탭 밖 · 마이는 헤더 아이콘이라 하단탭 밖.
// 하단탭 = 콘텐츠 5개. 축: 소개 / 공간·실용 / 시간·볼거리 / 도심 관광 / 도심 맛집.
//   개요       — 행사 취지·강릉홍보·전체 개관(정적 소개)
//   행사안내   — 행사장 배치도·포토존·편의·안내소·교통·비상(현장 실용·길찾기)
//   프로그램   — 공연 타임테이블·체험
//   관광정보   — 강릉 주요 관광지·자원봉사 지원부스
//   맛집       — 음식점 지도·쿠폰(§2-3 명문, 도심 음식점 · 행사장 FoodVendor 와 별개 D55)
// 홈=핵심 히어로(로고) · 마이=쿠폰북(헤더)는 탭 밖. icon 은 표시층에서 경로로 매핑.
export type VisitorNavItem = { to: string; label: string; end?: boolean }

export const visitorHome: VisitorNavItem = { to: '/v', label: '홈', end: true }
export const visitorMy: VisitorNavItem = { to: '/v/my', label: '마이' }

// 헤더 메뉴(햄버거 드롭다운) = 5탭 밖 유틸리티(소개로·무산 헤더 메뉴 개념).
// 콘텐츠 5탭과 분리 — 부차·수집 항목을 여기로 몰아 메뉴 분기를 정리한다.
export const visitorMenu: VisitorNavItem[] = [
  { to: '/v/notice', label: '공지사항' },
  { to: '/v/location', label: '오시는 길' },
  { to: '/v/faq', label: '자주 묻는 질문' },
  { to: '/v/survey', label: '만족도조사' },
]

export const visitorTabs: VisitorNavItem[] = [
  { to: '/v/about', label: '개요' },
  { to: '/v/guide', label: '행사안내' },
  { to: '/v/program', label: '프로그램' },
  { to: '/v/around', label: '관광정보' },
  { to: '/v/food', label: '맛집' },
]
