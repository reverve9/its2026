import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ConsoleLayout from './surfaces/console/ConsoleLayout'
import FieldLayout from './surfaces/field/FieldLayout'
import Dashboard from './surfaces/console/pages/Dashboard'
import People from './surfaces/console/pages/People'
import Personnel from './surfaces/console/pages/Personnel'
import FoodVendors from './surfaces/console/pages/FoodVendors'
import Settlement from './surfaces/console/pages/Settlement'
import Safety from './surfaces/console/pages/Safety'
import Issues from './surfaces/console/pages/Issues'
import Report from './surfaces/console/pages/Report'
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
          <Route path="/personnel" element={<Personnel />} />
          <Route path="/vendors" element={<FoodVendors />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settlement" element={<Settlement />} />
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
