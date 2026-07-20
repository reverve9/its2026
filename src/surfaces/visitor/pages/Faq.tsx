import { useState } from 'react'
import VisitorPage from './VisitorPage'
import { FAQS } from '../../../lib/visitorContent'

// 자주 묻는 질문(헤더 메뉴) — 아코디언. 고정 콘텐츠.
export default function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <VisitorPage title="자주 묻는 질문">
      <div className="space-y-2">
        {FAQS.map((f, i) => {
          const isOpen = open === i
          return (
            <div key={f.q} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-2 px-3.5 py-3 text-left"
                aria-expanded={isOpen}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-primary-50 text-caption font-bold text-primary-700">Q</span>
                <span className="flex-1 text-label font-semibold text-ink-strong">{f.q}</span>
                <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-ink-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {isOpen && (
                <p className="border-t border-line px-3.5 py-3 text-caption leading-relaxed text-ink-muted">{f.a}</p>
              )}
            </div>
          )
        })}
      </div>
    </VisitorPage>
  )
}
