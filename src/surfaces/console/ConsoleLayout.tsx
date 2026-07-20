import { useState } from 'react'
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { OPS_INFO } from '../../lib/services'
import { useNowMin } from '../../lib/useLive'
import { fmtHM } from '../../lib/clock'
import { useCapture } from '../../lib/capture'
import { loadConsoleSession, saveConsoleSession, clearConsoleSession } from '../../lib/consoleAuth'
import type { ConsoleSession } from '../../lib/consoleAuth'
import { overview, sections, visibleTo } from '../../lib/consoleNav'
import ConsoleLogin from './ConsoleLogin'
import bgSidebar from '../../assets/bg-sidebar.jpg'
import logoW from '../../assets/logo-its-w.png'

// 텍스처 배경 위 텍스트 — 흰색 계열로 통일하고 위계는 투명도(80~100%)로만 준다.
// 배경 최악 지점(#226866) 기준 white/80 = 4.8:1 이 AA 하한선. 그 아래로 내리면 미달.
// 활성 칩은 white/15 가 상한 — 더 밝히면 그 위 흰 텍스트가 4.5:1 아래로 떨어지고(제로섬),
// 어둡게 깔면 텍스처에 구멍이 뚫린 듯 튄다. 부족한 식별은 좌측 액센트 바로 보강.
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `relative block rounded-lg py-2 pl-4 pr-3 text-body transition ${
    isActive
      ? 'bg-white/15 font-semibold text-white before:absolute before:left-1 before:top-1/2 before:h-4 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-white/90 before:content-[""]'
      : 'font-medium text-white/80 hover:bg-white/10 hover:text-white'
  }`

export default function ConsoleLayout() {
  const now = useNowMin()
  const capture = useCapture()
  const { pathname } = useLocation()
  const [session, setSession] = useState<ConsoleSession | null>(() => loadConsoleSession())
  // 아코디언 접힘 — 제목 있는 묶음 기준. 초기엔 첫 묶음만 펼치고 나머지는 접는다(제목 없는 묶음은 대상 아님).
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(sections.flatMap((s) => s.groups).map((g) => g.title).filter((t): t is string => !!t).slice(1))
  )
  const toggleGroup = (title: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title)
      else next.add(title)
      return next
    })

  if (!session) {
    return (
      <div className="h-full">
        <ConsoleLogin
          onLogin={(s) => { saveConsoleSession(s); setSession(s) }}
        />
      </div>
    )
  }

  // 메뉴에 없는 화면을 URL 로 직접 들어오면 되돌린다. 사이드바와 같은 배열을 본다.
  const blocked = sections
    .flatMap((s) => s.groups)
    .flatMap((g) => g.items)
    .some((n) => n.superAdminOnly && n.to === pathname && session.role !== 'superAdmin')
  if (blocked) return <Navigate to="/" replace />

  // 캡쳐 모드: h-full 대신 최소 900 + 본문 overflow-visible → 자연 높이로 펼쳐 2분할 컷.
  return (
    <div className={capture ? 'flex min-h-[900px]' : 'flex h-full'}>
      {/* 사이드바 — 워터컬러 붓터치 텍스처 배경.
          오버레이는 쓰지 않는다: 평탄한 알파는 붓터치 대비를 같은 비율로 눌러
          '어둡게 하면 텍스처가 죽는' 제로섬이 된다. 대신 이미지 자체를 L* 14~40 으로
          리맵해(원본 48~67, 폭 18.4 → 26) 어둡게 + 붓터치 강화를 동시에 얻었다.
          → 흰 텍스트 대비 7.5:1(최악 지점 기준). 에셋 생성 근거는 핸드오프 참조. */}
      <aside className="no-print relative isolate flex w-60 shrink-0 flex-col text-neutral-100">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-primary-900 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgSidebar})` }}
        />
        {/* 브랜드 — 현장앱 헤더와 동일한 행사 로고(텍스트 타이틀 대신 이미지로 통일). */}
        <div className="px-5 pb-5 pt-6">
          <img src={logoW} alt="강릉 ITS 세계총회 2026" className="h-14 w-auto" />
          <div className="mt-2.5 text-title font-bold tracking-tight text-white">통합운영 플랫폼</div>
        </div>
        <nav className="mt-1 flex-1 space-y-5 overflow-auto px-3 pb-4">
          {/* 통합 운영현황 — 갈래 밖 최상단 단독 */}
          <NavLink to={overview.to} end={overview.end} className={navLinkClass}>
            {overview.label}
          </NavLink>

          {/* 최상위 갈래(현장 / 사용자) → 그 아래 묶음은 아코디언 */}
          {sections.map((section) => {
            const visGroups = section.groups.filter((g) => g.items.some(visibleTo(session.role)))
            // 보이는 항목이 하나도 없는 섹션은 통째로 숨긴다(발주처엔 콘텐츠·정산 섹션이 사라짐).
            if (visGroups.length === 0) return null
            return (
              <div key={section.title} className="space-y-1">
                <div className="px-2 text-label font-bold text-white">{section.title}</div>
                {visGroups.map((g, gi) => {
                  const items = g.items.filter(visibleTo(session.role)).map((n) => (
                    <NavLink key={n.to} to={n.to} end={n.end} className={navLinkClass}>
                      {n.label}
                    </NavLink>
                  ))
                  // 제목 없는 묶음 = 섹션 아래 항목 직접 나열(아코디언 없음).
                  if (!g.title) {
                    return (
                      <div key={`${section.title}-${gi}`} className="space-y-0.5">
                        {items}
                      </div>
                    )
                  }
                  const open = !collapsed.has(g.title)
                  return (
                    <div key={g.title}>
                      <button
                        onClick={() => toggleGroup(g.title!)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10 hover:text-white/90"
                      >
                        <span>{g.title}</span>
                        <svg
                          viewBox="0 0 12 12"
                          className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M3 4.5 L6 7.5 L9 4.5" />
                        </svg>
                      </button>
                      {open && <div className="mt-0.5 space-y-0.5">{items}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </nav>
        <div className="border-t border-white/20 px-5 py-3 text-caption text-white/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ok ring-1 ring-white/50" />
            실시간 연결됨
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-white/80">{session.label}</span>
            <button
              onClick={() => { clearConsoleSession(); setSession(null) }}
              className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 font-semibold text-white/90 transition hover:bg-white/20"
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* 본문 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b border-line bg-surface px-6 py-3">
          <div>
            <div className="text-body font-semibold text-ink-strong">{OPS_INFO.eventName}</div>
            <div className="text-caption text-ink-muted">
              운영일 {OPS_INFO.operationDate} · {OPS_INFO.shiftLabel}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="tnum text-section font-bold text-ink-strong">{fmtHM(now)}</div>
              <div className="text-caption text-ink-muted">현재 시각 · {now < 14 * 60 ? '오전조' : '오후조'}</div>
            </div>
            <div className="grid h-9 place-items-center rounded-full bg-primary-50 px-3 text-label font-bold text-primary-600">
              {session.role === 'superAdmin' ? '관리자' : '발주처'}
            </div>
          </div>
        </header>
        <main className={`flex-1 bg-page p-6 ${capture ? 'overflow-visible' : 'min-h-0 overflow-auto'}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
