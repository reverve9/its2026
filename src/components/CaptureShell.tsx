import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useCapture, useArtboard, setCapture } from '../lib/capture'

// 캡쳐 셸 (P3) — 캡쳐 모드일 때 라우트 트리를 고정폭 아트보드로 감싼다.
// · 폭 고정(1440 / 412), 높이 자연 → 콘텐츠 높이 측정 후 900(915)px 마다 컷 라인.
// · 툴바·컷 라벨은 아트보드 '바깥'(no-print, 프레임 밖) → 순수 화면만 캡쳐된다.
// 캡쳐 모드가 아니면 children 을 그대로 통과(동작 변화 0).

const navCls = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-2.5 py-1 text-caption font-semibold transition ${
    isActive ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-neutral-100'
  }`

export default function CaptureShell({ children }: { children: ReactNode }) {
  const on = useCapture()
  const art = useArtboard()
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(art.h)

  useLayoutEffect(() => {
    if (!on) return
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setHeight(el.offsetHeight))
    ro.observe(el)
    setHeight(el.offsetHeight)
    return () => ro.disconnect()
  }, [on, art.w])

  if (!on) return <>{children}</>

  // 컷 라인: 아트보드 높이 배수마다 (콘텐츠가 그보다 길 때만).
  const cuts: number[] = []
  for (let y = art.h; y < height - 1; y += art.h) cuts.push(y)
  const panels = cuts.length + 1

  return (
    <div className="min-h-[100dvh] w-full overflow-auto bg-neutral-300/80 py-16">
      {/* 툴바 — 아트보드 바깥. 캡쳐에 안 들어간다. */}
      <div className="no-print fixed left-4 top-4 z-[70] flex items-center gap-2 rounded-xl border border-line bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
        <span className="rounded-md bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          캡쳐
        </span>
        <span className="tnum text-caption font-semibold text-ink-muted">
          {art.label} · {art.w}×{art.h}
          {panels > 1 ? ` · ${panels}컷` : ''}
        </span>
        <div className="mx-1 h-4 w-px bg-line" />
        <NavLink to="/" end className={navCls}>
          콘솔
        </NavLink>
        <NavLink to="/f" className={navCls}>
          현장
        </NavLink>
        <NavLink to="/v" className={navCls}>
          방문객
        </NavLink>
        <div className="mx-1 h-4 w-px bg-line" />
        <button
          onClick={() => setCapture(false)}
          className="rounded-md border border-line px-2 py-1 text-caption font-semibold text-ink-muted transition hover:bg-neutral-100"
        >
          종료
        </button>
      </div>

      {/* 아트보드 — 폭 고정. 요소 스크린샷 대상. */}
      <div className="mx-auto shadow-2xl ring-1 ring-black/10" style={{ width: art.w }}>
        <div ref={ref} className="relative bg-page">
          {children}
          {/* 세로 2분할 컷 가이드 */}
          {cuts.map((y, i) => (
            <div
              key={y}
              className="no-print pointer-events-none absolute inset-x-0 z-[65]"
              style={{ top: y }}
            >
              <div className="border-t-2 border-dashed border-primary-500" />
              <span className="tnum absolute right-2 -translate-y-1/2 rounded bg-primary-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                컷 {i + 1} · {y}px
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
