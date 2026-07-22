import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QrCode } from '../../../components/QrCode'
import {
  GALLERY,
  DEMO_UPLOAD_SRC,
  shareCode,
  shareUrl,
  loadSavedPhotos,
  savePhoto,
  type GalleryPhoto,
  type SavedPhoto,
} from '../../../lib/photozone'

// 포토존 단체사진 공유 — 진입은 행사안내/홈 배너(서브라우트, 새 탭 아님).
// 3상태: gallery(랜딩+갤러리) → qr(원탭 발행) · detail(받기·저장).
// 원탭 발행 — 사진을 고르면 확인 화면 없이 곧장 QR. '올리면 QR이 나온다'는 인과를
// 랜딩 3단계 안내(촬영→올리기→QR)로 미리 드러내 직관성을 확보한다.
// 로그인 없음 — 전 과정 무인증. 구역 분류 없음.

type View =
  | { kind: 'gallery' }
  | { kind: 'qr'; src: string; code: string }
  | { kind: 'detail'; photo: GalleryPhoto }

const STEPS = [
  { n: '1', label: '촬영' },
  { n: '2', label: '올리기' },
  { n: '3', label: 'QR 공유' },
]

export default function Photo() {
  const [view, setView] = useState<View>({ kind: 'gallery' })
  const [saved, setSaved] = useState<SavedPhoto[]>(loadSavedPhotos())
  const fileRef = useRef<HTMLInputElement>(null)

  // 사진 선택 = 즉시 QR 발행(원탭)
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      setView({ kind: 'qr', src, code: shareCode(src.slice(0, 48)) })
    }
    reader.readAsDataURL(f)
  }
  const fileInput = <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPick} />

  // ── QR 발행 ──────────────────────────────────────────────
  // 셸(main)이 고정높이 스크롤 컨테이너라 100dvh 대신 min-h-full — 캡쳐 915px·라이브 공통
  if (view.kind === 'qr') {
    return (
      <div className="flex min-h-full flex-col bg-ink-strong p-6 text-white">
        {fileInput}
        <button
          onClick={() => setView({ kind: 'gallery' })}
          className="self-start text-caption font-semibold text-white/70"
        >
          ‹ 닫기
        </button>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <img
            src={view.src}
            alt="공유 단체사진"
            className="h-24 w-32 rounded-xl object-cover ring-2 ring-white/30"
          />
          <div className="mt-6 rounded-3xl bg-white p-5 shadow-2xl">
            <QrCode value={shareUrl(view.code)} size={220} />
          </div>
          <p className="tnum mt-4 text-title font-bold tracking-widest">{view.code}</p>
          <h2 className="mt-4 text-label font-bold leading-snug">
            함께 찍은 분들께 이 QR을 보여주세요
          </h2>
          <p className="mt-1 text-caption text-white/70">
            앱에서 스캔하면 사진이 바로 열리고 저장할 수 있어요
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-caption text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400" /> 포토존 갤러리에도 올라갔어요
          </p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-white/25 py-3.5 text-label font-semibold text-white/90 transition active:scale-[0.99]"
          >
            다른 사진 선택
          </button>
          <button
            onClick={() => setView({ kind: 'gallery' })}
            className="rounded-xl bg-white py-3.5 text-label font-semibold text-ink-strong transition active:scale-[0.99]"
          >
            완료
          </button>
        </div>
      </div>
    )
  }

  // ── 사진 상세(받기·저장) ──────────────────────────────────
  if (view.kind === 'detail') {
    const p = view.photo
    const isSaved = saved.some((s) => s.id === p.id)
    return (
      <div className="p-4">
        <button
          onClick={() => setView({ kind: 'gallery' })}
          className="mb-2 text-caption font-semibold text-ink-muted"
        >
          ‹ 갤러리
        </button>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          <img src={p.src} alt="단체사진" className="aspect-[4/3] w-full object-cover" />
        </div>
        <div className="mt-3 text-caption text-ink-muted">
          {p.by} · {p.ago}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a
            href={p.src}
            download={`its-photozone-${p.id}.jpg`}
            className="rounded-xl border border-line bg-surface py-3.5 text-center text-label font-semibold text-ink-strong shadow-sm transition active:scale-[0.99]"
          >
            사진 저장
          </a>
          <button
            disabled={isSaved}
            onClick={() => setSaved(savePhoto({ id: p.id, src: p.src }))}
            className={`rounded-xl py-3.5 text-label font-semibold transition active:scale-[0.99] ${
              isSaved ? 'bg-primary-50 text-primary-700' : 'bg-primary-600 text-white'
            }`}
          >
            {isSaved ? '내 사진에 담김 ✓' : '내 사진에 담기'}
          </button>
        </div>
        <Link
          to="/v/my"
          className="mt-2 block rounded-xl py-3 text-center text-label font-semibold text-ink-muted"
        >
          마이 · 내 사진 보기 ›
        </Link>

        {/* 같은 포토존 사진 — 계속 둘러보게 */}
        <section className="mt-5">
          <h2 className="mb-2 text-label font-bold text-ink-muted">같은 포토존 사진</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {GALLERY.filter((g) => g.id !== p.id).map((g) => (
              <button
                key={g.id}
                onClick={() => setView({ kind: 'detail', photo: g })}
                className="shrink-0 overflow-hidden rounded-xl border border-line bg-surface shadow-sm"
              >
                <img src={g.src} alt="포토존 단체사진" className="h-24 w-24 object-cover" />
              </button>
            ))}
          </div>
        </section>
      </div>
    )
  }

  // ── 갤러리(기본) ──────────────────────────────────────────
  return (
    <div className="p-4">
      {fileInput}
      <h1 className="mb-3 text-title font-title font-semibold text-ink-strong">포토존</h1>

      {/* 소개 + 3단계 안내 + 올리기 CTA — 로그인 없이 바로 */}
      <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-label font-bold text-ink-strong">단체사진, QR로 바로 나눠요</h2>

        {/* 3단계 — '올리면 QR이 나온다'는 인과를 누르기 전에 보여준다 */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-page px-2 py-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center">
              <div className="flex flex-1 flex-col items-center gap-1">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-primary-600 text-caption font-bold text-white">
                  {s.n}
                </span>
                <span className="text-caption font-semibold text-ink-strong">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <span className="px-1 text-ink-faint">›</span>}
            </div>
          ))}
        </div>

        <button
          onClick={() => fileRef.current?.click()}
          className="mt-3 w-full rounded-xl bg-primary-600 py-3.5 text-label font-semibold text-white transition active:scale-[0.99]"
        >
          사진 올리고 QR 받기
        </button>
        <button
          onClick={() =>
            setView({
              kind: 'qr',
              src: DEMO_UPLOAD_SRC,
              code: shareCode(DEMO_UPLOAD_SRC.slice(0, 48)),
            })
          }
          className="mt-2 w-full text-center text-caption font-semibold text-ink-faint"
        >
          샘플 사진으로 체험하기
        </button>
      </section>

      {/* 시간순 갤러리 */}
      <section className="mt-5">
        <h2 className="mb-2 text-label font-bold text-ink-muted">방금 올라온 사진</h2>
        <div className="grid grid-cols-2 gap-2">
          {GALLERY.map((p) => (
            <button
              key={p.id}
              onClick={() => setView({ kind: 'detail', photo: p })}
              className="group relative overflow-hidden rounded-xl border border-line bg-surface shadow-sm"
            >
              <img
                src={p.src}
                alt="포토존 단체사진"
                className="aspect-square w-full object-cover transition group-active:scale-[0.98]"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-strong/80 to-transparent px-2.5 py-1.5 text-left">
                <span className="block text-[10px] text-white/85">{p.ago}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-caption text-ink-faint">
          QR을 놓쳤어도 여기서 우리 사진을 찾을 수 있어요
        </p>
      </section>
    </div>
  )
}
