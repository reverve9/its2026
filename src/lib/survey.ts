// 만족도조사 — 방문객 설문 문항 + 응답 수집(무산 survey.ts 개념).
//
// ITS 부대행사 만족도(무산의 종교 문항은 제외 — 행사 관련 문항만 준용). 무PII: 개인 식별 항목 없음,
// 익명 인구통계(연령대·성별·거주지·동행)만. 응답은 in-memory(다른 뮤테이션과 같은 종·시연은 시드에서 시작) —
// 방문객 /v/survey 제출 → 콘솔 만족도조사 응답 뷰가 같은 배열을 읽는다(단일 SPA 런타임 공유).
// 실제 저장(Supabase)은 services 경계 교체 시. 참여 완료 표식만 localStorage.
//
// 🔑 문항이 집계와 연동된다(무산 questions.ts = 단일 진실원 원칙): 문항 유형(single/scale/multi/text)이
//    집계 방식을 가른다 — single/scale→버킷, scale→100점 환산·top-box·분포, multi→복수선택 집계, text→의견.
//    문항 세분화 시 이 배열만 고치면 폼·집계가 함께 따라온다.

export type SurveyQType = 'single' | 'scale' | 'multi' | 'text'
export interface SurveyOption {
  value: string
  label: string
}
export interface SurveyQuestion {
  id: string
  title: string
  type: SurveyQType
  section: string // A~F 묶음 라벨(폼 섹션 헤더 · 집계 그룹)
  options?: SurveyOption[]
  optional?: boolean
}

// 5점 척도 — 만족도(값 5→1). 100점 환산·top-box(4점 이상)에 쓰인다.
const SAT_5: SurveyOption[] = [
  { value: '5', label: '매우 만족' },
  { value: '4', label: '만족' },
  { value: '3', label: '보통' },
  { value: '2', label: '불만족' },
  { value: '1', label: '매우 불만족' },
]
// 5점 척도 — 의향/동의(값 5→1).
const INTENT_5: SurveyOption[] = [
  { value: '5', label: '매우 그렇다' },
  { value: '4', label: '그렇다' },
  { value: '3', label: '보통' },
  { value: '2', label: '아니다' },
  { value: '1', label: '전혀 아니다' },
]

// 섹션 라벨(폼 헤더 · 집계 그룹) — 정의 순서 유지.
export const SECTIONS = {
  A: '응답자 정보',
  B: '방문 정보',
  C: '항목별 만족도',
  D: '운영·편의',
  E: '성과·의향',
  F: '향후·의견',
} as const

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  // ── A. 응답자 정보(익명 인구통계) ──
  {
    id: 'age', title: '연령대', type: 'single', section: SECTIONS.A,
    options: [
      { value: 'u10', label: '10대 이하' },
      { value: '20', label: '20대' },
      { value: '30', label: '30대' },
      { value: '40', label: '40대' },
      { value: '50', label: '50대' },
      { value: 'o60', label: '60대 이상' },
    ],
  },
  {
    id: 'gender', title: '성별', type: 'single', section: SECTIONS.A, optional: true,
    options: [
      { value: 'male', label: '남성' },
      { value: 'female', label: '여성' },
    ],
  },
  {
    id: 'region', title: '거주지', type: 'single', section: SECTIONS.A,
    options: [
      { value: 'gn', label: '강릉시' },
      { value: 'gw', label: '강원(강릉 외)' },
      { value: 'metro', label: '수도권' },
      { value: 'etc', label: '그 외 지역' },
      { value: 'abroad', label: '해외' },
    ],
  },
  {
    id: 'companion', title: '동행 유형', type: 'single', section: SECTIONS.A,
    options: [
      { value: 'alone', label: '혼자' },
      { value: 'family', label: '가족' },
      { value: 'friend', label: '친구·지인' },
      { value: 'group', label: '단체' },
    ],
  },
  // ── B. 방문 정보 ──
  {
    id: 'purpose', title: '방문 목적', type: 'single', section: SECTIONS.B,
    options: [
      { value: 'show', label: '공연·문화' },
      { value: 'food', label: '음식·먹거리' },
      { value: 'exp', label: '전시·체험' },
      { value: 'tour', label: '도시 관광' },
      { value: 'company', label: '가족·지인 동행' },
    ],
  },
  {
    id: 'infoSource', title: '정보 출처', type: 'multi', section: SECTIONS.B,
    options: [
      { value: 'official', label: '공식 홈페이지' },
      { value: 'sns', label: 'SNS·블로그' },
      { value: 'tv', label: 'TV·라디오' },
      { value: 'news', label: '신문·기사' },
      { value: 'outdoor', label: '현수막·포스터' },
      { value: 'word', label: '지인 추천' },
      { value: 'other', label: '기타' },
    ],
  },
  {
    id: 'visitCount', title: '방문 횟수', type: 'single', section: SECTIONS.B,
    options: [
      { value: 'first', label: '처음' },
      { value: 'second', label: '2회' },
      { value: 'third', label: '3회 이상' },
    ],
  },
  // ── C. 항목별 만족도(척도 5) ──
  { id: 'overall', title: '전체 만족도', type: 'scale', section: SECTIONS.C, options: SAT_5 },
  { id: 'p_show', title: '공연·문화 프로그램', type: 'scale', section: SECTIONS.C, options: SAT_5 },
  { id: 'p_food', title: '음식·먹거리', type: 'scale', section: SECTIONS.C, options: SAT_5 },
  { id: 'p_photo', title: '포토존·체험', type: 'scale', section: SECTIONS.C, options: SAT_5 },
  { id: 'p_promo', title: '도시홍보관', type: 'scale', section: SECTIONS.C, options: SAT_5 },
  { id: 'p_guide', title: '안내·운영', type: 'scale', section: SECTIONS.C, options: SAT_5 },
  // ── D. 운영·편의(척도 5) ──
  { id: 'op_traffic', title: '교통 접근성', type: 'scale', section: SECTIONS.D, options: SAT_5 },
  { id: 'op_parking', title: '주차', type: 'scale', section: SECTIONS.D, options: SAT_5 },
  { id: 'op_way', title: '행사장 동선·안내', type: 'scale', section: SECTIONS.D, options: SAT_5 },
  { id: 'op_facility', title: '편의시설', type: 'scale', section: SECTIONS.D, options: SAT_5 },
  // ── E. 성과·의향(척도 5) ──
  { id: 'revisit', title: '재방문 의향', type: 'scale', section: SECTIONS.E, options: INTENT_5 },
  { id: 'recommend', title: '주변 추천 의향', type: 'scale', section: SECTIONS.E, options: INTENT_5 },
  { id: 'cityimage', title: '강릉 도시 이미지 향상 기여', type: 'scale', section: SECTIONS.E, options: INTENT_5 },
  // ── F. 향후·의견 ──
  {
    id: 'future', title: '향후 희망 프로그램', type: 'multi', section: SECTIONS.F,
    options: [
      { value: 'more_show', label: '공연 확대' },
      { value: 'experience', label: '체험형 활동' },
      { value: 'night', label: '야간 프로그램' },
      { value: 'food_var', label: '먹거리 다양화' },
      { value: 'tour_link', label: '관광 연계' },
      { value: 'other', label: '기타' },
    ],
  },
  {
    id: 'best', title: '가장 좋았던 프로그램', type: 'single', section: SECTIONS.F,
    options: [
      { value: 'stage', label: '공연 무대' },
      { value: 'food', label: '음식·휴게' },
      { value: 'photo', label: '포토존·체험' },
      { value: 'promo', label: '도시홍보관' },
    ],
  },
  { id: 'opinion', title: '개선 의견', type: 'text', section: SECTIONS.F, optional: true },
]

