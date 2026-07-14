import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

// 봉사자 QR 코드 렌더 — 유인 거점에서 거점관리자가 스캔할 코드(= 배치 id).
export function QrCode({ value, size = 176 }: { value: string; size?: number }) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: '#1f2a2e', light: '#ffffff' } })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(''))
    return () => {
      alive = false
    }
  }, [value, size])

  if (!url) return <div className="grid place-items-center rounded-lg bg-neutral-100 text-caption text-ink-faint" style={{ width: size, height: size }}>QR</div>
  return <img src={url} width={size} height={size} alt={`QR ${value}`} className="rounded-lg" />
}
