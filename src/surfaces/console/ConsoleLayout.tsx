import { NavLink, Outlet } from 'react-router-dom'
import { OPS_INFO } from '../../lib/services'
import { useNowMin } from '../../lib/useLive'
import { fmtHM } from '../../lib/clock'

type NavItem = { to: string; label: string; end?: boolean }
const groups: { title: string; items: NavItem[] }[] = [
  {
    title: '관제',
    items: [
      { to: '/', label: '통합 운영현황', end: true },
      { to: '/people', label: '인력·자원봉사' },
      { to: '/safety', label: '안전·비상' },
    ],
  },
  {
    title: '기록',
    items: [
      { to: '/report', label: '일일 운영보고' },
      { to: '/issues', label: '민원·분실물·미아' },
    ],
  },
  {
    title: '정산',
    items: [
      { to: '/settlement', label: '실비 정산 현황', end: true },
      { to: '/settlement/detail', label: '개인별 정산 내역' },
      { to: '/settlement/close', label: '정산 마감·산출내역서' },
    ],
  },
]

export default function ConsoleLayout() {
  const now = useNowMin()
  return (
    <div className="flex h-full">
      {/* 사이드바 */}
      <aside className="flex w-60 shrink-0 flex-col bg-primary-700 text-neutral-100">
        <div className="px-5 pb-5 pt-6">
          <div className="font-latin text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-200/70">
            ITS World Congress 2026
          </div>
          <div className="mt-1.5 font-title text-lg font-medium leading-tight text-white">
            부대행사 통합운영본부
          </div>
          <div className="mt-0.5 text-caption text-primary-200/60">현장 운영본부 콘솔</div>
        </div>
        <nav className="mt-1 flex-1 space-y-4 overflow-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-primary-200/40">
                {g.title}
              </div>
              <div className="space-y-0.5">
                {g.items.map((n) => (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 text-body font-medium transition ${
                        isActive
                          ? 'bg-white/15 text-white'
                          : 'text-neutral-300 hover:bg-white/5 hover:text-white'
                      }`
                    }
                  >
                    {n.label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-3 text-caption text-neutral-300">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ok" />
            실시간 연결됨
          </div>
        </div>
      </aside>

      {/* 본문 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
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
            <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-50 text-body font-bold text-primary-600">
              관제
            </div>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto bg-page p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
