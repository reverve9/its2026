import { Link } from 'react-router-dom'
import { useNowMin, useNowDate } from '../../../lib/useLive'
import { EVENT, PERFORMANCES, HIGHLIGHTS } from '../../../lib/visitorContent'
import heroImg from '../../../assets/hero-visitor.jpg'

// 방문객앱 홈(로고 진입) — 사진 히어로 밴드 + 다음 공연 + 오늘 하이라이트 + 빠른진입.
// 히어로는 헤더와 이어지는 풀블리드 사진 밴드(강릉 올림픽파크) — 상단을 강한 시각면으로.
// 상세 소개는 개요 탭.

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
    <div className="pb-4">
      {/* 히어로 — 풀블리드 사진 밴드(강릉 올림픽파크) + 행사명·일차·기간·장소 */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroImg})` }} />
        {/* 텍스트 가독성 — 하단 짙은 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-strong/85 via-ink-strong/30 to-ink-strong/5" />
        <div className="relative flex min-h-[288px] flex-col justify-end p-5">
          <span className="mb-2.5 inline-flex self-start rounded-full border border-white/25 bg-white/15 px-3 py-1 text-caption font-bold text-white backdrop-blur-sm">
            행사 {day}일차
          </span>
          <h1 className="text-title font-title font-semibold leading-snug text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.45)]">
            {EVENT.name}
          </h1>
          <p className="mt-1.5 text-caption font-semibold uppercase tracking-wide text-white/85">{EVENT.tagline}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-label text-white/90">
            <span>{EVENT.period}</span>
            <span className="text-white/40">·</span>
            <span>{EVENT.place}</span>
          </div>
        </div>
      </section>

      <div className="space-y-4 p-4">
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
    </div>
  )
}
