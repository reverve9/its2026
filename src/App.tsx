import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import ConsoleLayout from './surfaces/console/ConsoleLayout'
import FieldLayout from './surfaces/field/FieldLayout'
import VisitorLayout from './surfaces/visitor/VisitorLayout'
import VisitorHome from './surfaces/visitor/pages/Home'
import VisitorAbout from './surfaces/visitor/pages/About'
import VisitorProgram from './surfaces/visitor/pages/Program'
import VisitorAround from './surfaces/visitor/pages/Around'
import VisitorFood from './surfaces/visitor/pages/Food'
import VisitorGuide from './surfaces/visitor/pages/Guide'
import VisitorPhoto from './surfaces/visitor/pages/Photo'
import VisitorMy from './surfaces/visitor/pages/My'
import VisitorNotice from './surfaces/visitor/pages/Notice'
import VisitorLocation from './surfaces/visitor/pages/Location'
import VisitorFaq from './surfaces/visitor/pages/Faq'
import VisitorSurvey from './surfaces/visitor/pages/Survey'
import Dashboard from './surfaces/console/pages/Dashboard'
import People from './surfaces/console/pages/People'
import Personnel from './surfaces/console/pages/Personnel'
import FoodVendors from './surfaces/console/pages/FoodVendors'
import Settlement from './surfaces/console/pages/Settlement'
import Safety from './surfaces/console/pages/Safety'
import Issues from './surfaces/console/pages/Issues'
import Notices from './surfaces/console/pages/Notices'
import Report from './surfaces/console/pages/Report'
import SurveyResponses from './surfaces/console/pages/Survey'
import ContentBoard from './surfaces/console/pages/ContentBoard'
import Programs from './surfaces/console/pages/Programs'
import Coupons from './surfaces/console/pages/Coupons'
import TimeScrubber from './components/TimeScrubber'
import CaptureShell from './components/CaptureShell'
import { useCapture, setCapture } from './lib/capture'

// 캡쳐/데모 편의용 서피스 전환기 — 최종 캡쳐 시 제거 가능(dev aid).
// 캡쳐 모드에선 숨긴다(아트보드 오염 방지). '캡쳐' 버튼으로 캡쳐 모드 진입.
// 최소화: 제자리에서 'DEV' 칩으로 접어 콘텐츠를 안 가린다. DEV 칩을 누르면 다시 펼침(도구별 독립).
function SurfaceSwitcher() {
  const capture = useCapture()
  const [min, setMin] = useState(false)
  if (capture) return null

  // 최소화 — 같은 자리(하단 중앙)에 작은 DEV 칩만. 누르면 펼침.
  if (min) {
    return (
      <button
        onClick={() => setMin(false)}
        className="no-print fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-muted shadow-lg backdrop-blur transition hover:bg-neutral-100"
        title="서피스 전환기 펼치기"
      >
        DEV
      </button>
    )
  }

  const items = [
    { to: '/', label: '운영본부 콘솔', end: true },
    { to: '/f', label: '현장 앱' },
    { to: '/v', label: '방문객 앱' },
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
      {/* 최소화 — 콘텐츠 가림 없이 제자리 DEV 칩으로 */}
      <button
        onClick={() => setMin(true)}
        className="grid h-7 w-7 place-items-center rounded-full text-ink-faint transition hover:bg-neutral-100 hover:text-ink-muted"
        aria-label="서피스 전환기 최소화"
        title="최소화"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12h14" />
        </svg>
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
          <Route path="/notices" element={<Notices />} />
          <Route path="/people" element={<People />} />
          <Route path="/personnel" element={<Personnel />} />
          <Route path="/vendors" element={<FoodVendors />} />
          <Route path="/safety" element={<Safety />} />
          <Route path="/report" element={<Report />} />
          <Route path="/settlement" element={<Settlement />} />
          <Route path="/issues" element={<Issues />} />
          <Route path="/survey" element={<SurveyResponses />} />
          <Route path="/content-board" element={<ContentBoard />} />
          <Route path="/programs" element={<Programs />} />
          <Route path="/coupons" element={<Coupons />} />
        </Route>

        {/* 현장 모바일 PWA — 역할 분기(봉사자 / 거점관리자) */}
        <Route path="/f" element={<FieldLayout />} />

        {/* 방문객 공개 앱 — 무인증 발행 뷰. 홈(로고)+4탭+마이 */}
        <Route path="/v" element={<VisitorLayout />}>
          <Route index element={<VisitorHome />} />
          <Route path="about" element={<VisitorAbout />} />
          <Route path="program" element={<VisitorProgram />} />
          <Route path="around" element={<VisitorAround />} />
          <Route path="food" element={<VisitorFood />} />
          <Route path="guide" element={<VisitorGuide />} />
          <Route path="photo" element={<VisitorPhoto />} />
          <Route path="my" element={<VisitorMy />} />
          <Route path="notice" element={<VisitorNotice />} />
          <Route path="location" element={<VisitorLocation />} />
          <Route path="faq" element={<VisitorFaq />} />
          <Route path="survey" element={<VisitorSurvey />} />
        </Route>
      </Routes>
      </CaptureShell>
      <TimeScrubber />
      <SurfaceSwitcher />
    </BrowserRouter>
  )
}
