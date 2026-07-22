// 포토존 단체사진 공유 — 포토존에서 찍은 단체사진을 QR로 즉석 공유.
// 흐름: 폰 기본카메라 촬영 → 업로드 → QR 발행 → 함께 찍은 이들이 스캔·저장 → '내 사진'에 담김.
//
// 원칙: 로그인 없음. 업로드·QR발행·받기·저장 전부 무인증(쿠폰 전화번호 게이트와 분리).
// 구역 분류 없음 — 포토존 한 곳으로 단순화(사용자 지시).
//
// ⚠️ 목업 전제: "제안 데모용 · 단일기기 스토리텔링".
//   - 갤러리는 시드, '내 사진'은 담은 사진을 localStorage 에 저장.
//   - 업로드 사진은 세션 메모리(data URL) — 새로고침 시 소멸(캡쳐엔 충분).
//   - QR 크로스폰 다운로드는 공유 저장소가 있어야 실동작. 실제 운영 = Supabase Storage 교체(흐름·UI 그대로).
import groupImg from '../assets/photozone-group.jpg'
import arenaImg from '../assets/photozone-arena.jpg'
import g1 from '../assets/photozone-g1.jpg'
import g2 from '../assets/photozone-g2.jpg'
import g3 from '../assets/photozone-g3.jpg'
import g4 from '../assets/photozone-g4.jpg'

// ── 갤러리 시드(시간순) ──────────────────────────────────────
// by = 무PII 업로더 표시명(목업) · ago = 상대시각 라벨(캡쳐 안정 위해 고정)
export interface GalleryPhoto {
  id: string
  src: string
  by: string
  ago: string
}
export const GALLERY: GalleryPhoto[] = [
  { id: 'ph-01', src: groupImg, by: '김○○ 일행', ago: '방금 전' },
  { id: 'ph-02', src: arenaImg, by: '이○○ 일행', ago: '3분 전' },
  { id: 'ph-03', src: g1, by: '박○○ 일행', ago: '12분 전' },
  { id: 'ph-04', src: g2, by: '최○○ 일행', ago: '25분 전' },
  { id: 'ph-05', src: g3, by: '정○○ 일행', ago: '41분 전' },
  { id: 'ph-06', src: g4, by: '한○○ 일행', ago: '1시간 전' },
]

// 업로드 데모 기본 사진(파일 미선택 시 캡쳐용 폴백) = 실제 단체사진
export const DEMO_UPLOAD_SRC = groupImg

// ── 공유 코드(무산 couponCode 와 동종 결정적 해시) ───────────
// 코드 = PZ-XXXXXX. QR 이 인코딩하는 값(목업 = 데모 URL). 실제 = 사진 다운로드 URL.
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export function shareCode(seed: string): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  let s = ''
  for (let i = 0; i < 6; i += 1) {
    s += CODE_ALPHABET[h % CODE_ALPHABET.length]
    h = Math.floor(h / CODE_ALPHABET.length) + seed.charCodeAt(i % Math.max(1, seed.length))
  }
  return `PZ-${s}`
}
export const shareUrl = (code: string): string => `https://its2026.app/p/${code}`

// ── 내 사진(무인증 · localStorage) ───────────────────────────
export interface SavedPhoto {
  id: string
  src: string
}
const SAVED_KEY = 'its-visitor-photos-v1'

export function loadSavedPhotos(): SavedPhoto[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY)
    return raw ? (JSON.parse(raw) as SavedPhoto[]) : []
  } catch {
    return []
  }
}
export function savePhoto(p: SavedPhoto): SavedPhoto[] {
  const list = loadSavedPhotos()
  if (!list.some((x) => x.id === p.id)) {
    list.unshift(p)
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(list))
    } catch {
      /* data URL 이 커서 초과할 수 있음 — 목업이라 무시 */
    }
  }
  return list
}
