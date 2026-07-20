import { useEffect, useState, type ReactNode } from 'react'
import Thumb from './Thumb'
import type { CityRestaurant } from '../../../lib/visitorContent'

// 맛집 업체 상세 모달 — 카드 탭 시 등장(무산 BoothModal 메커니즘 · 소개로드 상세 IA).
// 페인 기준 absolute(fixed 아님) — 현장앱 규격 셸(max-w-460/캡쳐 412) 안에 갇혀야 라이브·캡쳐 좌표 일치. 플로팅 탭과 같은 규칙.
// 닫기 3종: 배경 딤 탭 · X 버튼 · Esc. 화면엔 데이터만(아이콘+값 · 산문 라벨 없음 · D26).
// 쿠폰 = 자율 혜택형 · 표시만(발급은 마이페이지 · D65).

// 아이콘+값 한 줄(소개로 상세처럼 라벨 텍스트 대신 아이콘으로 의미 전달).
function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {icon}
      </svg>
      <span className="min-w-0 flex-1 text-caption text-ink-muted">{children}</span>
    </div>
  )
}

export default function RestaurantModal({ r, onClose }: { r: CityRestaurant; onClose: () => void }) {
  // 최소 전환 — 마운트 후 opacity 페이드(tailwind config 무변경).
  const [shown, setShown] = useState(false)
  useEffect(() => {
    setShown(true)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={`absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-5 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${r.name} 상세`}
    >
      <div
        className="relative flex max-h-[86%] w-full flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_16px_48px_-12px_rgba(0,0,0,0.45)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기(X) */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white backdrop-blur-sm"
          aria-label="닫기"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {/* 히어로 — 대표 이미지(플레이스홀더 · 실 이미지 확정 시 교체) */}
        <Thumb className="h-40 w-full shrink-0" />

        {/* 바디(자체 스크롤) */}
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-primary-50 px-2 py-0.5 text-caption font-semibold text-primary-700">{r.category}</span>
              {r.foreignMenu && (
                <span className="rounded-md border border-line px-2 py-0.5 text-caption font-semibold text-ink-muted">외국어 메뉴</span>
              )}
            </div>
            <h2 className="mt-1.5 text-title font-title font-semibold text-ink-strong">{r.name}</h2>
            <p className="mt-1 text-caption leading-relaxed text-ink-muted">{r.desc}</p>
          </div>

          {/* 쿠폰(자율 혜택형 · 표시만) */}
          {r.coupon && (
            <div className="flex items-center gap-2.5 rounded-xl bg-primary-50 p-3">
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-primary-600" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" />
                <path d="M14 6v12" strokeDasharray="2 2" />
              </svg>
              <div className="min-w-0">
                <div className="text-label font-bold text-primary-700">{r.coupon}</div>
                <div className="text-caption text-primary-600/80">행사 기간 · 1회 · 현장 제시</div>
              </div>
            </div>
          )}

          {/* 상세 메뉴(무산 부스 모달 메뉴 리스트) — 이름 좌 · 가격 우 · 대표 배지 */}
          <div className="overflow-hidden rounded-xl border border-line">
            <ul className="divide-y divide-line">
              {r.menu.map((m) => (
                <li key={m.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-caption text-ink-strong">{m.name}</span>
                    {m.sig && (
                      <span className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">대표</span>
                    )}
                  </span>
                  <span className="tnum shrink-0 text-caption font-semibold text-ink-muted">{m.price}원</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 정보 행(아이콘+값 · D26 — 라벨 산문 없음) */}
          <div className="space-y-2.5 rounded-xl border border-line p-3">
            <InfoRow
              icon={<><path d="M12 21s-6.5-5.8-6.5-10.5a6.5 6.5 0 1113 0C18.5 15.2 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.5" /></>}
            >
              {r.area} · {r.address}
            </InfoRow>
            <InfoRow icon={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>}>{r.hours}</InfoRow>
            <InfoRow icon={<><path d="M5 4h3l1.5 4-2 1.5a11 11 0 005 5l1.5-2 4 1.5v3a1.5 1.5 0 01-1.6 1.5A16 16 0 013.5 5.6 1.5 1.5 0 015 4z" /></>}>
              <a href={`tel:${r.phone.replace(/-/g, '')}`} className="tnum text-primary-700">{r.phone}</a>
            </InfoRow>
          </div>

          {/* 편의 태그 */}
          {r.tags && r.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {r.tags.map((t) => (
                <span key={t} className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-ink-muted">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
