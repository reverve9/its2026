import { useState } from 'react'
import { PageHeader, Section } from '../../../components/layout'
import { useLiveVersion } from '../../../lib/useLive'
import {
  PERFORMANCES, EXPERIENCES, HIGHLIGHTS,
  addPerformance, addExperience, addHighlight,
} from '../../../lib/visitorContent'

// 프로그램(콘텐츠 갈래) — 방문객앱 발행 프로그램 등록·조회. CMS 없음(D54)이라 실 편집은 코드지만,
// 운영본부가 공연·체험·홈 하이라이트를 등록하는 개념을 보인다. 등록은 in-memory·리로드 시 시드 복귀.
// org='조직위' = 조직위 운영 구역(나머지 강릉시 부대행사).

type Mode = 'perf' | 'exp' | 'high'

function OrgBadge() {
  return <span className="ml-1.5 rounded bg-primary-50 px-1.5 py-0.5 text-caption font-semibold text-primary-700">조직위</span>
}

function ModeTab({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-label font-semibold transition ${
        on ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'
      }`}
    >
      {children}
    </button>
  )
}

const inputCls =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-label outline-none focus:border-primary-600'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-caption font-semibold text-ink-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export default function Programs() {
  useLiveVersion() // 등록 시 목록 재조회

  const [mode, setMode] = useState<Mode>('perf')
  // 공연
  const [time, setTime] = useState('')
  const [pTitle, setPTitle] = useState('')
  const [pPlace, setPPlace] = useState('')
  const [pOrg, setPOrg] = useState(false)
  // 체험
  const [eTitle, setETitle] = useState('')
  const [ePlace, setEPlace] = useState('')
  const [eOrg, setEOrg] = useState(false)
  // 하이라이트
  const [tag, setTag] = useState('')
  const [hTitle, setHTitle] = useState('')
  const [hPlace, setHPlace] = useState('')

  const canPost =
    mode === 'perf' ? time.trim() !== '' && pTitle.trim() !== '' && pPlace.trim() !== ''
    : mode === 'exp' ? eTitle.trim() !== '' && ePlace.trim() !== ''
    : tag.trim() !== '' && hTitle.trim() !== '' && hPlace.trim() !== ''

  const submit = () => {
    if (!canPost) return
    if (mode === 'perf') {
      addPerformance({ time: time.trim(), title: pTitle.trim(), place: pPlace.trim(), ...(pOrg ? { org: '조직위' as const } : {}) })
      setTime(''); setPTitle(''); setPPlace(''); setPOrg(false)
    } else if (mode === 'exp') {
      addExperience({ title: eTitle.trim(), place: ePlace.trim(), ...(eOrg ? { org: '조직위' as const } : {}) })
      setETitle(''); setEPlace(''); setEOrg(false)
    } else {
      addHighlight({ tag: tag.trim(), title: hTitle.trim(), place: hPlace.trim() })
      setTag(''); setHTitle(''); setHPlace('')
    }
  }

  const perfOrg = PERFORMANCES.filter((p) => p.org).length
  const perfSorted = [...PERFORMANCES].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div>
      <PageHeader
        title="프로그램"
        summary={`방문객앱 발행 — 공연 ${PERFORMANCES.length} · 체험 ${EXPERIENCES.length} · 홈 하이라이트 ${HIGHLIGHTS.length}`}
      />

      <div className="grid grid-cols-[minmax(0,22rem)_1fr] items-start gap-5">
        {/* 등록 */}
        <Section title="등록">
          <div className="flex flex-wrap gap-1.5">
            <ModeTab on={mode === 'perf'} onClick={() => setMode('perf')}>공연</ModeTab>
            <ModeTab on={mode === 'exp'} onClick={() => setMode('exp')}>체험·포토존</ModeTab>
            <ModeTab on={mode === 'high'} onClick={() => setMode('high')}>홈 하이라이트</ModeTab>
          </div>

          <div className="mt-3 space-y-2">
            {mode === 'perf' && (
              <>
                <Field label="시간"><input value={time} onChange={(e) => setTime(e.target.value)} placeholder="11:00" className={`tnum ${inputCls}`} /></Field>
                <Field label="프로그램명"><input value={pTitle} onChange={(e) => setPTitle(e.target.value)} placeholder="개막 축하공연" className={inputCls} /></Field>
                <Field label="장소"><input value={pPlace} onChange={(e) => setPPlace(e.target.value)} placeholder="공연구역" className={inputCls} /></Field>
                <label className="flex cursor-pointer items-center gap-2 pt-1 text-label text-ink-base">
                  <input type="checkbox" checked={pOrg} onChange={() => setPOrg((v) => !v)} /> 조직위 운영
                </label>
              </>
            )}
            {mode === 'exp' && (
              <>
                <Field label="명칭"><input value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="ITS 상징 포토존" className={inputCls} /></Field>
                <Field label="장소"><input value={ePlace} onChange={(e) => setEPlace(e.target.value)} placeholder="도시홍보 구역" className={inputCls} /></Field>
                <label className="flex cursor-pointer items-center gap-2 pt-1 text-label text-ink-base">
                  <input type="checkbox" checked={eOrg} onChange={() => setEOrg((v) => !v)} /> 조직위 운영
                </label>
              </>
            )}
            {mode === 'high' && (
              <>
                <Field label="태그"><input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="오늘" className={inputCls} /></Field>
                <Field label="제목"><input value={hTitle} onChange={(e) => setHTitle(e.target.value)} placeholder="19:00 드론 라이트 쇼" className={inputCls} /></Field>
                <Field label="장소"><input value={hPlace} onChange={(e) => setHPlace(e.target.value)} placeholder="올림픽파크 상공" className={inputCls} /></Field>
              </>
            )}
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={!canPost}
              className="rounded-lg bg-primary-600 px-5 py-2 text-label font-bold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              등록
            </button>
          </div>
        </Section>

        {/* 목록 */}
        <div className="space-y-5">
          <Section
            title="공연 타임테이블"
            bodyClassName="p-0"
            right={<span className="tnum text-caption text-ink-muted">{PERFORMANCES.length}건 · 조직위 {perfOrg}</span>}
          >
            <table className="w-full text-label">
              <thead>
                <tr className="border-b border-line bg-neutral-50 text-caption text-ink-muted">
                  <th className="px-4 py-2.5 text-left font-semibold">시간</th>
                  <th className="px-4 py-2.5 text-left font-semibold">프로그램</th>
                  <th className="px-4 py-2.5 text-left font-semibold">장소</th>
                </tr>
              </thead>
              <tbody>
                {perfSorted.map((p, i) => (
                  <tr key={`${p.time}-${p.title}-${i}`} className="border-b border-line-soft last:border-0">
                    <td className="tnum px-4 py-2.5 font-semibold text-primary-700">{p.time}</td>
                    <td className="px-4 py-2.5 font-semibold text-ink-strong">
                      {p.title}
                      {p.org && <OrgBadge />}
                    </td>
                    <td className="px-4 py-2.5 text-ink-muted">{p.place}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <div className="grid grid-cols-2 items-start gap-5">
            <Section title="체험·포토존" right={<span className="tnum text-caption text-ink-muted">{EXPERIENCES.length}건</span>}>
              <ul className="divide-y divide-line-soft">
                {EXPERIENCES.map((e, i) => (
                  <li key={`${e.title}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="text-label font-semibold text-ink-strong">
                      {e.title}
                      {e.org && <OrgBadge />}
                    </div>
                    <div className="mt-0.5 text-caption text-ink-muted">{e.place}</div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section title="홈 하이라이트" right={<span className="tnum text-caption text-ink-muted">{HIGHLIGHTS.length}건</span>}>
              <ul className="divide-y divide-line-soft">
                {HIGHLIGHTS.map((h, i) => (
                  <li key={`${h.title}-${i}`} className="flex items-baseline gap-2 py-2.5 first:pt-0 last:pb-0">
                    <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-base">{h.tag}</span>
                    <div className="min-w-0">
                      <div className="text-label font-semibold text-ink-strong">{h.title}</div>
                      <div className="mt-0.5 text-caption text-ink-muted">{h.place}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )
}
