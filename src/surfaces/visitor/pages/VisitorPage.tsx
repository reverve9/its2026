import type { ReactNode } from 'react'

// 방문객앱 콘텐츠 페이지 공통 골격 — 제목 + 본문. 콘텐츠는 발행 단계에서 채운다.
export default function VisitorPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="p-4">
      <h1 className="mb-3 text-title font-title font-semibold text-ink-strong">{title}</h1>
      {children}
    </div>
  )
}
