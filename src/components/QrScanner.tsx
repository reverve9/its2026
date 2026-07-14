import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

// 거점관리자 QR 카메라 스캔 — 실카메라(getUserMedia) 로 봉사자 QR 디코드.
// ⚠️ 카메라는 HTTPS(또는 localhost)에서만 열린다. 폰 테스트 시 https 필요.

export default function QrScanner({ onDecode, onClose }: { onDecode: (text: string) => void; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cbRef = useRef(onDecode)
  cbRef.current = onDecode
  const [err, setErr] = useState('')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const id = 'qr-reader-region'
    el.id = id
    const scanner = new Html5Qrcode(id)
    let stopped = false

    const stop = () => {
      if (stopped) return
      stopped = true
      scanner.stop().then(() => scanner.clear()).catch(() => {})
    }

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          stop()
          cbRef.current(decoded)
        },
        () => {} // 프레임별 미검출 — 무시
      )
      .catch(() => setErr('카메라를 열 수 없습니다. 권한 허용·HTTPS 접속을 확인해 주세요.'))

    return stop
  }, [])

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink-strong/95">
      <div className="flex items-center justify-between px-5 pb-3 pt-8 text-white">
        <span className="font-title text-body font-semibold">봉사자 QR 스캔</span>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white/90 transition hover:bg-white/20" aria-label="닫기">✕</button>
      </div>
      <div className="grid flex-1 place-items-center px-5">
        <div className="w-full max-w-[320px]">
          <div ref={containerRef} className="overflow-hidden rounded-2xl bg-black" />
          {err ? (
            <p className="mt-4 rounded-lg bg-critical-soft px-3 py-2 text-label text-critical">{err}</p>
          ) : (
            <p className="mt-4 text-center text-label text-white/70">봉사자의 QR을 사각형 안에 맞춰 주세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
