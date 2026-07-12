import { useState } from 'react'

// 현장 모바일 PWA — 로그인 후 역할 분기(봉사자 / 거점관리자).
// 공용(거점·이슈·공지)은 공유, 역할별 홈·탭만 분리. (SPEC §2)
// Phase 1: 역할 토글 + 탭 셸(제작 예정 바디). Phase 3에서 실제 화면.

type Role = 'volunteer' | 'manager'
type Tab = { key: string; label: string; note: string }

const TABS: Record<Role, Tab[]> = {
  volunteer: [
    { key: 'home', label: '홈', note: '오늘 내 근무(거점·시간·역할) + 체크인' },
    { key: 'checkin', label: '체크인', note: '유인=내 QR 제시 / 무인=GPS 원버튼' },
    { key: 'guide', label: '안내', note: '거점 매뉴얼·비상연락망·셔틀/관광 안내(방문객 응대)' },
    { key: 'notice', label: '공지', note: '운영본부 공지 수신' },
    { key: 'me', label: '내 활동', note: '누적 활동시간 · 봉사확인' },
  ],
  manager: [
    { key: 'status', label: '현황', note: '내 거점 출결·근무공백' },
    { key: 'scan', label: '스캔', note: '봉사자 출결 스캔(유인, 웹 카메라 QR)' },
    { key: 'patrol', label: '순회', note: '무인 거점 랜덤 대조 감사' },
    { key: 'issue', label: '이슈', note: '민원·시설·안전·분실물 보고' },
  ],
}

const ROLE_LABEL: Record<Role, string> = { volunteer: '봉사자', manager: '거점관리자' }

export default function FieldLayout() {
  const [role, setRole] = useState<Role>('volunteer')
  const [tabKey, setTabKey] = useState('home')
  const tabs = TABS[role]
  const active = tabs.find((t) => t.key === tabKey) ?? tabs[0]

  const switchRole = (r: Role) => {
    setRole(r)
    setTabKey(TABS[r][0].key)
  }

  return (
    <div className="grid min-h-full place-items-center bg-page p-4">
      {/* 모바일 프레임 */}
      <div className="flex h-[720px] w-[380px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
        {/* 역할 토글 (dev aid) */}
        <div className="flex gap-1 border-b border-line bg-neutral-50 p-1.5">
          {(['volunteer', 'manager'] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => switchRole(r)}
              className={`flex-1 rounded-lg py-1.5 text-label font-semibold transition ${
                role === r ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-neutral-100'
              }`}
            >
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>

        {/* 헤더 */}
        <header className="bg-primary-700 px-4 py-3 text-white">
          <div className="font-latin text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-200/70">
            ITS 2026 · Field
          </div>
          <div className="mt-0.5 font-title text-section font-medium">
            {ROLE_LABEL[role]} · {active.label}
          </div>
        </header>

        {/* 바디 (제작 예정) */}
        <main className="flex-1 overflow-auto p-4">
          <div className="grid h-full place-items-center">
            <div className="text-center">
              <div className="font-title text-title font-medium text-ink-strong">{active.label}</div>
              <p className="mx-auto mt-2 max-w-[220px] text-body text-ink-muted">{active.note}</p>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-caption font-medium text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
                제작 예정
              </div>
            </div>
          </div>
        </main>

        {/* 바텀 탭 */}
        <nav className="flex border-t border-line bg-surface">
          {tabs.map((t) => {
            const on = t.key === active.key
            return (
              <button
                key={t.key}
                onClick={() => setTabKey(t.key)}
                className={`flex-1 py-2.5 text-caption font-medium transition ${
                  on ? 'text-primary-600' : 'text-ink-faint hover:text-ink-muted'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
