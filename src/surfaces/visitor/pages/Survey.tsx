import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import VisitorPage from './VisitorPage'
import {
  SURVEY_QUESTIONS, submitSurvey, markSurveyDone, isSurveyDone, type SurveyAnswers,
} from '../../../lib/survey'

// 만족도조사(헤더 메뉴) — 방문객 설문 폼(무산 SurveyPage 개념). 무PII.
// 제출 → in-memory 수집(콘솔 응답 뷰가 읽음) + 참여 완료 표식(localStorage).
export default function Survey() {
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<SurveyAnswers>({})
  const [done, setDone] = useState(isSurveyDone())

  const required = SURVEY_QUESTIONS.filter((q) => !q.optional)
  const complete = required.every((q) => answers[q.id])

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
      <div className="space-y-3">
        {SURVEY_QUESTIONS.map((q) => (
          <div key={q.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-sm">
            <div className="mb-2.5 flex items-center gap-1.5">
              <span className="text-label font-semibold text-ink-strong">{q.title}</span>
              {q.optional && <span className="text-caption text-ink-faint">(선택)</span>}
            </div>
            {q.type === 'text' ? (
              <textarea
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={3}
                className="w-full resize-none rounded-lg border border-line bg-page p-2.5 text-caption text-ink-strong outline-none transition focus:border-primary-400"
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {q.options!.map((o) => {
                  const sel = answers[q.id] === o.value
                  return (
                    <button
                      key={o.value}
                      onClick={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))}
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
