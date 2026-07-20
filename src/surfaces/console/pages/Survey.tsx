import { PageHeader, Section } from '../../../components/layout'
import {
  SECTIONS, questionsBySection, tally, multiTally, scaleStat, opinions, responseCount, getQuestion,
  type SurveyQuestion, type Bucket, type ScaleStat,
} from '../../../lib/survey'

// 만족도조사 응답(콘솔 · '콘텐츠' 갈래) — 방문객 설문 수집·집계 뷰(무산 AdminSurvey 개념).
// 방문객 /v/survey 제출분 + 시드. 문항 유형이 집계를 가른다(survey.ts 단일 진실원):
//   척도 → 100점 환산 평균·top-box(긍정 비율)·분포 / 단일 → 버킷 비율 / 복수 → 복수선택 집계 / 주관식 → 의견.
// 무PII라 개인 식별 응답 목록은 없다 — 익명 집계 중심. 화면엔 데이터만(D26).

const scoreColor = ['bg-primary-100', 'bg-primary-200', 'bg-primary-300', 'bg-primary-500', 'bg-primary-600'] // 값1→5

// 척도 문항 한 줄 — 100점 환산 + top-box + 분포(5분절).
function ScaleRow({ q }: { q: SurveyQuestion }) {
  const s: ScaleStat = scaleStat(q.id)
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="text-label font-semibold text-ink-strong">{q.title}</span>
        <span className="tnum shrink-0 text-caption text-ink-muted">
          <span className="text-body font-bold text-primary-700">{s.avg100}</span>점 · 평균 {s.avg.toFixed(1)} · 긍정 {s.topBox}%
        </span>
      </div>
      {/* 분포 5분절(값1→5, 진할수록 높은 점수) */}
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
        {s.dist.map((c, i) => (
          <div key={i} className={scoreColor[i]} style={{ width: `${s.n ? (c / s.n) * 100 : 0}%` }} title={`${i + 1}점 ${c}명`} />
        ))}
      </div>
    </div>
  )
}

// 단일/복수 옵션 하나의 막대.
function BucketBar({ b }: { b: Bucket }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-caption">
        <span className="text-ink-strong">{b.option.label}</span>
        <span className="tnum shrink-0 text-ink-muted">{b.count}명 · {b.ratio}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-primary-500" style={{ width: `${b.ratio}%` }} />
      </div>
    </div>
  )
}

// 문항 = 카드(단일/복수 공용). 제목 + 옵션 막대.
function BucketCard({ q, multi = false }: { q: SurveyQuestion; multi?: boolean }) {
  const rows = multi ? multiTally(q) : tally(q)
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-label font-semibold text-ink-strong">{q.title}</h3>
        {multi && <span className="text-caption text-ink-faint">복수 선택</span>}
      </div>
      <div className="space-y-2.5">
        {rows.map((b) => (
          <BucketBar key={b.option.value} b={b} />
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub: string }) {
  return (
    <div className="card p-4">
      <div className="text-label font-medium text-ink-muted">{label}</div>
      <div className="mt-1 text-title font-bold text-ink-strong">
        <span className="tnum">{value}</span>
        {unit && <span className="ml-0.5 text-body font-semibold text-ink-muted">{unit}</span>}
      </div>
      <div className="mt-0.5 text-caption text-ink-faint">{sub}</div>
    </div>
  )
}

export default function Survey() {
  const total = responseCount()
  const overall = scaleStat('overall')
  const revisit = scaleStat('revisit')
  const recommend = scaleStat('recommend')
  const ops = opinions()

  const satItems = questionsBySection(SECTIONS.C)
  const opItems = questionsBySection(SECTIONS.D)
  const intentItems = questionsBySection(SECTIONS.E)

  // 단일 버킷 카드용 문항
  const q = (id: string) => getQuestion(id)!

  return (
    <div>
      <PageHeader title="만족도조사 응답" summary={`응답 ${total}건 · 100점 환산 평균 · 긍정(4점 이상) 비율`} />

      {/* 핵심 지표 */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        <Kpi label="전체 만족도" value={`${overall.avg100}`} unit="점" sub={`평균 ${overall.avg.toFixed(1)} / 5 · 긍정 ${overall.topBox}%`} />
        <Kpi label="재방문 의향" value={`${revisit.avg100}`} unit="점" sub={`긍정 ${revisit.topBox}%`} />
        <Kpi label="추천 의향" value={`${recommend.avg100}`} unit="점" sub={`긍정 ${recommend.topBox}%`} />
        <Kpi label="응답 수" value={`${total}`} unit="건" sub="누적 집계" />
      </div>

      {/* 척도 3섹션 */}
      <div className="grid grid-cols-3 items-start gap-5">
        <Section title={SECTIONS.C}>
          <div className="divide-y divide-line-soft">
            {satItems.map((it) => <ScaleRow key={it.id} q={it} />)}
          </div>
        </Section>
        <Section title={SECTIONS.D}>
          <div className="divide-y divide-line-soft">
            {opItems.map((it) => <ScaleRow key={it.id} q={it} />)}
          </div>
        </Section>
        <Section title={SECTIONS.E}>
          <div className="divide-y divide-line-soft">
            {intentItems.map((it) => <ScaleRow key={it.id} q={it} />)}
          </div>
        </Section>
      </div>

      {/* 응답자 정보(A) */}
      <div className="mt-5">
        <h2 className="mb-3 text-section font-semibold text-ink-strong">{SECTIONS.A}</h2>
        <div className="grid grid-cols-4 gap-3">
          <BucketCard q={q('age')} />
          <BucketCard q={q('gender')} />
          <BucketCard q={q('region')} />
          <BucketCard q={q('companion')} />
        </div>
      </div>

      {/* 방문 정보(B) */}
      <div className="mt-5">
        <h2 className="mb-3 text-section font-semibold text-ink-strong">{SECTIONS.B}</h2>
        <div className="grid grid-cols-4 gap-3">
          <BucketCard q={q('purpose')} />
          <BucketCard q={q('visitCount')} />
          <div className="col-span-2">
            <BucketCard q={q('infoSource')} multi />
          </div>
        </div>
      </div>

      {/* 향후·의견(F) */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <BucketCard q={q('future')} multi />
        </div>
        <div className="col-span-2">
          <BucketCard q={q('best')} />
        </div>
      </div>

      <div className="mt-5">
        <Section title="개선 의견" right={<span className="tnum text-caption text-ink-muted">{ops.length}건</span>}>
          {ops.length === 0 ? (
            <p className="text-body text-ink-faint">—</p>
          ) : (
            <ul className="space-y-2">
              {ops.map((o, i) => (
                <li key={i} className="rounded-lg border border-line bg-page px-3 py-2 text-label text-ink-strong">
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
