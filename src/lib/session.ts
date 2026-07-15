// 현장앱 세션 — 저마찰 신원확인(전번+성명 조회) 결과를 localStorage 에 보관.
// ⚠️ 백엔드 인증이 아니다(핸드오프 §3). 신원확인일 뿐, 무결성은 GPS·대면확인 다층으로.
// Supabase 전환 후에도 세션은 계속 localStorage — 명단이 mock 이냐 DB 냐만 다르다.
//
// 세션은 '누구인가'만 들고 있고 '어떤 사람인가'는 절대 굳히지 않는다.
// 이전 모델은 { assignmentId, name, phone, role } 이었는데 name·phone 은 어디서도 읽지
// 않았고 role 은 FieldLayout 분기 한 곳에서만 읽혔다. 그런데 시드가 바뀌면 굳은 role 이
// 실제 배치와 어긋나(핸드오프 §4) 거점관리자로 저장된 사람이 봉사자 화면을 받는 식으로
// 깨졌다 — 읽지도 않는 값 때문에 localStorage 를 수동으로 지워야 했다.
// → assignmentId 만 남기고 나머지는 전부 store 에서 파생한다(getFieldIdentity).

const KEY = 'its2026.field.session'

// assignmentId: null = 슈퍼어드민. 인력현황(=Assignment)에 없는 사람이라 배치 id 가 없다.
// 신원을 배치에서만 끌어오던 구조라 로그인 자체가 불가능했다(findVolunteer 가 배치를 뒤진다).
// 8자리 키로 인증하고, 신원은 store 가 아니라 상수로 만든다(getFieldIdentity(null)).
export interface FieldSession {
  assignmentId: string | null
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
