import { useState } from 'react'
import { getFoodVendors, getFoodSummary, getFoodParasols, registerVendorDoc } from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import type { FoodVendor, VendorKind } from '../../../types'
import { PageHeader, Section } from '../../../components/layout'
import { usePageState, paginate, Pagination } from '../../../components/ui'

// 업체 등록 현황 — 먹거리 입점업체(푸드트럭 5 · 음식부스 5) 정보·구비서류 등록 대장.
// 클라이언트(업체)앱이 없으므로 업체 셀프 등록이 아니라 운영본부가 대신 등록·관리한다.
// 인력 현황과 같은 '운영(행정) 대장' 성격 — 시간 비의존. 스크러버를 밀어도 변하지 않는다.

const tabs: { key: VendorKind; label: string }[] = [
  { key: 'truck', label: '푸드트럭' },
  { key: 'booth', label: '음식부스' },
]

const telHref = (p: string) => `tel:${p.replace(/-/g, '')}`

function SummaryTile({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'ok' | 'warn' }) {
  const cls = tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink-strong'
  return (
    <div className="card p-4">
      <div className="text-label font-medium text-ink-muted">{label}</div>
      <div className={`tnum mt-1 text-title font-bold ${cls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-caption text-ink-faint">{sub}</div>}
    </div>
  )
}

// 서류 등록 토글 — 누르면 store 뮤테이트 → 상단 이행률·목록 배지 전파(R3).
function DocToggle({ on, label, at, onToggle }: { on: boolean; label: string; at?: string; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
        on ? 'border-ok/30 bg-ok-soft' : 'border-line bg-page hover:border-primary-400'
      }`}
    >
      <div className="min-w-0">
        <div className={`text-label font-semibold ${on ? 'text-ok' : 'text-ink-strong'}`}>{label}</div>
        <div className="mt-0.5 text-caption text-ink-muted">
          {on ? `등록 완료 · ${at ?? '—'}` : '미등록 — 클릭해 등록 처리'}
        </div>
      </div>
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-caption font-bold ${
          on ? 'bg-ok text-white' : 'bg-neutral-100 text-ink-faint ring-1 ring-inset ring-line'
        }`}
      >
        {on ? '✓' : '—'}
      </span>
    </button>
  )
}

function VendorDetailModal({ id, onClose }: { id: string; onClose: () => void }) {
  const vendors = useLive(() => getFoodVendors())
  const v = vendors?.find((x) => x.id === id)
  if (!v) return null
  const done = v.docs.filter((d) => d.done).length
  const complete = done === v.docs.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <div className="font-title text-title font-medium text-ink-strong">{v.name}</div>
            <div className="mt-0.5 text-label text-ink-muted">
              {v.kind === 'truck' ? '푸드트럭' : '음식부스'} · {v.spot} · {v.items}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-1 text-caption font-semibold ${complete ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>
              {complete ? '등록 완료' : `서류 미비 ${v.docs.length - done}건`}
            </span>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted transition hover:bg-neutral-100 hover:text-ink-strong"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="overflow-auto p-6">
          <Section title="업체 정보">
            <div className="px-1">
              {[
                ['상호', v.name],
                ['구분', v.kind === 'truck' ? '푸드트럭' : '음식부스'],
                ['주요 품목', v.items],
                ['배치 구획', `음식판매·휴게구역 ${v.spot}`],
                ['신청 운영시간', v.opHours],
                ['등록일', v.registeredAt ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
                  <span className="shrink-0 text-label text-ink-muted">{label}</span>
                  <span className="text-right text-label font-medium text-ink-strong">{value}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="shrink-0 text-label text-ink-muted">대표 연락처</span>
                <a href={telHref(v.contact)} className="tnum text-label font-medium text-primary-700 hover:underline">
                  {v.contact}
                </a>
              </div>
            </div>
          </Section>

          <div className="mt-5">
            <Section
              title="구비서류 등록"
              right={
                <span className={`text-caption font-semibold ${complete ? 'text-ok' : 'text-warn'}`}>
                  {done}/{v.docs.length} 등록
                </span>
              }
            >
              <div className="space-y-2">
                {v.docs.map((d) => (
                  <DocToggle
                    key={d.id}
                    on={d.done}
                    at={d.at}
                    label={d.label}
                    onToggle={() => registerVendorDoc(v.id, d.id, !d.done)}
                  />
                ))}
              </div>
              {v.note && <p className="mt-3 text-label text-warn">⚠ {v.note}</p>}
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FoodVendors() {
  const [kind, setKind] = useState<VendorKind>('truck')
  const [pendingOnly, setPendingOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // 훅은 조기 반환(`if (!vendors || !summary)`) 앞에서 — 탭·필터가 바뀌면 1페이지로.
  // 현재 시드는 탭당 5행이라 컨트롤이 렌더되지 않는다(1페이지). 업체가 늘면 그대로 동작.
  const pg = usePageState(`${kind}|${pendingOnly}`)

  const vendors = useLive(() => getFoodVendors())
  const summary = useLive(getFoodSummary)
  const parasols = useLive(getFoodParasols)
  if (!vendors || !summary) return null

  const docDone = (v: FoodVendor) => v.docs.filter((d) => d.done).length
  const rows = vendors.filter((v) => v.kind === kind && (!pendingOnly || docDone(v) < v.docs.length))
  const page = paginate(rows, pg.page)
  const pct = summary.docTotal ? Math.round((summary.docDone / summary.docTotal) * 100) : 0

  return (
    <div>
      <PageHeader
        title="업체 등록 현황"
        summary={`먹거리 입점업체 정보·구비서류 등록 대장 — 음식판매·휴게구역 (파라솔 ${parasols ?? 80}석)`}
        right={
          <button
            onClick={() => window.print()}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-label font-semibold text-ink-base shadow-sm transition hover:text-ink-strong"
          >
            등록 대장 출력
          </button>
        }
      />

      <div className="mb-4 grid grid-cols-4 gap-3">
        <SummaryTile label="입점업체" value={`${summary.total}팀`} sub={`푸드트럭 ${summary.trucks} · 음식부스 ${summary.booths}`} />
        <SummaryTile label="등록 완료" value={`${summary.registered}팀`} sub={`서류 전량 등록 / 총 ${summary.total}팀`} tone={summary.registered === summary.total ? 'ok' : 'default'} />
        <SummaryTile label="서류 이행률" value={`${pct}%`} sub={`${summary.docDone} / ${summary.docTotal} 항목`} tone={pct === 100 ? 'ok' : 'default'} />
        <SummaryTile label="서류 미비 업체" value={`${summary.pendingVendors}팀`} sub="개장 전 보완 필요" tone={summary.pendingVendors ? 'warn' : 'ok'} />
      </div>

      {/* 탭 — 푸드트럭 / 음식부스 */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex gap-1 rounded-full bg-neutral-100 p-0.5">
          {tabs.map((t) => {
            const n = vendors.filter((v) => v.kind === t.key).length
            return (
              <button
                key={t.key}
                onClick={() => setKind(t.key)}
                className={`rounded-full px-3.5 py-1 text-label font-semibold transition ${
                  kind === t.key ? 'bg-primary-600 text-white' : 'text-ink-muted hover:text-ink-strong'
                }`}
              >
                {t.label} <span className="tnum">{n}</span>
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setPendingOnly((v) => !v)}
          className={`ml-auto rounded-full px-3 py-1.5 text-label font-semibold transition ${
            pendingOnly ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'
          }`}
        >
          서류 미비만
        </button>
      </div>

      {/* 등록 대장 */}
      <div className="mb-2 flex justify-end">
        <Pagination
          page={page.page}
          pages={page.pages}
          start={page.start}
          shown={page.slice.length}
          total={page.total}
          onChange={pg.setPage}
        />
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-label">
          <thead>
            <tr className="border-b border-line bg-neutral-50 text-caption text-ink-muted">
              <th className="px-3 py-2.5 text-left font-semibold">구획</th>
              <th className="px-3 py-2.5 text-left font-semibold">상호</th>
              <th className="px-3 py-2.5 text-left font-semibold">주요 품목</th>
              <th className="px-3 py-2.5 text-left font-semibold">신청 운영시간</th>
              <th className="px-3 py-2.5 text-left font-semibold">대표 연락처</th>
              <th className="px-3 py-2.5 text-left font-semibold">구비서류</th>
              <th className="px-3 py-2.5 text-left font-semibold">등록일</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {page.slice.map((v) => {
              const done = docDone(v)
              const complete = done === v.docs.length
              return (
                <tr
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  className="group cursor-pointer border-b border-line-soft transition last:border-0 hover:bg-primary-50/50"
                >
                  <td className="px-3 py-2.5">
                    <span className="tnum rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-base">{v.spot}</span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-ink-strong">{v.name}</td>
                  <td className="px-3 py-2.5 text-ink-base">{v.items}</td>
                  <td className="tnum px-3 py-2.5 text-ink-muted">{v.opHours}</td>
                  <td className="px-3 py-2.5">
                    <a
                      href={telHref(v.contact)}
                      onClick={(e) => e.stopPropagation()}
                      className="tnum text-label font-medium text-primary-700 hover:underline"
                    >
                      {v.contact}
                    </a>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-caption font-semibold ${complete ? 'bg-ok-soft text-ok' : 'bg-warn-soft text-warn'}`}>
                      {complete ? '등록 완료' : `미비 ${v.docs.length - done}건`}
                    </span>
                  </td>
                  <td className="tnum px-3 py-2.5 text-ink-muted">{v.registeredAt ?? '—'}</td>
                  <td className="pr-3 text-right text-ink-faint transition group-hover:text-primary-600">›</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-8 text-center text-body text-ink-faint">해당 조건의 업체가 없습니다.</div>
        )}
      </div>


      {selectedId && <VendorDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
