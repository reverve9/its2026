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

// 근퇴 타임라인 → 누적 근무 분. 각 엔트리 상태가 다음 엔트리(또는 end)까지 지속.
// end 는 호출측이 주입(현재 시각 또는 퇴근 시각). now 를 전역 호출하지 않는다.
//
// ⚠️ 옛 workBreak(work/brk 를 같이 돌려주던 것)을 대체한다 — 휴게·이동 폐기로 'on' 아닌
// 근무 구간이 없어져 brk 가 언제나 0 이 됐다. 늘 0 인 수를 돌려주면 화면이 '누적 휴게 0분'을
// 진짜 사실처럼 찍는다. 루프는 남긴다: 상태가 다시 늘면 여기가 그 자리다.
export function workMin(log: DutyLogEntry[], endMin: number): number {
  if (!log.length) return 0
  const s = [...log].sort((a, b) => toMin(a.time) - toMin(b.time))
  let work = 0
  for (let i = 0; i < s.length; i++) {
    const start = toMin(s[i].time)
    const stop = i + 1 < s.length ? toMin(s[i + 1].time) : endMin
    if (s[i].status === 'on') work += Math.max(0, stop - start)
  }
  return work
}
