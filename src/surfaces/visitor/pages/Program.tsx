import VisitorPage from './VisitorPage'
import { PERFORMANCES, EXPERIENCES } from '../../../lib/visitorContent'

// 프로그램 — 공연 타임테이블 + 체험·포토존. 위치/길찾기는 행사안내 탭.
export default function Program() {
  return (
    <VisitorPage title="프로그램">
      <div className="space-y-5">
        {/* 공연 타임테이블 */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">공연</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            {PERFORMANCES.map((p) => (
              <div key={p.time + p.title} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <span className="tnum w-12 shrink-0 text-label font-bold text-primary-600">{p.time}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-label font-semibold text-ink-strong">{p.title}</span>
                  <span className="block truncate text-caption text-ink-muted">{p.place}</span>
                </span>
                {p.org && (
                  <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-muted">{p.org}</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 체험·포토존 */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">체험·포토존</h2>
          <div className="grid grid-cols-2 gap-2">
            {EXPERIENCES.map((e) => (
              <div key={e.title} className="rounded-xl border border-line bg-surface p-3 shadow-sm">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-label font-semibold text-ink-strong">{e.title}</span>
                  {e.org && <span className="shrink-0 rounded bg-neutral-100 px-1 py-0.5 text-[10px] font-semibold text-ink-muted">{e.org}</span>}
                </div>
                <div className="mt-0.5 text-caption text-ink-muted">{e.place}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </VisitorPage>
  )
}
