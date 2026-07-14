import { useState } from 'react'
import { loadSession, saveSession, clearSession } from '../../lib/session'
import type { FieldSession } from '../../lib/session'
import Identify from './Identify'
import VolunteerHome from './VolunteerHome'
import ManagerHome from './ManagerHome'

// 현장 모바일 PWA 루트 — 세션 게이트 + 역할 분기(봉사자 / 거점관리자).
// 세션 없으면 신원확인, 있으면 역할별 홈. (SPEC §2 · 핸드오프 §3)

export default function FieldLayout() {
  const [session, setSession] = useState<FieldSession | null>(() => loadSession())

  const onLogin = (s: FieldSession) => {
    saveSession(s)
    setSession(s)
  }
  const onLogout = () => {
    clearSession()
    setSession(null)
  }

  const isManager = session?.role === '거점관리자' || session?.role === '운영인력'

  return (
    // 좌측 페인 방식(레퍼런스 참조) — 모바일 풀폭 단일컬럼 / 데스크탑 고정폭 페인. 상한 460.
    <div className="flex min-h-[100dvh] w-full justify-center bg-page">
      <div className="relative flex h-[100dvh] w-full max-w-[460px] flex-col overflow-hidden bg-surface shadow-[0_0_40px_-16px_rgba(0,0,0,0.2)]">
        {!session ? (
          <Identify onLogin={onLogin} />
        ) : isManager ? (
          <ManagerHome session={session} onLogout={onLogout} />
        ) : (
          <VolunteerHome session={session} onLogout={onLogout} />
        )}
      </div>
    </div>
  )
}
