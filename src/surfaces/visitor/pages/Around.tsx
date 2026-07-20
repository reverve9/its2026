import VisitorPage from './VisitorPage'
import Thumb from './Thumb'
import { TOURIST_ZONES } from '../../../lib/visitorContent'

// 관광정보 — 강릉 주요 관광지 + 자원봉사 지원부스(§2-1 관광정보 반영·§3). 맛집은 별도 탭.
export default function Around() {
  return (
    <VisitorPage title="관광정보">
      <div className="space-y-5">
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">주요 관광지</h2>
          <div className="grid grid-cols-2 gap-2">
            {TOURIST_ZONES.map((z) => (
              <div key={z.id} className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
                <Thumb className="aspect-[16/10] w-full" />
                <div className="p-3">
                  <div className="truncate text-label font-semibold text-ink-strong">{z.name}</div>
                  <div className="tnum mt-0.5 text-caption text-ink-muted">{z.opWindow.start}–{z.opWindow.end}</div>
                  <div className="mt-1 inline-flex rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">자원봉사 지원부스</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </VisitorPage>
  )
}
