// 방문객앱 네비 = 단일 출처(consoleNav 와 같은 원칙, D46). 셸·하단탭이 같은 배열을 본다.
//
// 구조(PEA식): 홈은 로고 진입이라 하단탭 밖 · 마이는 헤더 아이콘이라 하단탭 밖.
// 하단탭 = 콘텐츠 4개(행사소개·부대프로그램·맛집·관광지). 맛집·관광지는 별개 탭이다.
// icon 은 표시층에서 경로로 매핑한다(여기 lib 은 JSX 를 모른다).
export type VisitorNavItem = { to: string; label: string; end?: boolean }

export const visitorHome: VisitorNavItem = { to: '/v', label: '홈', end: true }
export const visitorMy: VisitorNavItem = { to: '/v/my', label: '마이' }

export const visitorTabs: VisitorNavItem[] = [
  { to: '/v/about', label: '행사소개' },
  { to: '/v/program', label: '부대프로그램' },
  { to: '/v/food', label: '맛집' },
  { to: '/v/tour', label: '관광지' },
]
