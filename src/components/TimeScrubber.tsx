import { useNowMin } from '../lib/useLive'
import { setNowMin, resetNow, fmtHM } from '../lib/clock'

// 시간 스크러버 (dev 컨트롤) — 10:00→18:00 을 밀면 하루를 겪는다.
// 밀면: 체크가 쌓이고, 미이행이 soft 플래그로 뜨고, 14:00 교대에 오후조 미출근이 경보로 뜬다.
// ⚠️ 캡쳐 아트보드 바깥(fixed). 최종 캡쳐 시 이 바는 제외한다.

const START = 10 * 60 // 10:00
const END = 18 * 60 // 18:00
const MARKS = [
  { min: 10 * 60, label: '10:00' },
  { min: 12 * 60, label: '12:00' },
  { min: 14 * 60, label: '14:00 교대' },
  { min: 16 * 60, label: '16:00' },
  { min: 18 * 60, label: '18:00' },
]

export default function TimeScrubber() {
  const now = useNowMin()
  const shift = now < 14 * 60 ? '오전조' : '오후조'

  return (
    <div className="fixed left-1/2 top-3 z-[60] w-[min(720px,92vw)] -translate-x-1/2 rounded-xl border border-line bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur">
      <div className="flex items-center gap-3">
        <span className="shrink-0 rounded-md bg-neutral-900 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          DEV
        </span>
        <span className="shrink-0 text-caption font-semibold text-ink-muted">시간 스크러버</span>
        <span className="tnum shrink-0 rounded-md bg-primary-50 px-2 py-0.5 text-label font-bold text-primary-700">
          {fmtHM(now)} · {shift}
        </span>
        <input
          type="range"
          min={START}
          max={END}
          step={1}
          value={now}
          onChange={(e) => setNowMin(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer accent-primary-600"
          aria-label="현재 시각"
        />
        <button
          onClick={resetNow}
          className="shrink-0 rounded-md border border-line px-2 py-1 text-caption font-semibold text-ink-muted transition hover:bg-neutral-100"
        >
          14:20 리셋
        </button>
      </div>
      <div className="mt-1 flex justify-between px-[2px]">
        {MARKS.map((m) => (
          <button
            key={m.min}
            onClick={() => setNowMin(m.min)}
            className={`text-[10px] tnum transition hover:text-primary-700 ${
              Math.abs(now - m.min) < 30 ? 'font-bold text-primary-700' : 'text-ink-faint'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}
