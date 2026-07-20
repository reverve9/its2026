import VisitorPage from './VisitorPage'
import { VISITOR_NOTICES } from '../../../lib/visitorContent'

// 공지사항(헤더 메뉴) — 발행 공지 목록. 콘솔 Notices(발령) 연동은 이후.
export default function Notice() {
  return (
    <VisitorPage title="공지사항">
      <div className="space-y-2">
        {VISITOR_NOTICES.map((n) => (
          <div key={`${n.date}-${n.title}`} className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="tnum shrink-0 rounded-md bg-primary-50 px-2 py-0.5 text-caption font-semibold text-primary-700">{n.date}</span>
              <span className="text-label font-semibold text-ink-strong">{n.title}</span>
            </div>
            <p className="mt-1.5 text-caption leading-relaxed text-ink-muted">{n.body}</p>
          </div>
        ))}
      </div>
    </VisitorPage>
  )
}
