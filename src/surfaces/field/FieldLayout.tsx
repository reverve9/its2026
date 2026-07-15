import { useState } from 'react'
import { loadSession, saveSession, clearSession } from '../../lib/session'
import type { FieldSession } from '../../lib/session'
import { getFieldIdentity } from '../../lib/services'
import { useLive } from '../../lib/useLive'
import { useCapture } from '../../lib/capture'
import Identify from './Identify'
import { SafetyBanner } from './SafetyBanner'
import VolunteerHome from './VolunteerHome'
import OpsHome from './OpsHome'

// 현장 모바일 PWA 루트 — 세션 게이트 + 구분(kind) 분기.
//
// 분기는 kind 다: 자원봉사자 / 운영인력(거점관리자 + 현장인력). role 이 아니다.
// 이전 모델은 `isManager = session.role === '거점관리자'` 였고 나머지가 전부 else 로 흘러
// VolunteerHome 을 받았다 — 역할은 셋(봉사자·거점관리자·현장운영)인데 분기가 둘이라
// 현장운영 11명이 거점도 없이 봉사자 화면(거점 안내·정시체크·QR)을 받고 있었다.
// 주석은 "현장운영은 현장앱 대상이 아니다"라고 배제를 선언했지만 코드는 배제하지 않았다.
// → kind 로 가르면 else 폴백이 사라지고, 새 역할이 생겨도 봉사자 화면으로 새지 않는다.
//
// 신원은 세션이 아니라 store 에서 파생한다(getFieldIdentity) — 세션에 굳힌 role 은
// 시드가 바뀔 때마다 어긋났다(핸드오프 §4).

export default function FieldLayout() {
  const [session, setSession] = useState<FieldSession | null>(() => loadSession())
  const me = useLive(
    () => (session ? getFieldIdentity(session.assignmentId) : Promise.resolve(undefined)),
    [session?.assignmentId]
  )

  const onLogin = (s: FieldSession) => {
    saveSession(s)
    setSession(s)
  }
  const onLogout = () => {
    clearSession()
    setSession(null)
  }

  const capture = useCapture()

  // 세션은 있는데 신원이 안 잡히면(시드 교체로 배치가 사라진 경우) 로그인으로 되돌린다.
  // 이전엔 이 상황에서 굳은 role 로 화면을 그려 실제와 어긋난 채 동작했다.
  const stale = session && me === undefined

  return (
    // 좌측 페인 방식(레퍼런스 참조) — 모바일 풀폭 단일컬럼 / 데스크탑 고정폭 페인. 상한 460.
    // 캡쳐 모드: 정확히 412×915 아트보드로 고정(내부 스크롤 유지 = 단일 화면 샷).
    <div className={`flex w-full justify-center bg-page ${capture ? 'min-h-[915px]' : 'min-h-[100dvh]'}`}>
      <div
        className={`relative flex flex-col overflow-hidden bg-surface shadow-[0_0_40px_-16px_rgba(0,0,0,0.2)] ${
          capture ? 'h-[915px] w-[412px]' : 'h-[100dvh] w-full max-w-[460px]'
        }`}
      >
        {/* 운영중단 전파 — 역할 분기보다 위. 봉사자·관리자·신원확인 전부에 뜬다.
            로그인 전에도 띄운다: 지금 막 앱을 여는 사람이 가장 먼저 알아야 할 상태다. */}
        <SafetyBanner assignmentId={session?.assignmentId} />

        {!session || stale ? (
          <Identify onLogin={onLogin} />
        ) : !me ? (
          <div className="grid h-full place-items-center text-label text-ink-muted">불러오는 중…</div>
        ) : me.kind === '자원봉사자' ? (
          <VolunteerHome session={session} onLogout={onLogout} />
        ) : (
          <OpsHome session={session} onLogout={onLogout} />
        )}
      </div>
    </div>
  )
}
