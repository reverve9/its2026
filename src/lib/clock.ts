// 시계 소스 (R6) — 모든 '현재 시각'은 여기서만 나온다.
// 컴포넌트·서비스 내부에서 new Date() / Date.now() 직접 호출 금지.
// 시간 스크러버가 setNowMin 으로 이 값을 밀면 파생값이 전부 다시 계산된다.
//
// 이 파일은 '라이브 허브'도 겸한다: 시각 변경 + store 뮤테이션이 모두
// emitChange 로 구독자에게 통지된다(useLive 훅이 이를 구독). 순환의존을 피하려고
// pub/sub 를 store 가 아니라 여기(의존 없는 모듈)에 둔다.

// ── 라이브 허브(pub/sub) ────────────────────────────────
let version = 0
const listeners = new Set<() => void>()

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// 시각·store 어느 쪽이든 바뀌면 호출 → 버전 증가 + 전 구독자 통지.
export function emitChange(): void {
  version++
  listeners.forEach((l) => l())
}

export function getVersion(): number {
  return version
}

// ── 시각 ────────────────────────────────────────────────
// 캡쳐 기준 '현재 시각' = 2026-10-21(수) 14:20 (교대 직후 20분 = 최대 리스크 구간).
export const REFERENCE_DATE = '2026-10-21'
const REFERENCE_NOW_MIN = 14 * 60 + 20 // 860

// ── 날짜 ────────────────────────────────────────────────
// 시계에 날짜 축이 붙은 이유: 근태는 날짜별 사실인데 시계가 분(0~1439)만 갖고 있어서
// 이벤트가 하루치밖에 존재할 수 없었다. 배치·물품·정산서류·교육이수 같은 '현황'은
// 행사 5일 고정이라 날짜를 갖지 않는다 — 날짜를 갖는 건 '라이브'(이벤트)뿐이다.
//
// ⚠️ 시드가 있는 날만 노출한다. 10/22·23 은 아직 오지 않은 날이라 이벤트가 없고,
// 그리로 밀면 파생이 '전원 미출근'을 만들어 관제가 거짓말을 한다(GRACE 초과 → absent).
// 정산의 5일(DEPLOYMENT_PLAN)은 계획이라 날짜 축과 무관하게 그대로 산다.
export const SEEDED_DATES = ['2026-10-19', '2026-10-20', '2026-10-21'] as const
export const DATE_LABELS: Record<string, string> = {
  '2026-10-19': '월 · 1일차',
  '2026-10-20': '화 · 2일차',
  '2026-10-21': '수 · 3일차',
}

let nowMin = REFERENCE_NOW_MIN
let nowDate: string = REFERENCE_DATE

export function getNowMin(): number {
  return nowMin
}

export function setNowMin(min: number): void {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  if (clamped === nowMin) return
  nowMin = clamped
  emitChange()
}

export function getNowDate(): string {
  return nowDate
}

// 시드 없는 날짜는 거부한다(위 ⚠️). 호출부가 임의 문자열을 밀어도 화면이 거짓말하지 않게.
export function setNowDate(date: string): void {
  if (date === nowDate || !SEEDED_DATES.includes(date as (typeof SEEDED_DATES)[number])) return
  nowDate = date
  emitChange()
}

// 기준 시각으로 되돌리기(스크러버 리셋) — 날짜도 같이 돌린다.
export function resetNow(): void {
  setNowDate(REFERENCE_DATE)
  setNowMin(REFERENCE_NOW_MIN)
}

// ── HH:mm 변환 헬퍼 ─────────────────────────────────────
export function fmtHM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// ⚠️ 폐기: hmToMin — 소비자 0. time.ts 의 toMin 과 같은 일을 하는 중복이었다.
// 'HH:mm → 분' 이 필요하면 toMin 을 쓸 것. 두 벌이면 한쪽만 고쳐지는 날이 온다.

export function getNowHM(): string {
  return fmtHM(nowMin)
}
