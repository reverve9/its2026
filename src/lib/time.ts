import type { DutyLogEntry } from '../types'

// 순수 시각 헬퍼 — '현재 시각'은 여기서 만들지 않는다(clock.ts 소관, R6).

export const toMin = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

export const fmtDur = (min: number) => {
  if (min <= 0) return '0분'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}시간 ${m}분` : `${m}분`
}

// 근퇴 타임라인 → 누적 근무/휴게 분. 각 엔트리 상태가 다음 엔트리(또는 end)까지 지속.
// end 는 호출측이 주입(현재 시각 또는 퇴근 시각). now 를 전역 호출하지 않는다.
export function workBreak(log: DutyLogEntry[], endMin: number): { work: number; brk: number } {
  if (!log.length) return { work: 0, brk: 0 }
  const s = [...log].sort((a, b) => toMin(a.time) - toMin(b.time))
  let work = 0,
    brk = 0
  for (let i = 0; i < s.length; i++) {
    const start = toMin(s[i].time)
    const stop = i + 1 < s.length ? toMin(s[i + 1].time) : endMin
    const dur = Math.max(0, stop - start)
    if (s[i].status === 'break') brk += dur
    else if (s[i].status === 'on' || s[i].status === 'moving') work += dur
  }
  return { work, brk }
}
