import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useCapture } from '../../lib/capture'
import { visitorTabs, visitorMy } from '../../lib/visitorNav'
import logoW from '../../assets/logo-its-w.png'
import bgHeader from '../../assets/bg-field-header.jpg'

// 방문객앱 셸 — 공개(무인증) 발행면. 현장앱과 같은 모바일 규격(412×915 / max-w-460).
// 홈은 로고 진입 · 마이는 헤더 아이콘 · 하단탭은 콘텐츠 4개(단일 출처 visitorNav).
//
// 다국어는 헤더 KOR/ENG 토글 — 지금은 상태만 잡아두고 실제 번역(발행 다국어)은 콘텐츠 단계에서.

const ICONS: Record<string, ReactNode> = {
  '/v/about': (
    <path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 8v5m0-8.5v.5" />
  ),
  '/v/program': (
    <path d="M4 6a1 1 0 011-1h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6zm0 4h16M8 3v4m8-4v4" />
  ),
  '/v/food': (
    <path d="M7 3v8m3-8v8m-3 0v10M17 3c-1.2 1-2 3-2 5s.8 3 2 3v10" />
  ),
  '/v/tour': (
    <path d="M12 21s-6.5-5.8-6.5-10.5a6.5 6.5 0 1113 0C18.5 15.2 12 21 12 21zm0-8a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
  ),
}

function TabIcon({ to }: { to: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[to]}
    </svg>
  )
}

export default function VisitorLayout() {
  const capture = useCapture()
  const navigate = useNavigate()
  const [lang, setLang] = useState<'KOR' | 'ENG'>('KOR')

  return (
    <div className={`flex w-full justify-center bg-page ${capture ? 'min-h-[915px]' : 'min-h-[100dvh]'}`}>
      <div
        className={`relative flex flex-col overflow-hidden bg-surface shadow-[0_0_40px_-16px_rgba(0,0,0,0.2)] ${
          capture ? 'h-[915px] w-[412px]' : 'h-[100dvh] w-full max-w-[460px]'
        }`}
      >
        {/* 헤더 — 텍스처 배경 위 흰 로고(현장앱과 통일). 로고 = 홈 회귀. */}
        <header className="relative isolate shrink-0 px-4 pb-3 pt-4 text-white">
          <div aria-hidden className="absolute inset-0 -z-10 bg-primary-900 bg-cover bg-center" style={{ backgroundImage: `url(${bgHeader})` }} />
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/v')} className="flex items-center gap-2" aria-label="홈">
              <img src={logoW} alt="강릉 ITS 세계총회 2026" className="h-9 w-auto" />
            </button>
            <div className="flex items-center gap-2">
              {/* 다국어 토글 — 표시만(발행 다국어는 콘텐츠 단계) */}
              <div className="flex overflow-hidden rounded-full border border-white/30 text-caption font-bold">
                {(['KOR', 'ENG'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`px-2.5 py-1 transition ${lang === l ? 'bg-white/90 text-primary-800' : 'text-white/80'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {/* 마이 — 쿠폰북 연동(무PII·localStorage) */}
              <NavLink
                to={visitorMy.to}
                className={({ isActive }) =>
                  `grid h-8 w-8 place-items-center rounded-full border border-white/30 transition ${isActive ? 'bg-white/90 text-primary-800' : 'text-white hover:bg-white/15'}`
                }
                aria-label={visitorMy.label}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="8" r="3.5" />
                  <path d="M5 20c0-3.6 3.1-5.5 7-5.5s7 1.9 7 5.5" />
                </svg>
              </NavLink>
            </div>
          </div>
        </header>

        {/* 콘텐츠 */}
        <main className="flex-1 overflow-auto bg-page">
          <Outlet />
        </main>

        {/* 하단탭 — 콘텐츠 4개(단일 출처). 홈=로고 · 마이=헤더라 여기엔 없다. */}
        <nav className="shrink-0 border-t border-line bg-surface">
          <div className="flex">
            {visitorTabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `flex flex-1 flex-col items-center gap-1 py-2 text-caption font-semibold transition ${
                    isActive ? 'text-primary-600' : 'text-ink-faint hover:text-ink-muted'
                  }`
                }
              >
                <TabIcon to={t.to} />
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
