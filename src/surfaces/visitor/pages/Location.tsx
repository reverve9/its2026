import VisitorPage from './VisitorPage'
import { TRANSPORT, EVENT } from '../../../lib/visitorContent'

// 오시는 길(헤더 메뉴) — 교통 안내(TRANSPORT 고정 콘텐츠). 지도는 플레이스홀더.
export default function Location() {
  return (
    <VisitorPage title="오시는 길">
      <div className="space-y-3">
        {/* 장소 */}
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
          <div className="text-label font-semibold text-ink-strong">{EVENT.place}</div>
          <div className="mt-1 text-caption text-ink-muted">{EVENT.period}</div>
        </div>

        {/* 지도 자리(실 지도 확정 시 교체) */}
        <div className="grid h-40 place-items-center rounded-xl border border-dashed border-line bg-page text-ink-faint" aria-hidden>
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3 3 5v16l6-2 6 2 6-2V3l-6 2-6-2zm0 0v16m6-14v16" />
          </svg>
        </div>

        {/* 이동 거점 */}
        <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {TRANSPORT.hubs.map((h) => (
              <span key={h} className="rounded-full bg-neutral-100 px-2.5 py-1 text-caption text-ink-muted">{h}</span>
            ))}
          </div>
        </div>

        {/* 대중교통 · 주차(아이콘+값) */}
        <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5 shadow-sm">
          <div className="flex items-start gap-2.5">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4" y="4" width="16" height="13" rx="2" /><path d="M4 11h16M7 20v-3m10 3v-3" /><circle cx="8" cy="14.5" r="0.5" /><circle cx="16" cy="14.5" r="0.5" />
            </svg>
            <span className="flex-1 text-caption leading-relaxed text-ink-muted">{TRANSPORT.transit}</span>
          </div>
          <div className="flex items-start gap-2.5">
            <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 16v3m14-3v3M4 13l1.5-5a2 2 0 012-1.5h9a2 2 0 012 1.5L20 13v3H4v-3z" /><circle cx="7.5" cy="16" r="1" /><circle cx="16.5" cy="16" r="1" />
            </svg>
            <span className="flex-1 text-caption leading-relaxed text-ink-muted">{TRANSPORT.parking}</span>
          </div>
        </div>
      </div>
    </VisitorPage>
  )
}
