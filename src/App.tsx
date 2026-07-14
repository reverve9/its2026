import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ConsoleLayout from './surfaces/console/ConsoleLayout'
import FieldLayout from './surfaces/field/FieldLayout'
import Dashboard from './surfaces/console/pages/Dashboard'
import People from './surfaces/console/pages/People'
import Safety from './surfaces/console/pages/Safety'
import Issues from './surfaces/console/pages/Issues'
import Report from './surfaces/console/pages/Report'
import Placeholder from './components/Placeholder'
import TimeScrubber from './components/TimeScrubber'
import CaptureShell from './components/CaptureShell'
import { useCapture, setCapture } from './lib/capture'

// 캡쳐/데모 편의용 서피스 전환기 — 최종 캡쳐 시 제거 가능(dev aid).
// 캡쳐 모드에선 숨긴다(아트보드 오염 방지). '캡쳐' 버튼으로 캡쳐 모드 진입.
function SurfaceSwitcher() {
  const capture = useCapture()
  if (capture) return null
  const items = [
    { to: '/', label: '운영본부 콘솔', end: true },
    { to: '/f', label: '현장 앱' },
  ]
  return (
    <div className="no-print fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-white/95 p-1 shadow-lg backdrop-blur">
      {items.map((i) => (
        <NavLink
          key={i.to}
          to={i.to}
          end={i.end}
          className={({ isActive }) =>
            `rounded-full px-3 py-1.5 text-caption font-semibold transition ${
              isActive ? 'bg-primary-600 text-white' : 'text-ink-muted hover:bg-neutral-100'
            }`
          }
        >
          {i.label}
        </NavLink>
      ))}
      <div className="mx-0.5 h-4 w-px bg-line" />
      <button
        onClick={() => setCapture(true)}
        className="rounded-full px-3 py-1.5 text-caption font-semibold text-ink-muted transition hover:bg-neutral-100"
      >
        캡쳐
      </button>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <CaptureShell>
      <Routes>
        {/* 데스크탑 운영본부 콘솔 — 5화면 (Phase 2/3에서 실제 화면) */}
        <Route element={<ConsoleLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/people" element={<People />} />
          <Route
            path="/personnel"
            element={<Placeholder title="인력 명부" note="배치 인력 전원 신상·연락처·외국어·배치·역할·비상연락망 대장(정적). 개인 상세는 관제 로스터와 모달 공유(근태 / 명부·물품 탭). 개인정보 최소수집·행사 후 즉시 파기(Ⅳ-8). 제작 예정." />}
          />
          <Route
            path="/goods"
            element={<Placeholder title="물품지급 현황" note="활동물품(바람막이·가방) 110세트 지급/미지급·잔여·지급일 트래킹 (본공고 3-1 제작·배부). 제작 예정." />}
          />
          <Route path="/safety" element={<Safety />} />
          <Route path="/report" element={<Report />} />
          <Route
            path="/settlement"
            element={<Placeholder title="실비 정산 현황" note="출결·누적시간 기반 식비·교통비 자동 산출 집계 — 총액·거점별·일자별 (과업 3-1). 제작 예정." />}
          />
          <Route
            path="/settlement/detail"
            element={<Placeholder title="개인별 정산 내역" note="1인당 출결 연동 실비(식비·교통비) 내역. 제작 예정." />}
          />
          <Route
            path="/settlement/close"
            element={<Placeholder title="정산 마감·산출내역서" note="일자별 마감 + 산출내역서 출력(제안서 산출내역 근거). 제작 예정." />}
          />
          <Route path="/issues" element={<Issues />} />
        </Route>

        {/* 현장 모바일 PWA — 역할 분기(봉사자 / 거점관리자) */}
        <Route path="/f" element={<FieldLayout />} />
      </Routes>
      </CaptureShell>
      <TimeScrubber />
      <SurfaceSwitcher />
    </BrowserRouter>
  )
}
