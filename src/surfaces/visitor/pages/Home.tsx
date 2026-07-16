import { OPS_INFO } from '../../../lib/services'

// 방문객앱 홈(로고 진입) — 행사 랜딩. 히어로·소식·바로가기는 발행 단계에서 채운다.
export default function Home() {
  return (
    <div className="p-4">
      <section className="rounded-xl border border-line bg-surface p-6 text-center shadow-sm">
        <div className="text-title font-title font-semibold leading-snug text-ink-strong">
          {OPS_INFO.eventName}
        </div>
      </section>
    </div>
  )
}
