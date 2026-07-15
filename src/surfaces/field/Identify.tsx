import { useState } from 'react'
import { findVolunteer, getSampleLogins } from '../../lib/services'
import { useLive } from '../../lib/useLive'
import type { FieldSession } from '../../lib/session'
import logoW from '../../assets/logo-its-w.png'
import bgHeader from '../../assets/bg-field-header.jpg'

// 신원확인 — 전화번호 + 성명 조회. 백엔드 인증 아님(강릉시·자원봉사센터 명단 조회).
// dev quick-pick 로 실제 눌러보기 가능.

export default function Identify({ onLogin }: { onLogin: (s: FieldSession) => void }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const samples = useLive(getSampleLogins) ?? []

  const submit = async (p: string, n: string) => {
    setBusy(true)
    setError('')
    const a = await findVolunteer(p, n)
    setBusy(false)
    if (!a) {
      setError('명단에서 찾을 수 없습니다. 전화번호와 성명을 확인해 주세요.')
      return
    }
    onLogin({ assignmentId: a.id, name: a.personName, phone: a.phone, role: a.role })
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <header
        className="flex items-center bg-primary-900 bg-cover bg-center px-5 pb-4 pt-6"
        style={{ backgroundImage: `url(${bgHeader})` }}
      >
        <img src={logoW} alt="강릉 ITS 세계총회 2026" className="h-14 w-auto" />
      </header>

      {/* 폼 */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mb-6">
          <div className="font-title text-title font-semibold leading-tight text-ink-strong">부대행사 현장앱</div>
          <div className="mt-1 text-label text-ink-muted">자원봉사자 · 거점관리자 신원확인</div>
        </div>
        <label className="mb-1.5 block text-label font-semibold text-ink-strong">전화번호</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="010-0000-0000"
          className="mb-4 w-full rounded-xl border border-line bg-page px-4 py-3 text-body text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-primary-400"
        />
        <label className="mb-1.5 block text-label font-semibold text-ink-strong">성명</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="홍길동"
          className="mb-4 w-full rounded-xl border border-line bg-page px-4 py-3 text-body text-ink-strong outline-none transition placeholder:text-ink-faint focus:border-primary-400"
        />

        {error && <p className="mb-3 rounded-lg bg-critical-soft px-3 py-2 text-label text-critical">{error}</p>}

        <button
          onClick={() => submit(phone, name)}
          disabled={busy || !phone || !name}
          className="w-full rounded-xl bg-primary-600 py-3.5 text-body font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
        >
          {busy ? '확인 중…' : '근무 시작'}
        </button>

        <p className="mt-4 text-caption leading-relaxed text-ink-faint">
          개인정보 최소수집(성명·연락처) · 위치정보는 근무 확인 목적에만 사용 · 행사 후 즉시 파기
        </p>

        {/* dev quick-pick */}
        {samples.length > 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-line bg-neutral-50 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">DEV</span>
              <span className="text-caption font-semibold text-ink-muted">샘플 계정 (탭하면 자동 로그인)</span>
            </div>
            <div className="space-y-1.5">
              {samples.map((s) => (
                <button
                  key={s.phone}
                  onClick={() => submit(s.phone, s.name)}
                  className="flex w-full items-center gap-2 rounded-lg bg-surface px-3 py-2 text-left text-caption shadow-sm transition hover:bg-primary-50"
                >
                  <span className="font-semibold text-ink-strong">{s.name}</span>
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${s.role === '거점관리자' ? 'bg-primary-50 text-primary-700' : 'bg-info-soft text-info'}`}>{s.role}</span>
                  <span className="text-ink-muted">{s.shift === 'AM' ? '오전' : '오후'} · {s.zoneName}</span>
                  <span className="tnum ml-auto text-ink-faint">{s.phone}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