// 단일/척도 = string, 복수 = string[], 주관식 = string.
export type SurveyAnswers = Record<string, string | string[]>

// ── 응답 저장소(in-memory · 결정적 시드) ─────────────────
// 시드 = 긍정 편향 대표 분포(콘솔 뷰가 빈 화면이 아니도록). 무작위 없음(캡쳐 안정) —
// 필드별 풀을 인덱스로 순환. 교통·주차는 실제 행사 페인포인트라 낮게 깔아 대비를 준다.
const SEED_N = 15
const SEED_POOLS: Record<string, string[]> = {
  age: ['20', '30', '40', '30', '50', '20', 'o60', '40', 'u10', '30'],
  gender: ['male', 'female', 'female', 'male', 'female', '', 'male', 'female', 'female', 'male'],
  region: ['gn', 'metro', 'gw', 'gn', 'abroad', 'metro', 'gn', 'etc', 'gw', 'metro'],
  companion: ['family', 'friend', 'alone', 'family', 'group', 'friend', 'family', 'alone', 'friend', 'family'],
  purpose: ['show', 'food', 'exp', 'tour', 'company', 'food', 'show', 'tour', 'exp', 'food'],
  visitCount: ['first', 'first', 'second', 'first', 'third', 'second', 'first', 'first', 'second', 'first'],
  overall: ['5', '4', '5', '5', '4', '5', '4', '5', '3', '5'],
  p_show: ['5', '5', '4', '5', '4', '5', '5', '4', '5', '4'],
  p_food: ['4', '4', '5', '3', '4', '5', '4', '4', '3', '5'],
  p_photo: ['5', '4', '4', '5', '5', '4', '3', '5', '4', '4'],
  p_promo: ['4', '3', '4', '4', '3', '4', '5', '3', '4', '4'],
  p_guide: ['5', '5', '4', '5', '4', '5', '4', '5', '5', '4'],
  op_traffic: ['3', '4', '3', '4', '2', '3', '4', '3', '4', '3'],
  op_parking: ['2', '3', '2', '3', '3', '2', '3', '2', '3', '3'],
  op_way: ['4', '4', '3', '4', '4', '3', '4', '4', '3', '4'],
  op_facility: ['4', '3', '4', '4', '3', '4', '3', '4', '4', '3'],
  revisit: ['5', '4', '5', '5', '4', '5', '4', '5', '4', '5'],
  recommend: ['5', '4', '4', '5', '5', '4', '5', '4', '5', '4'],
  cityimage: ['5', '5', '4', '5', '4', '5', '5', '4', '5', '4'],
  best: ['stage', 'food', 'photo', 'stage', 'promo', 'food', 'stage', 'photo', 'stage', 'food'],
  opinion: [
    '드론쇼가 인상적이었어요.', '', '주차가 혼잡했어요.', '', '체험 대기가 조금 길었어요.',
    '안내가 친절했습니다.', '', '화장실이 더 있으면 좋겠어요.', '', '셔틀이 더 자주 다니면 좋겠어요.',
  ],
}
const SEED_MULTI: Record<string, string[][]> = {
  infoSource: [
    ['official', 'sns'], ['sns'], ['word', 'sns'], ['tv', 'news'], ['outdoor'],
    ['sns', 'word'], ['official'], ['news', 'sns'], ['word'], ['sns', 'outdoor'],
  ],
  future: [
    ['more_show', 'experience'], ['night'], ['food_var', 'tour_link'], ['experience'], ['more_show'],
    ['night', 'food_var'], ['tour_link'], ['experience', 'more_show'], ['food_var'], ['night'],
  ],
}
function buildSeeds(): SurveyAnswers[] {
  const out: SurveyAnswers[] = []
  for (let i = 0; i < SEED_N; i++) {
    const row: SurveyAnswers = {}
    for (const [k, arr] of Object.entries(SEED_POOLS)) {
      const v = arr[i % arr.length]
      if (v !== '') row[k] = v // '' = 선택 항목 미응답(성별)
    }
    for (const [k, arr] of Object.entries(SEED_MULTI)) {
      row[k] = arr[i % arr.length]
    }
    out.push(row)
  }
  return out
}
const responses: SurveyAnswers[] = buildSeeds()

