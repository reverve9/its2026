import { useState } from 'react'
import { authConsole, DEV_ACCOUNTS } from '../../lib/consoleAuth'
import type { ConsoleSession } from '../../lib/consoleAuth'
import bgSidebar from '../../assets/bg-sidebar.jpg'
import logoW from '../../assets/logo-its-w.png'

// 운영본부 콘솔 로그인. 하드코딩 계정(consoleAuth) — 백엔드 인증이 아니다.
// 등급이 사이드바를 가른다: superAdmin 전체 / client 는 '운영' 묶음 제외.

export default function ConsoleLogin({ onLogin }: { onLogin: (s: ConsoleSession) => void }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')

  const submit = (uid: string, upw: string) => {
    const s = authConsole(uid, upw)
    if (!s) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      return
    }
    onLogin(s)
  }

  return (
    <div className="relative grid h-full place-items-center">
      <div aria-hidden className="absolute inset-0 -z-10 bg-primary-900 bg-cover bg-center" style={{ backgroundImage: `url(${bgSidebar})` }} />

      <div className="w-[380px] rounded-2xl bg-surface p-7 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.5)]">
        <img src={logoW} alt="강릉 ITS 세계총회 2026" className="h-12 w-auto brightness-0" />
        <div className="mt-3 font-title text-title font-semibold leading-tight text-ink-strong">통합운영 플랫폼</div>
        <div className="mt-0.5 text-label text-ink-muted">운영본부 콘솔</div>

        <label className="mb-1.5 mt-6 block text-label font-semibold text-ink-strong">아이디</label>
        <input
          value={id}
          onChange={(e) => { setId(e.target.value); setError('') }}
          autoComplete="username"
          className="w-full rounded-xl border border-line bg-page px-4 py-3 text-body text-ink-strong outline-none transition focus:border-primary-400"
        />
        <label className="mb-1.5 mt-4 block text-label font-semibold text-ink-strong">비밀번호</label>
        <input
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(id, pw) }}
          type="password"
          autoComplete="current-password"
          className="w-full rounded-xl border border-line bg-page px-4 py-3 text-body text-ink-strong outline-none transition focus:border-primary-400"
        />

        {error && <p className="mt-3 rounded-lg bg-critical-soft px-3 py-2 text-label text-critical">{error}</p>}

        <button
          onClick={() => submit(id, pw)}
          disabled={!id || !pw}
          className="mt-5 w-full rounded-xl bg-primary-600 py-3.5 text-body font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
        >
          로그인
        </button>

        {/* 계정은 하드코딩이 방침이라 숨길 이유가 없다(consoleAuth 주석). */}
        <div className="mt-6 rounded-xl border border-dashed border-line bg-neutral-50 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">DEV</span>
            <span className="text-caption font-semibold text-ink-muted">계정 (탭하면 자동 로그인)</span>
          </div>
          <div className="space-y-1.5">
            {DEV_ACCOUNTS.map((a) => (
              <button
                key={a.id}
                onClick={() => submit(a.id, a.pw)}
                className="flex w-full items-center gap-2 rounded-lg bg-surface px-3 py-2 text-left text-caption shadow-sm transition hover:bg-primary-50"
              >
                <span className="font-semibold text-ink-strong">{a.label}</span>
                <span className="tnum ml-auto text-ink-faint">{a.id} / {a.pw}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
