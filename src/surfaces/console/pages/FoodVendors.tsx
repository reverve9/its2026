import { useState } from 'react'
import {
  getFoodVendors, getFoodSummary, getFoodParasols, registerVendorDoc,
  importVendors, VENDOR_IMPORT_HEADERS,
} from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import type { FoodVendor, VendorKind } from '../../../types'
import { PageHeader, Section } from '../../../components/layout'
import {
  usePageState, paginate, Pagination,
  ActionButton, ImportButton, ListToolbar, ToolbarRow, FilterPills, FilterToggle,
} from '../../../components/ui'
import { exportExcel, exportTemplate, readExcel } from '../../../lib/excel'
import { getNowDate } from '../../../lib/clock'
import { CITY_RESTAURANTS, RESTAURANT_CATEGORIES, type CityRestaurant } from '../../../lib/visitorContent'

// 업체 등록 현황 — 3탭: 푸드트럭·음식부스(행사장 먹거리 입점업체, 구비서류 대장) + 도심 맛집(§2-3 음식점 지도 발행 원본).
// 클라이언트(업체)앱이 없으므로 업체 셀프 등록이 아니라 운영본부가 대신 등록·관리한다.
// 인력 현황과 같은 '운영(행정) 대장' 성격 — 시간 비의존. 스크러버를 밀어도 변하지 않는다.
// 도심 맛집은 행사장 부스와 별개 엔티티(D55) — 카테고리 필터(인력현황 FilterPills 스타일)로 분류별 조회.