export function submitSurvey(answers: SurveyAnswers): void {
  responses.push(answers)
}
export function getResponses(): SurveyAnswers[] {
  return responses
}
export const responseCount = (): number => responses.length

// ── 집계 헬퍼(콘솔 응답 뷰) ──────────────────────────────
export interface Bucket {
  option: SurveyOption
  count: number
  ratio: number // %
}

// 단일/척도 옵션별 카운트(옵션 정의 순서).
export function tally(q: SurveyQuestion): Bucket[] {
  if (!q.options) return []
  const total = responses.length
  return q.options.map((option) => {
    const count = responses.filter((r) => r[q.id] === option.value).length
    return { option, count, ratio: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }
  })
}

// 복수선택 옵션별 카운트(응답자 기준 % — 합이 100을 넘을 수 있음).
export function multiTally(q: SurveyQuestion): Bucket[] {
  if (!q.options) return []
  const total = responses.length
  return q.options.map((option) => {
    const count = responses.filter((r) => Array.isArray(r[q.id]) && (r[q.id] as string[]).includes(option.value)).length
    return { option, count, ratio: total > 0 ? Math.round((count / total) * 1000) / 10 : 0 }
  })
}

export interface ScaleStat {
  n: number
  avg: number // 5점 평균
  avg100: number // 100점 환산(avg/5*100)
  topBox: number // 4점 이상 비율 %(만족/그렇다 이상)
  dist: number[] // index=(값-1) → 카운트, 길이 5
}
// 척도 문항 통계 — 100점 환산·top-box·분포(작년 결과보고서 공식 준용).
export function scaleStat(id: string): ScaleStat {
  const nums = responses.map((r) => Number(r[id])).filter((n) => n >= 1 && n <= 5)
  const n = nums.length
  const dist = [0, 0, 0, 0, 0]
  nums.forEach((v) => (dist[v - 1] += 1))
  const avg = n ? nums.reduce((a, b) => a + b, 0) / n : 0
  const top = nums.filter((v) => v >= 4).length
  return {
    n,
    avg: Math.round(avg * 100) / 100,
    avg100: n ? Math.round((avg / 5) * 1000) / 10 : 0,
    topBox: n ? Math.round((top / n) * 1000) / 10 : 0,
    dist,
  }
}

// 주관식 의견(빈 값 제외).
export function opinions(id = 'opinion'): string[] {
  return responses
    .map((r) => (typeof r[id] === 'string' ? (r[id] as string).trim() : ''))
    .filter((v): v is string => !!v)
}

// 문항 조회(콘솔에서 id로 라벨/옵션 접근).
export function getQuestion(id: string): SurveyQuestion | undefined {
  return SURVEY_QUESTIONS.find((q) => q.id === id)
}
export function questionsBySection(section: string): SurveyQuestion[] {
  return SURVEY_QUESTIONS.filter((q) => q.section === section)
}

// ── 참여 완료 표식(localStorage · 무PII) ─────────────────
const DONE_KEY = 'its-visitor-survey-done-v1'
export function isSurveyDone(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}
export function markSurveyDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {
    /* ignore */
  }
}
