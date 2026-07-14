import type { Coords } from '../types'

// 지오펜스 유틸 — 무인(관광지) GPS 셀프체크의 반경 판정.
// 판정은 '차단'이 아니라 '이상치 플래그'로만 쓴다(핸드오프 §3 다층 무결성).

// 하버사인 거리(m).
export function distanceM(a: Coords, b: Coords): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const la1 = toRad(a.lat)
  const la2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export interface GeofenceResult {
  distance: number // m
  within: boolean
  anomaly?: string // 반경 밖이면 사유(차단 아님)
}

// 거점 좌표·반경 대비 판정.
export function checkGeofence(here: Coords, center: Coords, radiusM: number): GeofenceResult {
  const distance = Math.round(distanceM(here, center))
  const within = distance <= radiusM
  return {
    distance,
    within,
    anomaly: within ? undefined : `지오펜스 밖 ${distance}m (반경 ${radiusM}m) — 위치 확인 필요`,
  }
}