type TabKey = VendorKind | 'city'
const tabs: { key: TabKey; label: string }[] = [
  { key: 'truck', label: '푸드트럭' },
  { key: 'booth', label: '음식부스' },
  { key: 'city', label: '도심 맛집' },
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

// 도심 맛집 상세(콘솔) — 발행 원본 조회. 방문객 모달과 같은 데이터, 데스크탑 카드 셸.
function CityDetailModal({ r, onClose }: { r: CityRestaurant; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <div className="font-title text-title font-medium text-ink-strong">{r.name}</div>
            <div className="mt-0.5 text-label text-ink-muted">{r.category} · {r.area} · {r.address}</div>
          </div>
          <div className="flex items-center gap-2">
            {r.coupon && (
              <span className="rounded-md bg-primary-50 px-2 py-1 text-caption font-semibold text-primary-700">쿠폰 · {r.coupon}</span>
            )}
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
          <Section title="업소 정보">
            <div className="px-1">
              {[
                ['분류', r.category],
                ['위치', `${r.area} · ${r.address}`],
                ['영업시간', r.hours],
                ['대표메뉴', `${r.signature} · ${r.price}원`],
                ['외국어 메뉴', r.foreignMenu ? '제공' : '—'],
                ['편의', r.tags?.join(' · ') ?? '—'],
                ['혜택(쿠폰)', r.coupon ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line-soft py-2.5 last:border-0">
                  <span className="shrink-0 text-label text-ink-muted">{label}</span>
                  <span className="text-right text-label font-medium text-ink-strong">{value}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <span className="shrink-0 text-label text-ink-muted">대표 연락처</span>
                <a href={telHref(r.phone)} className="tnum text-label font-medium text-primary-700 hover:underline">{r.phone}</a>
              </div>
            </div>
          </Section>

          <div className="mt-5">
            <Section title="메뉴" right={<span className="text-caption text-ink-muted">{r.menu.length}개</span>}>
              <div className="divide-y divide-line-soft">
                {r.menu.map((m) => (
                  <div key={m.name} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-1.5 text-label text-ink-strong">
                      {m.name}
                      {m.sig && <span className="rounded bg-primary-50 px-1.5 py-0.5 text-caption font-bold text-primary-700">대표</span>}
                    </span>
                    <span className="tnum text-label font-medium text-ink-muted">{m.price}원</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FoodVendors() {
  const [tab, setTab] = useState<TabKey>('truck')
  const [cat, setCat] = useState('전체') // 도심 맛집 카테고리 필터
  const [pendingOnly, setPendingOnly] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null) // 부스/트럭
  const [selectedCity, setSelectedCity] = useState<string | null>(null) // 도심 맛집(name)
  const [toast, setToast] = useState('')
  // 훅은 조기 반환 앞에서 — 탭·필터가 바뀌면 1페이지로.
  const pg = usePageState(`${tab}|${cat}|${pendingOnly}`)

  const vendors = useLive(() => getFoodVendors())
  const summary = useLive(getFoodSummary)
  const parasols = useLive(getFoodParasols)
  if (!vendors || !summary) return null

  const isCity = tab === 'city'
  const docDone = (v: FoodVendor) => v.docs.filter((d) => d.done).length

  const vendorRows = vendors.filter((v) => v.kind === tab && (!pendingOnly || docDone(v) < v.docs.length))
  const cityRows = cat === '전체' ? CITY_RESTAURANTS : CITY_RESTAURANTS.filter((r) => r.category === cat)
  const vPage = paginate(vendorRows, pg.page)
  const cPage = paginate(cityRows, pg.page)
  const pageInfo = isCity ? cPage : vPage
  const pct = summary.docTotal ? Math.round((summary.docDone / summary.docTotal) * 100) : 0

  const cityCoupon = CITY_RESTAURANTS.filter((r) => r.coupon).length
  const cityForeign = CITY_RESTAURANTS.filter((r) => r.foreignMenu).length
  const catCount = RESTAURANT_CATEGORIES.length - 1 // '전체' 제외

  const tabOptions = tabs.map((t) => ({
    ...t,
    count: t.key === 'city' ? CITY_RESTAURANTS.length : vendors.filter((v) => v.kind === t.key).length,
  }))
  // 카테고리 필터(인력현황 FilterPills 스타일) — '전체' + 등장 분류.
  const catOptions = RESTAURANT_CATEGORIES.map((c) => ({
    key: c,
    label: c,
    count: c === '전체' ? CITY_RESTAURANTS.length : CITY_RESTAURANTS.filter((r) => r.category === c).length,
  }))

  const switchTab = (k: TabKey) => {
    setTab(k)
    setSelectedId(null)
    setSelectedCity(null)
  }

  // 엑셀 내보내기 — 부스/트럭 탭 전용(화면 컬럼 그대로). 조작 칸(›)은 데이터가 아니라 뺀다.
  const exportRows = () =>
    exportExcel(
      vendorRows,
      [
        { label: '구획', value: (v) => v.spot },
        { label: '상호', value: (v) => v.name },
        { label: '주요 품목', value: (v) => v.items },
        { label: '신청 운영시간', value: (v) => v.opHours },
        { label: '대표 연락처', value: (v) => v.contact },
        { label: '구비서류', value: (v) => (docDone(v) === v.docs.length ? '등록 완료' : `미비 ${v.docs.length - docDone(v)}건`) },
        { label: '등록일', value: (v) => v.registeredAt ?? '—' },
      ],
      `업체등록현황_${tabs.find((t) => t.key === tab)?.label}_${getNowDate()}`
    )

  // 대량 등록 — 지금 열린 탭(푸드트럭/음식부스)으로. isCity 일 땐 이 컨트롤이 렌더되지 않는다.
  const importRows = async (file: File) => {
    try {
      const r = await importVendors(await readExcel(file, VENDOR_IMPORT_HEADERS), tab as VendorKind)
      const parts = [`${r.added}팀 등록`]
      if (r.skipped) parts.push(`${r.skipped}팀 이미 있음(구획 중복)`)
      if (r.errors.length) parts.push(`${r.errors.length}행 오류 — ${r.errors[0].row}행: ${r.errors[0].message}`)
      setToast(parts.join(' · '))
    } catch (e) {
      setToast(e instanceof Error ? e.message : '파일을 읽지 못했습니다.')
    }
    setTimeout(() => setToast(''), 6000)
  }

  return (
    <div>
      <PageHeader
        title="업체 등록 현황"
        summary={
          isCity
            ? '도심·관광지 음식점 등록 대장 — 음식점 지도(§2-3) 발행 원본'
            : `먹거리 입점업체 정보·구비서류 등록 대장 — 음식판매·휴게구역 (파라솔 ${parasols ?? 80}석)`
        }
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
        {isCity ? (
          <>
            <SummaryTile label="등록 업소" value={`${CITY_RESTAURANTS.length}개소`} sub={`카테고리 ${catCount}종`} />
            <SummaryTile label="쿠폰 제공" value={`${cityCoupon}개소`} sub="자율 혜택형 · 표시만" />
            <SummaryTile label="외국어 메뉴" value={`${cityForeign}개소`} sub="국·영문 병기 업소" />
            <SummaryTile label="표시 중" value={cat} sub={`${cityRows.length}개소`} />
          </>
        ) : (
          <>
            <SummaryTile label="입점업체" value={`${summary.total}팀`} sub={`푸드트럭 ${summary.trucks} · 음식부스 ${summary.booths}`} />
            <SummaryTile label="등록 완료" value={`${summary.registered}팀`} sub={`서류 전량 등록 / 총 ${summary.total}팀`} tone={summary.registered === summary.total ? 'ok' : 'default'} />
            <SummaryTile label="서류 이행률" value={`${pct}%`} sub={`${summary.docDone} / ${summary.docTotal} 항목`} tone={pct === 100 ? 'ok' : 'default'} />
            <SummaryTile label="서류 미비 업체" value={`${summary.pendingVendors}팀`} sub="개장 전 보완 필요" tone={summary.pendingVendors ? 'warn' : 'ok'} />
          </>
        )}
      </div>

      {/* 탭 = 1차 축(부스/트럭/도심맛집). 도심맛집은 카테고리 FilterPills, 나머지는 서류미비 토글. */}
      <ListToolbar>
        <ToolbarRow
          right={
            isCity ? (
              <Pagination page={pageInfo.page} pages={pageInfo.pages} onChange={pg.setPage} />
            ) : (
              <>
                <ActionButton onClick={() => exportTemplate(VENDOR_IMPORT_HEADERS, '업체등록_등록양식')}>
                  양식 내려받기
                </ActionButton>
                <ImportButton onFile={importRows}>엑셀 가져오기</ImportButton>
                <ActionButton onClick={exportRows} disabled={vendorRows.length === 0}>
                  엑셀 내보내기
                </ActionButton>
                <Pagination page={pageInfo.page} pages={pageInfo.pages} onChange={pg.setPage} />
              </>
            )
          }
        >
          <FilterPills options={tabOptions} value={tab} onChange={switchTab} />
          {isCity ? (
            <FilterPills options={catOptions} value={cat} onChange={setCat} />
          ) : (
            <FilterToggle on={pendingOnly} onToggle={() => setPendingOnly((v) => !v)}>
              서류미비
            </FilterToggle>
          )}
        </ToolbarRow>
      </ListToolbar>

      {toast && !isCity && (
        <div className="mb-3 rounded-xl border border-ok/30 bg-ok-soft px-4 py-2.5 text-label font-semibold text-ok">
          ✓ {toast}
        </div>
      )}

      {isCity ? (
        <div className="card overflow-hidden">
          <table className="w-full text-label">
            <thead>
              <tr className="border-b border-line bg-neutral-50 text-caption text-ink-muted">
                <th className="px-3 py-2.5 text-left font-semibold">분류</th>
                <th className="px-3 py-2.5 text-left font-semibold">상호</th>
                <th className="px-3 py-2.5 text-left font-semibold">위치</th>
                <th className="px-3 py-2.5 text-left font-semibold">대표메뉴</th>
                <th className="px-3 py-2.5 text-left font-semibold">가격</th>
                <th className="px-3 py-2.5 text-left font-semibold">영업시간</th>
                <th className="px-3 py-2.5 text-left font-semibold">혜택</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {cPage.slice.map((r) => (
                <tr
                  key={r.name}
                  onClick={() => setSelectedCity(r.name)}
                  className="group cursor-pointer border-b border-line-soft transition last:border-0 hover:bg-primary-50/50"
                >
                  <td className="px-3 py-2.5">
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-base">{r.category}</span>
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-ink-strong">
                    {r.name}
                    {r.foreignMenu && <span className="ml-1.5 rounded bg-neutral-100 px-1.5 py-0.5 text-caption font-medium text-ink-muted">외국어</span>}
                  </td>
                  <td className="px-3 py-2.5 text-ink-base">{r.area}</td>
                  <td className="px-3 py-2.5 text-ink-base">{r.signature}</td>
                  <td className="tnum px-3 py-2.5 text-ink-muted">{r.price}원</td>
                  <td className="tnum px-3 py-2.5 text-ink-muted">{r.hours}</td>
                  <td className="px-3 py-2.5">
                    {r.coupon ? (
                      <span className="rounded-md bg-primary-50 px-2 py-0.5 text-caption font-semibold text-primary-700">{r.coupon}</span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="pr-3 text-right text-ink-faint transition group-hover:text-primary-600">›</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cityRows.length === 0 && (
            <div className="p-8 text-center text-body text-ink-faint">해당 분류의 업소가 없습니다.</div>
          )}
        </div>
      ) : (
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
              {vPage.slice.map((v) => {
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
          {vendorRows.length === 0 && (
            <div className="p-8 text-center text-body text-ink-faint">해당 조건의 업체가 없습니다.</div>
          )}
        </div>
      )}

      {selectedId && !isCity && <VendorDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
      {selectedCity && isCity && (
        <CityDetailModal r={CITY_RESTAURANTS.find((r) => r.name === selectedCity)!} onClose={() => setSelectedCity(null)} />
      )}
    </div>
  )
}
