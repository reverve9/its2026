// 방문객 지갑 — 무PII 핸드폰 기반 신원 + 쿠폰 발급(무산 phone.ts·coupons.ts 개념 차용).
// 실제 인증 아님: 전화번호를 localStorage 에 저장해 브라우저 신원으로 쓴다(현장앱 신원확인과 같은 종).
// 쿠폰 = 자율 혜택형·표시만(RFP §2-3, 정산형 없음). 발급 = 코드 부여 + 지갑에 담기.

// ── 전화번호(무산 phone.ts) ──────────────────────────────
// 입력 UI: 010-XXXX-XXXX 자동 포맷. 검증: 완성 포맷.
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 11)
  if (d.length < 4) return d
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
}
export const PHONE_RE = /^010-\d{4}-\d{4}$/
export const isValidPhone = (p: string): boolean => PHONE_RE.test(p)

const PHONE_KEY = 'its-visitor-phone-v1'
const COUPON_KEY = 'its-visitor-coupons-v1'

export function loadPhone(): string | null {
  try {
    const v = localStorage.getItem(PHONE_KEY)
    return v && isValidPhone(v) ? v : null
  } catch {
    return null
  }
}
export function savePhone(p: string): void {
  try {
    if (isValidPhone(p)) localStorage.setItem(PHONE_KEY, p)
  } catch {
    /* ignore */
  }
}
export function clearWallet(): void {
  try {
    localStorage.removeItem(PHONE_KEY)
    localStorage.removeItem(COUPON_KEY)
  } catch {
    /* ignore */
  }
}

// ── 쿠폰 발급(무산 coupons.ts 개념) ──────────────────────
// 코드 = ITS-XXXXXX (혼동 글자 0/O/1/I 제외). 발급 시 매장별 결정적 코드(시연 캡쳐 안정).
export interface IssuedCoupon {
  store: string
  benefit: string
  code: string
}

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export function couponCode(seed: string): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  let s = ''
  for (let i = 0; i < 6; i += 1) {
    s += CODE_ALPHABET[h % CODE_ALPHABET.length]
    h = Math.floor(h / CODE_ALPHABET.length) + seed.charCodeAt(i % seed.length)
  }
  return `ITS-${s}`
}

export function loadIssued(): IssuedCoupon[] {
  try {
    const raw = localStorage.getItem(COUPON_KEY)
    return raw ? (JSON.parse(raw) as IssuedCoupon[]) : []
  } catch {
    return []
  }
}
export function issueCoupon(store: string, benefit: string): IssuedCoupon[] {
  const list = loadIssued()
  if (!list.some((c) => c.store === store)) {
    list.push({ store, benefit, code: couponCode(store) })
    try {
      localStorage.setItem(COUPON_KEY, JSON.stringify(list))
    } catch {
      /* ignore */
    }
  }
  return list
}
