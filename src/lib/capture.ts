// 캡쳐 모드 (P3) — 제안서 샷을 위한 프레이밍 토글.
// dev 편의 상태이므로 시계(clock)와 별개의 독립 pub/sub 로 둔다.
// URL 이 아니라 모듈 상태 → 사이드바로 페이지를 이동해도 캡쳐 모드가 유지된다.
//
// 아트보드 규격(샷플랜 확정): 콘솔 1440×900 고정폭 / 모바일 412×915.
// 폭은 고정, 높이는 자연 길이 → 900(또는 915)px 마다 컷 라인 → 세로 2분할 캡쳐.

import { useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'

export type Artboard = { label: string; w: number; h: number }
export const CONSOLE_ARTBOARD: Artboard = { label: '콘솔', w: 1440, h: 900 }
export const MOBILE_ARTBOARD: Artboard = { label: '모바일', w: 412, h: 915 }

// ── 독립 pub/sub ────────────────────────────────────────
let on = false
const subs = new Set<() => void>()

export function isCapture(): boolean {
  return on
}

export function setCapture(v: boolean): void {
  if (v === on) return
  on = v
  subs.forEach((f) => f())
}

function subscribe(f: () => void): () => void {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}

// 캡쳐 모드 on/off 구독 훅.
export function useCapture(): boolean {
  return useSyncExternalStore(subscribe, isCapture, isCapture)
}

// 현재 경로로 아트보드 규격 결정 (/f 현장앱·/v 방문객앱 = 모바일, 그 외 = 콘솔).
export function useArtboard(): Artboard {
  const { pathname } = useLocation()
  const mobile = pathname.startsWith('/f') || pathname.startsWith('/v')
  return mobile ? MOBILE_ARTBOARD : CONSOLE_ARTBOARD
}
