import { useState } from 'react'
import { PageHeader, Section } from '../../../components/layout'
import { useLiveVersion } from '../../../lib/useLive'
import { getNowDate } from '../../../lib/clock'
import { VISITOR_NOTICES, FAQS, addVisitorNotice, addFaq } from '../../../lib/visitorContent'

// 공지사항 및 FAQ(콘텐츠 갈래) — 방문객앱 헤더 메뉴 발행분 등록·조회.
// CMS 없음(D54)이라 실 편집은 코드지만, 운영본부가 방문객 발행 공지·FAQ 를 등록하는 개념을 보인다
// (발령 화면 없이 시드만 두던 Notices 의 구멍을 메운 것과 같은 취지). 등록은 in-memory·리로드 시 시드 복귀.
// 운영 상황전파용 Notices(발령·시각 파생)와는 별개 — 이건 방문객 헤더 메뉴에 뜨는 고정 공지·FAQ.

type Mode = 'notice' | 'faq'

// 오늘 날짜 → 공지 날짜 기본값(MM.DD).
const todayMD = (): string => {
  const [, m, d] = getNowDate().split('-')
  return `${m}.${d}`
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

export default function ContentBoard() {
  useLiveVersion() // 등록 시 목록 재조회

  const [mode, setMode] = useState<Mode>('notice')
  // 공지 필드
  const [date, setDate] = useState(todayMD())
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  // FAQ 필드
  const [q, setQ] = useState('')
  const [a, setA] = useState('')

  const canPost =
    mode === 'notice' ? title.trim() !== '' && body.trim() !== '' : q.trim() !== '' && a.trim() !== ''

  const submit = () => {
    if (!canPost) return
    if (mode === 'notice') {
      addVisitorNotice({ date: date.trim() || todayMD(), title: title.trim(), body: body.trim() })
      setTitle(''); setBody(''); setDate(todayMD())
    } else {
      addFaq({ q: q.trim(), a: a.trim() })
      setQ(''); setA('')
    }
  }

  return (
    <div>
      <PageHeader title="공지사항 및 FAQ" summary="방문객앱 헤더 메뉴 발행 등록 — 공지사항 · 자주 묻는 질문" />

      <div className="grid grid-cols-2 items-start gap-5">
        {/* 등록 */}
        <Section title="등록">
          <div className="flex gap-1.5">
            <ModeTab on={mode === 'notice'} onClick={() => setMode('notice')}>공지사항</ModeTab>
            <ModeTab on={mode === 'faq'} onClick={() => setMode('faq')}>FAQ</ModeTab>
          </div>

          {mode === 'notice' ? (
            <div className="mt-3 space-y-2">
              <div>
                <span className="text-caption font-semibold text-ink-muted">날짜</span>
                <input value={date} onChange={(e) => setDate(e.target.value)} placeholder="10.21" className={`tnum mt-1 ${inputCls}`} />
              </div>
              <div>
                <span className="text-caption font-semibold text-ink-muted">제목</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목" className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <span className="text-caption font-semibold text-ink-muted">본문</span>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="공지 본문" rows={4} className={`mt-1 resize-none leading-snug ${inputCls}`} />
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div>
                <span className="text-caption font-semibold text-ink-muted">질문</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="자주 묻는 질문" className={`mt-1 ${inputCls}`} />
              </div>
              <div>
                <span className="text-caption font-semibold text-ink-muted">답변</span>
                <textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="답변" rows={4} className={`mt-1 resize-none leading-snug ${inputCls}`} />
              </div>
            </div>
          )}

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
          <Section title="공지사항" right={<span className="tnum text-caption text-ink-muted">{VISITOR_NOTICES.length}건</span>}>
            <ul className="divide-y divide-line-soft">
              {VISITOR_NOTICES.map((n, i) => (
                <li key={`${n.date}-${n.title}-${i}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline gap-2">
                    <span className="tnum shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-caption font-semibold text-ink-base">{n.date}</span>
                    <span className="text-label font-semibold text-ink-strong">{n.title}</span>
                  </div>
                  <p className="mt-1 text-label text-ink-muted">{n.body}</p>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="자주 묻는 질문" right={<span className="tnum text-caption text-ink-muted">{FAQS.length}건</span>}>
            <ul className="divide-y divide-line-soft">
              {FAQS.map((f, i) => (
                <li key={`${f.q}-${i}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline gap-2">
                    <span className="shrink-0 text-label font-bold text-primary-700">Q</span>
                    <span className="text-label font-semibold text-ink-strong">{f.q}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="shrink-0 text-label font-bold text-ink-faint">A</span>
                    <p className="text-label text-ink-muted">{f.a}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}
