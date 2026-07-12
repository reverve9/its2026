import type { DutyLogEntry } from '../types'

// 캡쳐 기준 '현재 시각' — 콘솔 헤더 시계와 일치.
export const NOW = '14:20'

// 정시(1시간) 체크 슬롯 — 운영시간 10:00–18:00 중 현재(14:20)까지 지난 슬롯.
export const SLOTS = ['10:00', '11:00', '12:00', '13:00', '14:00']

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

// 근퇴 타임라인 → 누적 근무/휴게 분. 각 엔트리 상태가 다음 엔트리(또는 now)까지 지속.
export function workBreak(log: DutyLogEntry[], now: string = NOW): { work: number; brk: number } {
  if (!log.length) return { work: 0, brk: 0 }
  const s = [...log].sort((a, b) => toMin(a.time) - toMin(b.time))
  const end = toMin(now)
  let work = 0,
    brk = 0
  for (let i = 0; i < s.length; i++) {
    const start = toMin(s[i].time)
    const stop = i + 1 < s.length ? toMin(s[i + 1].time) : end
    const dur = Math.max(0, stop - start)
    if (s[i].status === 'break') brk += dur
    else if (s[i].status === 'on' || s[i].status === 'moving') work += dur
  }
  return { work, brk }
}
