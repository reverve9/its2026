// 썸네일 플레이스홀더 — 무산·소개로 카드처럼 이미지 자리. 실 이미지 확정 시 <img> 로 교체.
export default function Thumb({ className = '' }: { className?: string }) {
  return (
    <div className={`grid place-items-center bg-neutral-100 text-ink-faint ${className}`} aria-hidden>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="M21 15l-5-5L6 20" />
      </svg>
    </div>
  )
}
