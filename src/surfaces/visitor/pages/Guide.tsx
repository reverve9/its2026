import VisitorPage from './VisitorPage'
import {
  VENUE_ZONES,
  VENUE_VENDORS,
  FACILITIES,
  TRANSPORT,
  SHUTTLE_INFO,
  EMERGENCY_CONTACTS,
} from '../../../lib/visitorContent'

// 행사안내 — 현장 실용·길찾기. 배치도·편의·행사장 음식·교통·비상.
export default function Guide() {
  return (
    <VisitorPage title="행사안내">
      <div className="space-y-5">
        {/* 배치도 — 정적 배치도 자리(발주기관 배치도 확정 시 이미지 교체) */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">행사장 배치도</h2>
          <div className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line bg-page text-caption text-ink-faint">
            배치도
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {VENUE_ZONES.map((z) => (
              <div key={z.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 shadow-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" />
                <span className="truncate text-caption font-semibold text-ink-strong">{z.name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 편의시설 */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">편의시설</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            {FACILITIES.map((f) => (
              <div key={f.label} className="flex gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
                <span className="w-24 shrink-0 text-label font-semibold text-ink-strong">{f.label}</span>
                <span className="text-caption text-ink-muted">{f.spot}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 행사장 음식·휴게 구역 */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">음식·휴게 구역</h2>
          <div className="grid grid-cols-2 gap-2">
            {VENUE_VENDORS.map((v) => (
              <div key={v.id} className="rounded-xl border border-line bg-surface p-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="tnum shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-muted">{v.spot}</span>
                  <span className="truncate text-label font-semibold text-ink-strong">{v.name}</span>
                </div>
                <div className="mt-1 truncate text-caption text-ink-muted">{v.items}</div>
                <div className="tnum mt-0.5 text-caption text-ink-faint">{v.opHours}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 교통 */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">교통</h2>
          <div className="space-y-2 rounded-xl border border-line bg-surface p-4 shadow-sm text-label text-ink-muted">
            {SHUTTLE_INFO.lines.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            <p>{TRANSPORT.transit}</p>
            <p>{TRANSPORT.parking}</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TRANSPORT.hubs.map((h) => (
              <span key={h} className="rounded-full border border-line bg-surface px-2.5 py-1 text-caption font-semibold text-ink-strong shadow-sm">{h}</span>
            ))}
          </div>
        </section>

        {/* 비상연락처 */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">비상연락처</h2>
          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
            {EMERGENCY_CONTACTS.map((c) => (
              <a key={c.label} href={`tel:${c.phone.replace(/-/g, '')}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 transition active:bg-page">
                <span className="min-w-0 flex-1">
                  <span className="block text-label font-semibold text-ink-strong">{c.label}</span>
                  {c.note && <span className="block truncate text-caption text-ink-muted">{c.note}</span>}
                </span>
                <span className="tnum shrink-0 text-label font-bold text-primary-600">{c.phone}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </VisitorPage>
  )
}
