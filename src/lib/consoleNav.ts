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
// title 있으면 접이식 묶음(아코디언), 없으면 섹션 아래 항목 직접 나열.
export type NavGroup = { title?: string; items: NavItem[] }
// 최상위 3갈래 = 운영 / 콘텐츠 / 정산. 발주처(client)는 대시보드 + '운영'만 본다(그 외 전부 superAdminOnly).
export type NavSection = { title: string; groups: NavGroup[] }

export const overview: NavItem = { to: '/', label: '통합 운영 현황', end: true }

// 3갈래 = 운영 / 콘텐츠 / 정산. 층위가 얕아 묶음 제목(예 '실시간 관제')은 없앤다 — 섹션이 곧 묶음.
// 가림: '운영'만 발주처(client) 노출. '콘텐츠'·'정산'은 항목 전부 superAdminOnly(대시보드+운영만 공무원).
// 소비자 셋(사이드바·URL 가드·대시보드 드릴다운)이 이 배열 하나를 본다(D46) — 경계는 항목의 superAdminOnly.
export const sections: NavSection[] = [
  {
    title: '운영',
    groups: [
      {
        items: [
          { to: '/notices', label: '공지 및 안내' },
          { to: '/people', label: '인력 관리' },
          { to: '/safety', label: '안전/비상' },
          { to: '/issues', label: '민원 관리' },
          { to: '/report', label: '일일 운영 보고' },
        ],
      },
    ],
  },
  {
    // 방문객앱 발행/수집 + 내부 등록 대장. 프로그램·쿠폰·공지FAQ 는 골격(콘텐츠 추후).
    title: '콘텐츠',
    groups: [
      {
        items: [
          { to: '/content-board', label: '공지사항 및 FAQ', superAdminOnly: true },
          { to: '/survey', label: '만족도조사', superAdminOnly: true },
          { to: '/personnel', label: '인력 현황', superAdminOnly: true },
          { to: '/vendors', label: '업체 등록 현황', superAdminOnly: true },
          { to: '/programs', label: '프로그램', superAdminOnly: true },
        ],
      },
    ],
  },
  {
    // 행사 후 일괄(일일 정산 아님) — '정산 마감' 없음(마감할 일 단위가 없다).
    title: '정산',
    groups: [
      {
        items: [
          { to: '/coupons', label: '쿠폰 관리', superAdminOnly: true },
          { to: '/settlement', label: '정산/산출내역', superAdminOnly: true },
        ],
      },
    ],
  },
]

// 모든 항목 평탄화 — URL 가드·canSee 가 갈래/묶음을 넘어 항목만 본다.
const allItems = (): NavItem[] => sections.flatMap((s) => s.groups).flatMap((g) => g.items)

export const visibleTo = (role: ConsoleRole) => (n: NavItem) => !n.superAdminOnly || role === 'superAdmin'

// 이 등급이 이 경로에 들어갈 수 있는가. to 는 쿼리 없는 경로다('/personnel?edu=pending' 아님)
// — 등급은 화면 단위로 갈리지 쿼리 단위로 갈리지 않는다.
// 배열에 없는 경로(로그인 등)는 등급 제한이 없다는 뜻이므로 true.
export const canSee = (role: ConsoleRole, to: string): boolean => {
  const item = allItems().find((n) => n.to === to)
  return !item || visibleTo(role)(item)
}
