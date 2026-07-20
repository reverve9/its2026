// 방문객앱 네비 = 단일 출처(consoleNav 와 같은 원칙, D46). 셸·하단탭이 같은 배열을 본다.
//
// 구조(PEA식): 홈은 로고 진입이라 하단탭 밖 · 마이는 헤더 아이콘이라 하단탭 밖.
// 하단탭 = 콘텐츠 4개. RFP 교차 후 구성(공식홈=전문 참가자용 레퍼런스, 우리=현장 방문객 요약발췌):
//   행사소개(개요·강릉홍보 + 관광 요약·지원부스·비상) / 프로그램(공연·포토존·체험)
//   맛집(음식점 지도 §2-3 명문 — 도심·관광지 음식점·쿠폰) / 안내(행사장 배치도·편의·교통)
// 관광은 RFP 독립 산출물 아님(정보 반영 + 지원부스) → 행사소개에 요약 흡수. 맛집=행사장 부스와 별개(D55).
// icon 은 표시층에서 경로로 매핑한다(여기 lib 은 JSX 를 모른다).
export type VisitorNavItem = { to: string; label: string; end?: boolean }

export const visitorHome: VisitorNavItem = { to: '/v', label: '홈', end: true }
export const visitorMy: VisitorNavItem = { to: '/v/my', label: '마이' }

export const visitorTabs: VisitorNavItem[] = [
  { to: '/v/about', label: '행사소개' },
  { to: '/v/program', label: '프로그램' },
  { to: '/v/food', label: '맛집' },
  { to: '/v/guide', label: '안내' },
]
