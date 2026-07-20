import { PageHeader, Section } from '../../../components/layout'
import {
  SURVEY_QUESTIONS, tally, scaleAverage, opinions, responseCount,
} from '../../../lib/survey'

// 만족도조사 응답(콘솔 · '콘텐츠' 갈래) — 방문객 설문 수집 뷰(무산 AdminSurvey 개념).
// 방문객 /v/survey 제출분 + 시드. 문항별 분포·척도 평균·주관식 의견.

function Bar({ label, count, total, note }: { label: string; count: number; total: number; note?: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-body">
        <span className="text-ink-strong">{label}</span>
        <span className="tnum shrink-0 text-ink-muted">
          {note ?? `${count}명`} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Survey() {
  const total = responseCount()
  const ops = opinions()

  return (
    <div>
      <PageHeader title="만족도조사 응답" summary={`응답 ${total}건`} />

      <div className="grid grid-cols-2 gap-5">
        {SURVEY_QUESTIONS.filter((q) => q.type !== 'text').map((q) => {
          const rows = tally(q)
          const avg = q.type === 'scale' ? scaleAverage(q) : null
          return (
            <Section
              key={q.id}
              title={q.title}
              right={avg !== null ? <span className="tnum text-body font-semibold text-primary-700">평균 {avg.toFixed(1)} / 5</span> : undefined}
            >
              <div className="space-y-3">
                {rows.map((r) => (
                  <Bar key={r.option.value} label={r.option.label} count={r.count} total={total} />
                ))}
              </div>
            </Section>
          )
        })}
      </div>

      {/* 주관식 의견 */}
      <div className="mt-5">
        <Section title="개선 의견" right={<span className="tnum text-body text-ink-muted">{ops.length}건</span>}>
          {ops.length === 0 ? (
            <p className="text-body text-ink-faint">—</p>
          ) : (
            <ul className="space-y-2">
              {ops.map((o, i) => (
                <li key={i} className="rounded-lg border border-line bg-page px-3 py-2 text-body text-ink-strong">
                  {o}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
