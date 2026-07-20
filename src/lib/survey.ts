// 만족도조사 — 방문객 설문 문항 + 응답 수집(무산 survey.ts 개념).
//
// 문항 = ITS 부대행사 만족도(무산의 종교 문항은 무관 — 구조만 준용). 무PII: 개인 식별 항목 없음,
// 연령대만 선택(익명 인구통계). 응답은 in-memory(다른 뮤테이션과 같은 종·시연은 시드에서 시작) —
// 방문객 /v/survey 제출 → 콘솔 만족도조사 응답 뷰가 같은 배열을 읽는다(단일 SPA 런타임 공유).
// 실제 저장(Supabase)은 services 경계 교체 시. 참여 완료 표식만 localStorage.

export type SurveyQType = 'single' | 'scale' | 'text'
export interface SurveyOption {
  value: string
  label: string
}
export interface SurveyQuestion {
  id: string
  title: string
  type: SurveyQType
  options?: SurveyOption[]
  optional?: boolean
}

// 5점 척도(값 5→1). 집계 평균에 쓰인다.
const SCALE_5: SurveyOption[] = [
  { value: '5', label: '매우 만족' },
  { value: '4', label: '만족' },
  { value: '3', label: '보통' },
  { value: '2', label: '불만족' },
  { value: '1', label: '매우 불만족' },
]
const INTENT_5: SurveyOption[] = [
  { value: '5', label: '매우 그렇다' },
  { value: '4', label: '그렇다' },
  { value: '3', label: '보통' },
  { value: '2', label: '아니다' },
  { value: '1', label: '전혀 아니다' },
]

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'age',
    title: '연령대',
    type: 'single',
    optional: true,
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
    id: 'purpose',
    title: '방문 목적',
    type: 'single',
    options: [
      { value: 'show', label: '공연·문화행사' },
      { value: 'food', label: '음식·먹거리' },
      { value: 'exp', label: '전시·체험' },
      { value: 'tour', label: '도시 관광' },
      { value: 'company', label: '가족·지인 동행' },
    ],
  },
  { id: 'overall', title: '전체 만족도', type: 'scale', options: SCALE_5 },
  {
    id: 'best',
    title: '가장 좋았던 프로그램',
    type: 'single',
    options: [
      { value: 'stage', label: '공연 무대' },
      { value: 'food', label: '음식·휴게' },
      { value: 'photo', label: '포토존·체험' },
      { value: 'promo', label: '도시홍보관' },
    ],
  },
  { id: 'revisit', title: '재방문·추천 의향', type: 'scale', options: INTENT_5 },
  { id: 'opinion', title: '개선 의견', type: 'text', optional: true },
]

export type SurveyAnswers = Record<string, string>

// ── 응답 저장소(in-memory · 시드) ────────────────────────
// 시드 = 긍정 편향의 대표 분포(콘솔 뷰가 빈 화면이 아니도록). 결정적(캡쳐 안정).
const responses: SurveyAnswers[] = [
  { age: '30', purpose: 'show', overall: '5', best: 'stage', revisit: '5', opinion: '드론쇼가 인상적이었어요.' },
  { age: '20', purpose: 'food', overall: '4', best: 'food', revisit: '4', opinion: '' },
  { age: '40', purpose: 'company', overall: '5', best: 'photo', revisit: '5', opinion: '아이들과 즐기기 좋았습니다.' },
  { age: '50', purpose: 'tour', overall: '4', best: 'promo', revisit: '4', opinion: '' },
  { age: '30', purpose: 'exp', overall: '3', best: 'photo', revisit: '3', opinion: '체험 대기가 조금 길었어요.' },
  { age: '20', purpose: 'show', overall: '5', best: 'stage', revisit: '5', opinion: '' },
  { age: 'o60', purpose: 'tour', overall: '4', best: 'promo', revisit: '4', opinion: '안내가 친절했습니다.' },
  { age: '40', purpose: 'food', overall: '5', best: 'food', revisit: '5', opinion: '' },
  { age: '30', purpose: 'company', overall: '4', best: 'stage', revisit: '4', opinion: '' },
  { age: '20', purpose: 'exp', overall: '4', best: 'photo', revisit: '5', opinion: '주차가 혼잡했어요.' },
  { age: '50', purpose: 'show', overall: '5', best: 'stage', revisit: '5', opinion: '' },
  { age: 'u10', purpose: 'company', overall: '5', best: 'photo', revisit: '5', opinion: '' },
  { age: '40', purpose: 'tour', overall: '3', best: 'promo', revisit: '3', opinion: '화장실이 더 있으면 좋겠어요.' },
  { age: '30', purpose: 'food', overall: '4', best: 'food', revisit: '4', opinion: '' },
]

export function submitSurvey(answers: SurveyAnswers): void {
  responses.push(answers)
}
export function getResponses(): SurveyAnswers[] {
  return responses
}
export const responseCount = (): number => responses.length

// ── 집계 헬퍼(콘솔 응답 뷰) ──────────────────────────────
// 옵션별 응답 수(옵션 정의 순서대로).
export function tally(q: SurveyQuestion): { option: SurveyOption; count: number }[] {
  if (!q.options) return []
  return q.options.map((option) => ({
    option,
    count: responses.filter((r) => r[q.id] === option.value).length,
  }))
}
// 척도 평균(5점).
export function scaleAverage(q: SurveyQuestion): number {
  const vals = responses.map((r) => Number(r[q.id])).filter((n) => n >= 1 && n <= 5)
  if (vals.length === 0) return 0
  return vals.reduce((a, b) => a + b, 0) / vals.length
}
// 주관식 의견(빈 값 제외).
export function opinions(): string[] {
  return responses.map((r) => r.opinion?.trim()).filter((v): v is string => !!v)
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
