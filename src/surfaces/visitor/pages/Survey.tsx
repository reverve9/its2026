import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VisitorPage from './VisitorPage'
import {
  SURVEY_QUESTIONS, SECTIONS, submitSurvey, markSurveyDone, isSurveyDone,
  type SurveyAnswers, type SurveyQuestion,
} from '../../../lib/survey'

// 만족도조사(헤더 메뉴) — 방문객 설문 폼(무산 SurveyPage 개념). 무PII·단일 페이지.
// 섹션(A~F)으로 묶어 세분 문항을 훑기 쉽게. 제출 → in-memory 수집(콘솔 응답 뷰가 읽음) + 완료 표식.

const SECTION_ORDER = Object.values(SECTIONS)

export default function Survey() {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [done, setDone] = useState(isSurveyDone())

  // 필수 = optional 아닌 문항. 단일/척도→값 존재, 복수→1개 이상 선택.
  const answered = (q: SurveyQuestion): boolean => {
    const v = answers[q.id]
    if (q.type === 'multi') return Array.isArray(v) && v.length > 0
    return typeof v === 'string' && v !== ''
  }
  const complete = SURVEY_QUESTIONS.filter((q) => !q.optional).every(answered)

  const setSingle = (id: string, value: string) => setAnswers((a) => ({ ...a, [id]: value }))
  const toggleMulti = (id: string, value: string) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as string[]) : []
      return { ...a, [id]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] }
    })

  const submit = () => {
    submitSurvey(answers)
    markSurveyDone()
    setDone(true)
  }

  if (done) {
    return (
      <VisitorPage title="만족도조사">
        <div className="grid place-items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-primary-50 text-primary-600">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 12l4.5 4.5L19 7" />
            </svg>
          </div>
          <div className="text-label font-semibold text-ink-strong">참여해 주셔서 감사합니다</div>
          <button onClick={() => navigate('/v')} className="mt-1 rounded-full bg-primary-600 px-5 py-2 text-label font-semibold text-white">
            홈으로
          </button>
        </div>
      </VisitorPage>
    )
  }

  return (
    <VisitorPage title="만족도조사">
      <div className="space-y-4">
        {SECTION_ORDER.map((section) => {
          const qs = SURVEY_QUESTIONS.filter((q) => q.section === section)
          if (qs.length === 0) return null
          return (
            <div key={section} className="space-y-2.5">
              <div className="px-0.5 text-caption font-bold uppercase tracking-wide text-primary-600">{section}</div>
              {qs.map((q) => (
                <div key={q.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
                  <div className="mb-2.5 flex items-center gap-1.5">
                    <span className="text-label font-semibold text-ink-strong">{q.title}</span>
                    {q.optional && <span className="text-caption text-ink-faint">(선택)</span>}
                    {q.type === 'multi' && <span className="text-caption text-ink-faint">· 복수 선택</span>}
                  </div>

                  {q.type === 'text' ? (
                    <textarea
                      value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                      onChange={(e) => setSingle(q.id, e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-line bg-page p-2.5 text-caption text-ink-strong outline-none transition focus:border-primary-400"
                    />
                  ) : q.type === 'multi' ? (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options!.map((o) => {
                        const sel = Array.isArray(answers[q.id]) && (answers[q.id] as string[]).includes(o.value)
                        return (
                          <button
                            key={o.value}
                            onClick={() => toggleMulti(q.id, o.value)}
                            className={`rounded-full px-3 py-1.5 text-caption font-semibold transition ${
                              sel ? 'bg-primary-600 text-white' : 'border border-line bg-surface text-ink-muted'
                            }`}
                          >
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {q.options!.map((o) => {
                        const sel = answers[q.id] === o.value
                        return (
                          <button
                            key={o.value}
                            onClick={() => setSingle(q.id, o.value)}
                            className={`rounded-full px-3 py-1.5 text-caption font-semibold transition ${
                              sel ? 'bg-primary-600 text-white' : 'border border-line bg-surface text-ink-muted'
                            }`}
                          >
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}

        <button
          onClick={submit}
          disabled={!complete}
          className="w-full rounded-full bg-primary-600 py-3 text-label font-semibold text-white transition disabled:bg-neutral-200 disabled:text-ink-faint"
        >
          제출
        </button>
      </div>
    </VisitorPage>
  )
}
