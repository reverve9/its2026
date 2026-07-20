import VisitorPage from './VisitorPage'
import { EVENT, ABOUT_INTRO, VENUE_ZONES } from '../../../lib/visitorContent'

// 개요 — 행사 소개(정적). 취지·강릉 홍보·행사 전체 개관. 현장 실용은 행사안내 탭.
export default function About() {
  const rows = [
    { k: '행사명', v: EVENT.name },
    { k: '기간', v: EVENT.period },
    { k: '장소', v: EVENT.place },
    { k: '주최·주관', v: EVENT.host },
    { k: '조직위', v: EVENT.organizer },
  ]
  return (
    <VisitorPage title="개요">
      <div className="space-y-5">
        {/* 소개 문안 */}
        <section className="space-y-2">
          {ABOUT_INTRO.map((line, i) => (
            <p key={i} className="text-label leading-relaxed text-ink-muted">{line}</p>
          ))}
        </section>

        {/* 행사 정보 */}
        <section className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
          {rows.map((r) => (
            <div key={r.k} className="flex gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
              <span className="w-20 shrink-0 text-caption font-semibold text-ink-faint">{r.k}</span>
              <span className="text-label text-ink-strong">{r.v}</span>
            </div>
          ))}
        </section>

        {/* 행사장 전체 개관 — 강릉시 운영 구역 */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">행사장 구역</h2>
          <div className="grid grid-cols-2 gap-2">
            {VENUE_ZONES.map((z) => (
              <div key={z.id} className="rounded-xl border border-line bg-surface p-3 shadow-sm">
                <div className="text-label font-semibold text-ink-strong">{z.name}</div>
                <div className="tnum mt-0.5 text-caption text-ink-muted">{z.opWindow.start}–{z.opWindow.end}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-caption text-ink-faint">문화관광·기술체험·마켓·드론·아이스쇼 구역은 조직위원회 운영</p>
        </section>
      </div>
    </VisitorPage>
  )
}
