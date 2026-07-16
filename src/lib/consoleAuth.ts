// 운영본부 콘솔 인증 — 하드코딩 계정 + 등급.
//
// ⚠️ 백엔드 인증이 아니다. 계정이 클라이언트 번들에 그대로 들어간다.
// 이건 결함이 아니라 결정이다 — Supabase 전환 후에도 하드코딩으로 간다(사용자 확정).
// 이 플랫폼은 발주처 시연·제안용이고 실 개인정보를 담지 않는다. 보호할 자산이 없으므로
// 인증은 '누가 어느 화면을 보는가'를 가르는 역할만 한다.
//
// 등급이 둘이다:
//   superAdmin  운영본부 — 사이드바 전체
//   client      발주처(강릉시) — '운영' 묶음(인력 현황·업체 등록 현황·정산 산출내역)을 뺀 전체
//
// '운영' 묶음을 통째로 가리는 이유: 셋 다 운영본부의 내부 대장이다. 인력 현황은 명부(연락처·
// 외국어·물품 지급·정산 서류), 업체 등록 현황은 입점 관리, 정산은 우리 원가(일용 지급·원천징수).
// 발주처 보고 대상은 자원봉사자 실비뿐이고, 발주처가 볼 것은 현황(대시보드·실시간 관제)이다.
// 즉 등급은 권한이 아니라 '보고 경계'를 화면으로 옮긴 것이다.

export type ConsoleRole = 'superAdmin' | 'client'

interface Account {
  id: string
  pw: string
  role: ConsoleRole
  label: string // 헤더에 찍히는 표시명
}

const ACCOUNTS: Account[] = [
  { id: 'its2026', pw: 'its2026!@', role: 'superAdmin', label: '운영본부 관리자' },
  { id: 'gnits', pw: 'gnits2026!@', role: 'client', label: '발주처 · 강릉시' },
]

export interface ConsoleSession {
  id: string
  role: ConsoleRole
  label: string
}

// 아이디는 대소문자를 가리지 않고 비밀번호는 가린다(관례).
export function authConsole(id: string, pw: string): ConsoleSession | null {
  const a = ACCOUNTS.find((x) => x.id === id.trim().toLowerCase() && x.pw === pw)
  return a ? { id: a.id, role: a.role, label: a.label } : null
}

// dev quick-pick 용 — 하드코딩이 방침이라 숨길 이유가 없다.
export const DEV_ACCOUNTS = ACCOUNTS.map((a) => ({ id: a.id, pw: a.pw, label: a.label }))

const KEY = 'its2026.console.session'

export function loadConsoleSession(): ConsoleSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as ConsoleSession
    // 저장된 등급이 지금 계정 표와 어긋나면 버린다 — 계정 표를 고쳤을 때
    // 낡은 세션이 없는 등급을 들고 살아남지 않게(현장앱 세션이 겪은 stale 문제와 같은 것).
    return ACCOUNTS.some((a) => a.id === s.id && a.role === s.role) ? s : null
  } catch {
    return null
  }
}

export function saveConsoleSession(s: ConsoleSession): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearConsoleSession(): void {
  localStorage.removeItem(KEY)
}
