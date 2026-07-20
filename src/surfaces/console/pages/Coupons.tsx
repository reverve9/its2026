import { useState } from 'react'
import { PageHeader, Section } from '../../../components/layout'
import { useLiveVersion } from '../../../lib/useLive'
import { CITY_RESTAURANTS, setRestaurantCoupon } from '../../../lib/visitorContent'

// 쿠폰 관리(정산 갈래) — 방문객 쿠폰북 발행 등록·조회. CMS 없음(D54)이라 실 편집은 코드지만,
// 운영본부가 도심 맛집에 자율 혜택(쿠폰)을 발행하는 개념을 보인다. 등록은 in-memory·리로드 시 시드 복귀.
// §2-3: 자율 혜택형(할인·음료·사은품 표시만) · 정산형 쿠폰 없음 → 정산 산출과 무관, 발행 현황만.
// 원본 = 도심 맛집(CityRestaurant.coupon) — 쿠폰 있는 업소만 쿠폰북에 실린다.

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-label outline-none focus:border-primary-600'

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-label font-medium text-ink-muted">{label}</div>
      <div className="tnum mt-1 text-title font-bold text-ink-strong">{value}</div>
      <div className="mt-0.5 text-caption text-ink-faint">{sub}</div>
    </div>
  )
}

export default function Coupons() {
  useLiveVersion() // 발행 시 목록 재조회

  const [store, setStore] = useState('')
  const [benefit, setBenefit] = useState('')

  const couponStores = CITY_RESTAURANTS.filter((r) => r.coupon)
  const noCoupon = CITY_RESTAURANTS.filter((r) => !r.coupon) // 발행 대상 후보

  const canPost = store !== '' && benefit.trim() !== ''

  const submit = () => {
    if (!canPost) return
    setRestaurantCoupon(store, benefit.trim())
    setStore(''); setBenefit('')
  }

  return (
    <div>
      <PageHeader title="쿠폰 관리" summary="방문객 쿠폰북 발행 등록 — 자율 혜택형(표시만) · 정산형 없음" />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="발행 쿠폰" value={`${couponStores.length}개소`} sub={`도심 맛집 ${CITY_RESTAURANTS.length}개소 중`} />
        <Stat label="혜택 유형" value="자율 혜택형" sub="할인 · 음료 · 사은품" />
        <Stat label="정산형 쿠폰" value="0건" sub="정산 산출과 무관(§2-3)" />
      </div>

      <div className="grid grid-cols-[minmax(0,22rem)_1fr] items-start gap-5">
        {/* 발행 */}
        <Section title="쿠폰 발행">
          <div className="space-y-2">
            <div>
              <span className="text-caption font-semibold text-ink-muted">업소</span>
              <select value={store} onChange={(e) => setStore(e.target.value)} className={`mt-1 ${inputCls}`}>
                <option value="">업소 선택</option>
                {noCoupon.map((r) => (
                  <option key={r.name} value={r.name}>{r.category} · {r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-caption font-semibold text-ink-muted">혜택</span>
              <input value={benefit} onChange={(e) => setBenefit(e.target.value)} placeholder="10% 할인 / 음료 제공 / 사은품" className={`mt-1 ${inputCls}`} />
            </div>
            <p className="text-caption text-ink-faint">행사 기간 · 1회 · 현장 제시</p>
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className="rounded-lg bg-primary-600 px-5 py-2 text-label font-bold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              발행
            </button>
          </div>
        </Section>

        {/* 발행 현황 */}
        <Section title="발행 쿠폰" bodyClassName="p-0" right={<span className="tnum text-caption text-ink-muted">{couponStores.length}개소</span>}>
          <table className="w-full text-label">
            <thead>
              <tr className="border-b border-line bg-neutral-50 text-caption text-ink-muted">
                <th className="px-4 py-2.5 text-left font-semibold">분류</th>
                <th className="px-4 py-2.5 text-left font-semibold">업소</th>
                <th className="px-4 py-2.5 text-left font-semibold">위치</th>
                <th className="px-4 py-2.5 text-left font-semibold">혜택</th>
                <th className="px-4 py-2.5 text-left font-semibold">조건</th>
              </tr>
            </thead>
            <tbody>
              {couponStores.map((r) => (
                <tr key={r.name} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5">
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-base">{r.category}</span>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-ink-strong">{r.name}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{r.area}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-md bg-primary-50 px-2 py-0.5 text-caption font-semibold text-primary-700">{r.coupon}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">행사 기간 · 1회 · 현장 제시</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  )
}
