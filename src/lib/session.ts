// 현장앱 세션 — 저마찰 신원확인(전번+성명 조회) 결과를 localStorage 에 보관.
// ⚠️ 백엔드 인증이 아니다(핸드오프 §3). 신원확인일 뿐, 무결성은 GPS·정시체크·순회감사 다층으로.
// Supabase 전환 후에도 세션은 계속 localStorage — 명단이 mock 이냐 DB 냐만 다르다.

const KEY = 'its2026.field.session'

export interface FieldSession {
  assignmentId: string
  name: string
  phone: string
  role: string
}

export function loadSession(): FieldSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FieldSession) : null
  } catch {
    return null
  }
}

export function saveSession(s: FieldSession): void {
  localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearSession(): void {
  localStorage.removeItem(KEY)
}
