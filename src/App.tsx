import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ConsoleLayout from './surfaces/console/ConsoleLayout'
import FieldLayout from './surfaces/field/FieldLayout'
import Dashboard from './surfaces/console/pages/Dashboard'
import People from './surfaces/console/pages/People'
import Placeholder from './components/Placeholder'

// 캡쳐/데모 편의용 서피스 전환기 — 최종 캡쳐 시 제거 가능(dev aid)
function SurfaceSwitcher() {
  const items = [
    { to: '/', label: '운영본부 콘솔', end: true },
    { to: '/f', label: '현장 앱' },
  ]
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-full border border-line bg-white/95 p-1 shadow-lg backdrop-blur">
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
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 데스크탑 운영본부 콘솔 — 5화면 (Phase 2/3에서 실제 화면) */}
        <Route element={<ConsoleLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/people" element={<People />} />
          <Route
            path="/safety"
            element={<Placeholder title="안전·비상 관제" note="SOS · 기상특보 대응 · 비상연락망 · 의료지원반 연계" />}
          />
          <Route
            path="/report"
            element={<Placeholder title="일일 운영보고 자동생성" note="척추 데이터로 운영보고 자동 정리 = 차별성" />}
          />
          <Route
            path="/settlement"
            element={<Placeholder title="정산 관리" note="출결·누적시간 기반 실비(식비·교통비) 자동 산출 — 인력운영 모듈(과업 3-1). 제작 예정." />}
          />
          <Route
            path="/issues"
            element={<Placeholder title="민원·분실물·미아 접수대장" note="접수 → 처리상태 로그(라이트)" />}
          />
        </Route>

        {/* 현장 모바일 PWA — 역할 분기(봉사자 / 거점관리자) */}
        <Route path="/f" element={<FieldLayout />} />
      </Routes>
      <SurfaceSwitcher />
    </BrowserRouter>
  )
}
