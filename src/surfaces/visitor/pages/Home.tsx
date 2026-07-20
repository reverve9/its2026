import { Link } from 'react-router-dom'
import { useNowMin, useNowDate } from '../../../lib/useLive'
import { EVENT, PERFORMANCES, HIGHLIGHTS } from '../../../lib/visitorContent'

// 방문객앱 홈(로고 진입) — 핵심 히어로 + 다음 공연 + 오늘 하이라이트 + 빠른진입.
// 상세 소개는 개요 탭. 히어로엔 히어로 처리 가능한 핵심만.

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export default function Home() {
  const now = useNowMin()
  const date = useNowDate()
  const day = Math.max(1, Number(date.slice(-2)) - 18) // 10-19 = 1일차
  const next = PERFORMANCES.find((p) => toMin(p.time) >= now) ?? PERFORMANCES[0]

  return (
    <div className="space-y-4 p-4">
      {/* 히어로 — 행사명·기간·장소·일차 */}
      <section className="rounded-2xl border border-line bg-surface p-5 text-center shadow-sm">
        <div className="mb-2 inline-flex rounded-full bg-primary-50 px-3 py-1 text-caption font-bold text-primary-700">
          행사 {day}일차
        </div>
        <h1 className="text-title font-title font-semibold leading-snug text-ink-strong">{EVENT.name}</h1>
        <p className="mt-1 text-caption font-semibold uppercase tracking-wide text-primary-600">{EVENT.tagline}</p>
        <div className="mt-3 space-y-0.5 text-label text-ink-muted">
          <div>{EVENT.period}</div>
          <div>{EVENT.place}</div>
        </div>
      </section>

      {/* 다음 공연 */}
      <Link to="/v/program" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition active:scale-[0.99]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary-600 text-white">
          <span className="tnum text-label font-bold">{next.time}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-caption font-semibold text-ink-faint">다음 공연</span>
          <span className="block truncate text-label font-semibold text-ink-strong">{next.title}</span>
          <span className="block truncate text-caption text-ink-muted">{next.place}</span>
        </span>
        <span className="shrink-0 text-ink-faint">›</span>
      </Link>

      {/* 오늘 하이라이트 */}
      <section>
        <h2 className="mb-2 text-label font-bold text-ink-muted">오늘</h2>
        <div className="space-y-2">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm">
              <span className="shrink-0 rounded-md bg-primary-50 px-2 py-0.5 text-caption font-bold text-primary-700">{h.tag}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-label font-semibold text-ink-strong">{h.title}</span>
                <span className="block truncate text-caption text-ink-muted">{h.place}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 빠른진입 */}
      <section className="grid grid-cols-3 gap-2">
        {[
          { to: '/v/around', label: '관광정보' },
          { to: '/v/guide', label: '행사안내' },
          { to: '/v/my', label: '내 쿠폰' },
        ].map((q) => (
          <Link key={q.to} to={q.to} className="rounded-xl border border-line bg-surface py-3 text-center text-caption font-semibold text-ink-strong shadow-sm transition active:scale-[0.98]">
            {q.label}
          </Link>
        ))}
      </section>
    </div>
  )
}
