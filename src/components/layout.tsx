import type { ReactNode } from 'react'

// 헤더형 카드 컨테이너 + 페이지 헤더 — 화면은 이 위에 조립.

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function Section({
  title,
  right,
  bodyClassName = 'p-4',
  className = '',
  children,
}: {
  title: string
  right?: ReactNode
  bodyClassName?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={`card flex min-h-0 flex-col ${className}`}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-section font-semibold text-ink-strong">{title}</h2>
        {right}
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  )
}

export function PageHeader({
  title,
  summary,
  right,
}: {
  title: string
  summary?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-title text-title font-medium text-ink-strong">{title}</h1>
        {summary && <p className="mt-1 text-body text-ink-muted">{summary}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}

// 라이브 표시용 pill (실시간 연결 등)
export function LivePill({ label = '실시간' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ok-soft px-2.5 py-1 text-caption font-semibold text-ok">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
      {label}
    </span>
  )
}
