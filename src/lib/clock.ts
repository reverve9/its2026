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

let nowMin = REFERENCE_NOW_MIN

export function getNowMin(): number {
  return nowMin
}

export function setNowMin(min: number): void {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  if (clamped === nowMin) return
  nowMin = clamped
  emitChange()
}

// 기준 시각으로 되돌리기(스크러버 리셋).
export function resetNow(): void {
  setNowMin(REFERENCE_NOW_MIN)
}

// ── HH:mm 변환 헬퍼 ─────────────────────────────────────
export function fmtHM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export function getNowHM(): string {
  return fmtHM(nowMin)
}
