import type { ConsoleRole } from './consoleAuth'

// 콘솔 사이드바 구성 = 등급이 무엇을 보는지의 단일 출처(R5).
//
// 이 배열을 보는 소비자가 셋이다 — 사이드바 · URL 가드(ConsoleLayout) · 대시보드 KPI
// 드릴다운(Dashboard). 셋 중 하나라도 자기 나름대로 `role === 'superAdmin'` 을 적으면
// 등급 경계를 옮기는 날 나머지가 조용히 어긋난다: 메뉴에선 사라졌는데 링크는 남아
// 눌러도 되돌려보내지는 타일이 생긴다(실제로 그럴 뻔했다 — '운영' 묶음을 client 에게서
// 걷을 때 Dashboard 의 /personnel 드릴다운이 그렇게 죽었다).
//
// 화면 파일이 아니라 lib 에 있는 이유: ConsoleLayout 에서 export 하면 컴포넌트 파일이
// 컴포넌트 아닌 걸 내보내게 되어 fast-refresh 가 깨진다(oxlint only-export-components).
export type NavItem = { to: string; label: string; end?: boolean; superAdminOnly?: true }

export const overview: NavItem = { to: '/', label: '통합 운영현황', end: true }

export const groups: { title: string; items: NavItem[] }[] = [
  {
    title: '실시간 관제',
    items: [
      { to: '/people', label: '인력 관리' },
      { to: '/safety', label: '안전/비상' },
      { to: '/issues', label: '민원 관리' },
      { to: '/report', label: '일일 운영 보고' },
    ],
  },
  {
    // 시간 비의존 마스터 대장 — 스크러버를 밀어도 불변.
    // 정산도 같은 성격(일일 정산이 아니라 행사 후 일괄)이라 여기 하단에 둔다.
    // '정산 마감'은 만들지 않았다: 일일 단위로 정산하지 않으므로 마감할 단위가 없다.
    //
    // 묶음 전체가 발주처(client)에게 안 보인다 — 셋 다 운영본부가 사업을 굴리려고 쥔
    // 내부 대장이지 발주처 보고물이 아니다. 발주처가 보는 건 현황(대시보드·실시간 관제)이다.
    // 셋에 각각 다는 게 중복이 아니다: 사이드바도 URL 가드도 묶음이 아니라 항목을 본다.
    // 묶음에만 달면 /personnel 을 URL 로 직접 치는 경로가 열린 채로 남는다.
    title: '운영',
    items: [
      { to: '/personnel', label: '인력 현황', superAdminOnly: true },
      { to: '/vendors', label: '업체 등록 현황', superAdminOnly: true },
      { to: '/settlement', label: '정산 산출내역', superAdminOnly: true },
    ],
  },
]

export const visibleTo = (role: ConsoleRole) => (n: NavItem) => !n.superAdminOnly || role === 'superAdmin'

// 이 등급이 이 경로에 들어갈 수 있는가. to 는 쿼리 없는 경로다('/personnel?edu=pending' 아님)
// — 등급은 화면 단위로 갈리지 쿼리 단위로 갈리지 않는다.
// 배열에 없는 경로(로그인 등)는 등급 제한이 없다는 뜻이므로 true.
export const canSee = (role: ConsoleRole, to: string): boolean => {
  const item = groups.flatMap((g) => g.items).find((n) => n.to === to)
  return !item || visibleTo(role)(item)
}
