import { useState } from 'react'
import VisitorPage from './VisitorPage'
import Thumb from './Thumb'
import { CITY_RESTAURANTS, RESTAURANT_CATEGORIES } from '../../../lib/visitorContent'

// 맛집 — 음식점 지도(§2-3 명문). 도심·관광지 음식점, 행사장 FoodVendor 와 별개(D55).
// 카테고리 칩 필터(소개로 개념) · 쿠폰 = 자율 혜택형·표시만(발급은 마이페이지).
export default function Food() {
  const [cat, setCat] = useState('전체')
  const list = cat === '전체' ? CITY_RESTAURANTS : CITY_RESTAURANTS.filter((r) => r.category === cat)

  return (
    <VisitorPage title="맛집">
      <div className="space-y-3">
        {/* 카테고리 칩(소개로 개념) */}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {RESTAURANT_CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-semibold transition ${
                cat === c ? 'bg-primary-600 text-white' : 'border border-line bg-surface text-ink-muted'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {list.map((r) => (
            <div key={r.name} className="flex gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm">
              <Thumb className="h-20 w-20 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-label font-semibold text-ink-strong">{r.name}</span>
                  <span className="shrink-0 text-caption text-ink-faint">{r.category}</span>
                </div>
                <div className="mt-0.5 truncate text-caption text-ink-muted">{r.area} · {r.signature}</div>
                <div className="tnum mt-0.5 text-caption text-ink-faint">{r.price}원 · {r.hours}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.coupon && (
                    <span className="rounded-md bg-primary-50 px-2 py-0.5 text-caption font-semibold text-primary-700">쿠폰 · {r.coupon}</span>
                  )}
                  {r.foreignMenu && (
                    <span className="rounded-md border border-line px-2 py-0.5 text-caption font-semibold text-ink-muted">외국어 메뉴</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </VisitorPage>
  )
}
