import { useState } from 'react'
import { findVolunteer, getSampleLogins, authSuperAdmin, SUPER_ADMIN_KEY } from '../../lib/services'
import { useLive } from '../../lib/useLive'
import type { FieldSession } from '../../lib/session'
import { roleLabel } from '../../lib/roleLabel'
import logoW from '../../assets/logo-its-w.png'
import bgHeader from '../../assets/bg-field-header.jpg'

// 신원확인 — 전화번호 + 성명 조회. 백엔드 인증 아님(강릉시·자원봉사센터 명단 조회).
//
// 경로가 둘이다:
//   명단 조회   전번+성명 → findVolunteer → 배치 id 로 세션
//   관리자 키   8자리 키  → authSuperAdmin → 배치 없는 세션(assignmentId: null)
//
// 관리자 경로가 따로 있는 이유: 슈퍼어드민은 인력현황(=Assignment)에 없다. findVolunteer 가
// 배치를 뒤지므로 명단 조회로는 구조적으로 로그인이 불가능하다.
// ⚠️ 하드코딩 키 = 프로토타입. 서버 검증이 아니다.

export default function Identify({ onLogin }: { onLogin: (s: FieldSession) => void }) {
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const samples = useLive(getSampleLogins) ?? []

  const submitAdmin = async () => {
    setBusy(true)
    setError('')
    const ok = await authSuperAdmin(adminKey)
    setBusy(false)
    if (!ok) {
      setError('인증키가 올바르지 않습니다.')
      return
    }
    // 배치가 없는 세션. 신원은 getFieldIdentity(null) 이 상수로 만든다.
    onLogin({ assignmentId: null })
  }

  const submit = async (p: string, n: string) => {
    setBusy(true)
    setError('')
    const a = await findVolunteer(p, n)
    setBusy(false)
    if (!a) {
      setError('명단에서 찾을 수 없습니다. 전화번호와 성명을 확인해 주세요.')
      return
    }
    // 세션엔 '누구인가'만 담는다 — 이름·연락처·역할은 store 에서 파생한다(getFieldIdentity).
    // 굳혀두면 시드가 바뀔 때 어긋나고, 정작 읽는 곳도 없었다.
    onLogin({ assignmentId: a.id })
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
          <div className="mt-1 text-label text-ink-muted">자원봉사자 · 거점관리 · 스태프 신원확인</div>
        </div>
        {!isAdmin && (
          <>
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
          </>
        )}

        {error && <p className="mb-3 rounded-lg bg-critical-soft px-3 py-2 text-label text-critical">{error}</p>}

        <button
          onClick={() => (isAdmin ? submitAdmin() : submit(phone, name))}
          disabled={busy || (isAdmin ? adminKey.length !== 8 : !phone || !name)}
          className="w-full rounded-xl bg-primary-600 py-3.5 text-body font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
        >
          {busy ? '확인 중…' : '로그인'}
        </button>

        {/* 관리자 인증 — 명단에 없는 사람의 경로. 체크하면 전번·성명 대신 8자리 키만 본다. */}
        <div className="mt-4 rounded-xl border border-line bg-page p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={isAdmin}
              onChange={(e) => { setIsAdmin(e.target.checked); setError('') }}
              className="h-4 w-4 accent-primary-600"
            />
            <span className="text-label font-semibold text-ink-strong">관리자</span>
            <span className="text-caption text-ink-muted">인증키로 로그인</span>
          </label>
          {isAdmin && (
            <input
              value={adminKey}
              onChange={(e) => { setAdminKey(e.target.value.replace(/\D/g, '').slice(0, 8)); setError('') }}
              inputMode="numeric"
              maxLength={8}
              placeholder="인증키 8자리"
              className="tnum mt-2.5 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-body tracking-[0.3em] text-ink-strong outline-none transition placeholder:tracking-normal placeholder:text-ink-faint focus:border-primary-400"
            />
          )}
        </div>

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
            <button
              onClick={() => { setIsAdmin(true); setAdminKey(SUPER_ADMIN_KEY); setError('') }}
              className="mb-1.5 flex w-full items-center gap-2 rounded-lg bg-surface px-3 py-2 text-left text-caption shadow-sm transition hover:bg-primary-50"
            >
              <span className="font-semibold text-ink-strong">{roleLabel()}</span>
              <span className="rounded bg-neutral-200 px-1.5 py-0.5 font-semibold text-ink-base">배치 없음</span>
              <span className="text-ink-muted">인증키 채우기</span>
              <span className="tnum ml-auto text-ink-faint">{SUPER_ADMIN_KEY}</span>
            </button>
            <div className="space-y-1.5">
              {samples.map((s) => (
                <button
                  key={s.phone}
                  onClick={() => submit(s.phone, s.name)}
                  className="flex w-full items-center gap-2 rounded-lg bg-surface px-3 py-2 text-left text-caption shadow-sm transition hover:bg-primary-50"
                >
                  <span className="font-semibold text-ink-strong">{s.name}</span>
                  <span className={`rounded px-1.5 py-0.5 font-semibold ${s.role === '거점관리자' ? 'bg-primary-50 text-primary-700' : 'bg-info-soft text-info'}`}>{roleLabel(s.role)}</span>
                  {/* 거점관리자는 전일 상주라 조가 없다 — shift 는 스키마 채움값이므로 표시하지 않는다. */}
                  <span className="text-ink-muted">{s.role === '거점관리자' ? '전일' : s.shift === 'AM' ? '오전' : '오후'} · {s.zoneName}</span>
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
