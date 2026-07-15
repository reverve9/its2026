import { useState } from 'react'
import { loadSession, saveSession, clearSession } from '../../lib/session'
import type { FieldSession } from '../../lib/session'
import { useCapture } from '../../lib/capture'
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

  // 스캔·순회 화면은 거점관리자 몫. 현장운영(본부 상주)은 거점 배치가 없어 현장앱 대상이 아니다.
  const isManager = session?.role === '거점관리자'
  const capture = useCapture()

  return (
    // 좌측 페인 방식(레퍼런스 참조) — 모바일 풀폭 단일컬럼 / 데스크탑 고정폭 페인. 상한 460.
    // 캡쳐 모드: 정확히 412×915 아트보드로 고정(내부 스크롤 유지 = 단일 화면 샷).
    <div className={`flex w-full justify-center bg-page ${capture ? 'min-h-[915px]' : 'min-h-[100dvh]'}`}>
      <div
        className={`relative flex flex-col overflow-hidden bg-surface shadow-[0_0_40px_-16px_rgba(0,0,0,0.2)] ${
          capture ? 'h-[915px] w-[412px]' : 'h-[100dvh] w-full max-w-[460px]'
        }`}
      >
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
