import { useState } from 'react'
import { getNotices, getZones, postNotice, describeAudience } from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import type { Audience, StaffRole } from '../../../types'
import { PageHeader, Section } from '../../../components/layout'

// 본부→현장 나가는 길. 지금까지 공지는 시드만 있고 발령하는 화면이 없었다 — 이 페이지가 그 구멍이다.
// '추후 작성(compose) UI 를 이 페이지에 몰아넣는다'는 방침이라(사용자 지시) 이름은 넓게 '공지 및 안내'.
//
// 대상은 단일 축(구분)이다 — 구분과 역할을 따로 두지 않는다. 데이터상 자원봉사자·거점관리자·
// 현장운영이 전부 역할(StaffRole) 축 하나로 표현되기 때문이다(자원봉사자 = role '봉사자').
// 전부 같은 축(roles)이라야 여럿 고를 때 OR 로 합쳐진다 — kinds 와 섞으면 축 사이 AND 라
// '자원봉사자 그리고 거점관리자' 교집합(공집합)이 되어 아무에게도 안 간다.
//
// D26: 화면엔 해설·범례·내부용어를 쓰지 않는다. 필드 라벨(구분·거점)만 쓰고 규칙 설명은
// 주석으로 — 대신 describeAudience 로 대상을 데이터(전원/자원봉사자/…)로 보여준다.
const TARGETS: { role: StaffRole; label: string }[] = [
  { role: '봉사자', label: '자원봉사자' }, // role '봉사자' = 자원봉사자. 표시는 자원봉사자로 통일
  { role: '거점관리자', label: '거점관리자' },
  { role: '현장운영', label: '현장운영' },
]

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v]
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
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

export default function Notices() {
  const notices = useLive(getNotices) ?? []
  const zones = useLive(getZones) ?? []

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [roles, setRoles] = useState<StaffRole[]>([])
  const [admin, setAdmin] = useState(false) // 운영본부(슈퍼어드민) — role 이 아니라 신원. 구분 축에서 roles 와 OR
  const [zoneIds, setZoneIds] = useState<string[]>([])

  // 축이 비면 그 축은 audience 에 넣지 않는다(=거르지 않는다). 전부 비면 {} = 전원.
  const audience: Audience = {
    ...(roles.length ? { roles } : {}),
    ...(admin ? { admin: true } : {}),
    ...(zoneIds.length ? { zoneIds } : {}),
  }

  const canPost = title.trim() !== '' && body.trim() !== ''

  const post = async () => {
    if (!canPost) return
    await postNotice({ title: title.trim(), body: body.trim(), audience })
    setTitle(''); setBody(''); setRoles([]); setAdmin(false); setZoneIds([])
  }

  return (
    <div>
      <PageHeader title="공지 및 안내" />

      <div className="grid grid-cols-2 items-start gap-5">
        <Section title="공지 작성">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-label outline-none focus:border-primary-600"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="본문"
            rows={4}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-label leading-snug outline-none focus:border-primary-600"
          />

          <div className="mt-3 space-y-2">
            <div>
              <span className="text-caption font-semibold text-ink-muted">구분</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {TARGETS.map((t) => (
                  <Pill key={t.role} on={roles.includes(t.role)} onClick={() => setRoles(toggle(roles, t.role))}>{t.label}</Pill>
                ))}
                <Pill on={admin} onClick={() => setAdmin(!admin)}>운영본부</Pill>
              </div>
            </div>
            <div>
              <span className="text-caption font-semibold text-ink-muted">거점</span>
              <div className="mt-1 max-h-40 overflow-auto rounded-lg border border-line-soft p-2">
                {zones.map((z) => (
                  <label key={z.id} className="flex cursor-pointer items-center gap-2 py-1 text-caption text-ink-base">
                    <input
                      type="checkbox"
                      checked={zoneIds.includes(z.id)}
                      onChange={() => setZoneIds(toggle(zoneIds, z.id))}
                    />
                    {z.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-caption font-semibold text-ink-muted">
              대상 <span className="text-ink-strong">{describeAudience(audience, zones)}</span>
            </span>
            <button
              type="button"
              onClick={post}
              disabled={!canPost}
              className="rounded-lg bg-primary-600 px-5 py-2 text-label font-bold text-white transition hover:bg-primary-700 disabled:opacity-40"
            >
              작성
            </button>
          </div>
        </Section>

        <Section title={`작성된 공지 (${notices.length})`}>
          {notices.length === 0 && (
            <p className="py-2 text-label text-ink-muted">아직 작성된 공지가 없습니다.</p>
          )}
          <div className="divide-y divide-line-soft">
            {notices.map((n) => (
              <div key={n.id} className="py-2.5 first:pt-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-label font-semibold text-ink-strong">{n.title}</span>
                  <span className="tnum shrink-0 text-caption text-ink-faint">{n.time}</span>
                </div>
                <p className="mt-0.5 text-label leading-snug text-ink-base">{n.body}</p>
                <span className="mt-1 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-ink-muted">
                  {describeAudience(n.audience, zones)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
