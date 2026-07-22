import { useState } from 'react'
import { Link } from 'react-router-dom'
import VisitorPage from './VisitorPage'
import Thumb from './Thumb'
import { COUPONS } from '../../../lib/visitorContent'
import {
  formatPhone,
  isValidPhone,
  loadPhone,
  savePhone,
  clearWallet,
  loadIssued,
  issueCoupon,
  type IssuedCoupon,
} from '../../../lib/visitorWallet'
import { loadSavedPhotos, type SavedPhoto } from '../../../lib/photozone'

// 마이페이지 — 무PII 핸드폰 신원(무산 개념) + 쿠폰 발급(무산 coupons 개념).
// 미로그인 = 전화번호 입력 게이트 · 로그인 = 발급 가능 쿠폰 + 내 쿠폰북.
// 내 사진(포토존)은 게이트 밖 — 무인증이라 로그인 여부와 무관하게 보인다.
export default function My() {
  const [phone, setPhone] = useState<string | null>(loadPhone())
  const [input, setInput] = useState('')
  const [issued, setIssued] = useState<IssuedCoupon[]>(loadIssued())
  const [photos] = useState<SavedPhoto[]>(loadSavedPhotos())

  // 내 사진 — 포토존에서 받아 담은 사진. 탭하면 원본 저장.
  const photoSection = (
    <section>
      <h2 className="mb-2 text-label font-bold text-ink-muted">내 사진</h2>
      {photos.length === 0 ? (
        <Link
          to="/v/photo"
          className="block rounded-xl border border-dashed border-line bg-page py-10 text-center text-caption text-ink-faint"
        >
          포토존에서 받은 사진이 없습니다 ›
        </Link>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <a
              key={p.id}
              href={p.src}
              download={`its-photozone-${p.id}.jpg`}
              className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"
            >
              <img src={p.src} alt="내 사진" className="aspect-square w-full object-cover" />
            </a>
          ))}
        </div>
      )}
    </section>
  )

  // ── 미로그인: 전화번호 게이트 ──
  if (!phone) {
    const ok = isValidPhone(input)
    return (
      <VisitorPage title="마이페이지">
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <div className="mb-1 text-label font-semibold text-ink-strong">전화번호</div>
            <input
              value={input}
              onChange={(e) => setInput(formatPhone(e.target.value))}
              inputMode="numeric"
              placeholder="010-0000-0000"
              className="tnum w-full rounded-xl border border-line bg-page px-4 py-3 text-label text-ink-strong outline-none focus:border-primary-500"
            />
            <button
              disabled={!ok}
              onClick={() => {
                savePhone(input)
                setPhone(input)
              }}
              className={`mt-3 w-full rounded-xl py-3 text-label font-semibold transition ${
                ok ? 'bg-primary-600 text-white active:scale-[0.99]' : 'bg-neutral-200 text-ink-faint'
              }`}
            >
              쿠폰북 열기
            </button>
          </div>
          <p className="px-1 text-caption text-ink-faint">전화번호는 쿠폰 발급·조회에만 쓰이며 브라우저에만 저장됩니다.</p>
          {/* 내 사진 = 무인증 — 로그인 전에도 보인다 */}
          {photos.length > 0 && photoSection}
        </div>
      </VisitorPage>
    )
  }

  // ── 로그인: 쿠폰 발급 + 쿠폰북 ──
  const available = COUPONS.filter((c) => !issued.some((i) => i.store === c.store))

  return (
    <VisitorPage title="마이페이지">
      <div className="space-y-5">
        {/* 신원 */}
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 shadow-sm">
          <span className="tnum text-label font-semibold text-ink-strong">{phone}</span>
          <button
            onClick={() => {
              clearWallet()
              setPhone(null)
              setIssued([])
              setInput('')
            }}
            className="text-caption font-semibold text-ink-faint"
          >
            로그아웃
          </button>
        </div>

        {/* 내 사진 — 포토존 수신함(무인증) */}
        {photoSection}

        {/* 발급 가능 쿠폰 */}
        {available.length > 0 && (
          <section>
            <h2 className="mb-2 text-label font-bold text-ink-muted">발급 가능 쿠폰</h2>
            <div className="space-y-2">
              {available.map((c) => (
                <div key={c.store} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm">
                  <Thumb className="h-14 w-14 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-semibold text-ink-strong">{c.store}</span>
                    <span className="block truncate text-caption text-primary-700">{c.benefit}</span>
                  </span>
                  <button
                    onClick={() => setIssued(issueCoupon(c.store, c.benefit))}
                    className="shrink-0 rounded-lg bg-primary-600 px-3 py-2 text-caption font-semibold text-white transition active:scale-[0.97]"
                  >
                    발급받기
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 내 쿠폰북 */}
        <section>
          <h2 className="mb-2 text-label font-bold text-ink-muted">내 쿠폰</h2>
          {issued.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-page py-10 text-center text-caption text-ink-faint">
              발급받은 쿠폰이 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {issued.map((c) => (
                <div key={c.code} className="flex overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
                  <Thumb className="w-16 shrink-0" />
                  <div className="flex flex-1 flex-col justify-center p-4">
                    <span className="text-label font-semibold text-ink-strong">{c.store}</span>
                    <span className="mt-0.5 text-caption text-primary-700">{c.benefit}</span>
                    <span className="tnum mt-1 text-caption font-bold tracking-wider text-ink-muted">{c.code}</span>
                  </div>
                  <div className="grid w-20 shrink-0 place-items-center border-l border-dashed border-line bg-primary-50 text-center">
                    <span className="text-caption font-bold text-primary-700">현장<br />제시</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </VisitorPage>
  )
}
