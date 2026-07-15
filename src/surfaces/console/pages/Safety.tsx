import { useState } from 'react'
import {
  getSafety, getSafetyIssues, getZones,
  declareSuspension, liftSuspension,
  toggleHazard, fileIncidentReport,
} from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import { getNowMin } from '../../../lib/clock'
import { PageHeader, Section, LivePill } from '../../../components/layout'

// 운영중단 사유 프리셋 — 실무에서 실제로 반복되는 것만 둔다. 둘 다 기상이고 둘 다 야외 한정:
// 해변·포토존은 닫고 실내(박물관)는 살린다. 프리셋의 값은 문구가 아니라 '범위'다.
//
// ⚠️ '국가 비상사태·애도'를 프리셋에서 뺐다. 전 거점(zoneIds: null) 중단이 필요하다는 걸
// 알려준 사례이긴 하지만 발생 확률이 극히 낮다 — 프리셋 칩으로 강풍·폭우 옆에 나란히 두면
// 상시 대비하는 흔한 조치처럼 읽힌다. 모델(zoneIds: null)은 그대로 있고, 그 경로는 아래
// '전 거점으로 중단' 토글로 사유를 직접 적어 발령한다.
const OUTDOOR_ZONES = ['z-gyeongpo', 'z-anmok', 'z-gangmun', 'z-photo', 'z-stage']
const SUSPEND_PRESETS: { label: string; reason: string; zoneIds: string[] | null }[] = [
  { label: '강풍특보', reason: '강풍특보 — 야외 구조물·천막 전도 위험', zoneIds: OUTDOOR_ZONES },
  { label: '호우특보', reason: '호우특보 — 야외 활동 위험, 실내 거점은 정상 운영', zoneIds: OUTDOOR_ZONES },
]

export default function Safety() {
  const safety = useLive(getSafety)
  const issues = useLive(getSafetyIssues) ?? []
  const zones = useLive(getZones) ?? []

  const [susReason, setSusReason] = useState('')
  const [susZones, setSusZones] = useState<string[] | null>(null) // null = 전 거점
  const [inc, setInc] = useState({ zoneId: '', summary: '', firstAction: '' })
  const [incSent, setIncSent] = useState(false)

  if (!safety) return null
  const sus = safety.suspension
  const checkedCount = safety.hazards.filter((h) => h.checked).length

  const submitIncident = async () => {
    if (!inc.zoneId || !inc.summary.trim()) return
    await fileIncidentReport({
      zoneId: inc.zoneId, summary: inc.summary.trim(), firstAction: inc.firstAction.trim() || '조치 진행 중',
      ts: getNowMin(), idempotencyKey: `incident:${inc.zoneId}:${getNowMin()}`,
    })
    setInc({ zoneId: '', summary: '', firstAction: '' })
    setIncSent(true)
  }

  return (
    <div>
      <PageHeader
        title="안전·비상 관제"
        summary="중대재해처벌법 대응 — 사고 초동보고·위험요인 점검. 운영중단·SOS 전파"
        right={<LivePill label="안전상황실 연결" />}
      />

      <div className="grid grid-cols-3 gap-5">
        {/* 좌 2/3 — 중대재해 대응 */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* 사고 초동보고 */}
          <Section title="사고 초동보고">
            <div className="grid grid-cols-2 gap-3">
              <select
                value={inc.zoneId}
                onChange={(e) => { setInc({ ...inc, zoneId: e.target.value }); setIncSent(false) }}
                className="rounded-lg border border-line bg-page px-3 py-2 text-label text-ink-strong outline-none focus:border-primary-400"
              >
                <option value="">거점 선택</option>
                {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
              <input
                value={inc.summary}
                onChange={(e) => { setInc({ ...inc, summary: e.target.value }); setIncSent(false) }}
                placeholder="사고 개요"
                className="rounded-lg border border-line bg-page px-3 py-2 text-label text-ink-strong outline-none focus:border-primary-400"
              />
            </div>
            <input
              value={inc.firstAction}
              onChange={(e) => { setInc({ ...inc, firstAction: e.target.value }); setIncSent(false) }}
              placeholder="초동조치"
              className="mt-3 w-full rounded-lg border border-line bg-page px-3 py-2 text-label text-ink-strong outline-none focus:border-primary-400"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={submitIncident}
                disabled={!inc.zoneId || !inc.summary.trim()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-label font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
              >
                초동보고 접수
              </button>
              {incSent && <span className="text-label text-ok">접수됨 — 상황판·이슈 대장에 반영. 보고라인 전파.</span>}
            </div>
          </Section>

          {/* 위험요인 점검표 */}
          <Section
            title="위험요인 점검표"
            right={<span className={`text-caption font-semibold ${checkedCount === safety.hazards.length ? 'text-ok' : 'text-warn'}`}>{checkedCount}/{safety.hazards.length} 점검</span>}
            bodyClassName="px-4 py-1"
          >
            <div className="divide-y divide-line-soft">
              {safety.hazards.map((h) => (
                <button
                  key={h.id}
                  onClick={() => toggleHazard(h.id, !h.checked)}
                  className="flex w-full items-center gap-3 py-2.5 text-left"
                >
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] ${h.checked ? 'border-ok bg-ok text-white' : 'border-line text-transparent'}`}>✓</span>
                  <span className={`min-w-0 flex-1 text-label ${h.checked ? 'text-ink-base' : 'text-ink-strong'}`}>{h.label}</span>
                  {h.checked && h.checkedAt && <span className="tnum shrink-0 text-caption text-ink-faint">{h.checkedAt}</span>}
                  {!h.checked && <span className="shrink-0 rounded bg-warn-soft px-1.5 py-0.5 text-caption font-semibold text-warn">미점검</span>}
                </button>
              ))}
            </div>
          </Section>
        </div>

        {/* 우 1/3 — 긴급 상황 + 전파 */}
        <div className="col-span-1 flex flex-col gap-5">
          {/* 운영중단 전파 — 작업중지와 다른 조치다(대상: 거점에 선 봉사자·거점관리자) */}
          <Section title="운영중단 전파">
            {sus.active ? (
              <div className="rounded-lg bg-warn-soft px-3 py-2.5">
                <div className="text-label font-bold text-warn">
                  {sus.zoneIds === null ? '전 거점' : `${sus.zoneIds.length}개 거점`} 운영중단 전파 중 · {sus.at}
                </div>
                <div className="mt-0.5 text-caption text-ink-base">사유: {sus.reason}</div>
                <div className="mt-1 text-caption text-ink-muted">
                  {sus.zoneIds === null
                    ? '전 거점 현장앱 상단에 표시 중 — 봉사자·거점관리자 전원.'
                    : `대상 거점 현장앱 상단에 표시 중 — ${sus.zoneIds.map((id) => zones.find((z) => z.id === id)?.name ?? id).join(', ')}`}
                </div>
                <button onClick={() => liftSuspension()} className="mt-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-caption font-semibold text-ink-muted hover:bg-neutral-100">전파 해제(운영 재개)</button>
              </div>
            ) : (
              <>
                <p className="text-label text-ink-muted">
                  거점 운영을 중단하고 현장앱에 즉시 전파합니다. 대상 거점의 근무공백 경보는 중단 중 멈춥니다.
                </p>
                {/* 사유 프리셋 — 값은 문구가 아니라 범위다(야외 5개 거점). */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SUSPEND_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setSusReason(p.reason); setSusZones(p.zoneIds) }}
                      className="rounded-md border border-line bg-surface px-2 py-1 text-caption font-semibold text-ink-muted transition hover:bg-neutral-100"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <input
                  value={susReason}
                  onChange={(e) => setSusReason(e.target.value)}
                  placeholder="중단 사유"
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-label outline-none focus:border-primary-600"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-caption font-semibold text-ink-muted">
                    대상 {susZones === null ? '전 거점(토털)' : `${susZones.length}개 거점`}
                  </span>
                  <button
                    onClick={() => setSusZones(susZones === null ? [] : null)}
                    className="text-caption font-semibold text-primary-700 hover:underline"
                  >
                    {susZones === null ? '거점 골라서 중단' : '전 거점으로 중단'}
                  </button>
                </div>
                {susZones !== null && (
                  <div className="mt-1.5 max-h-40 overflow-auto rounded-lg border border-line-soft p-2">
                    {zones.map((z) => (
                      <label key={z.id} className="flex cursor-pointer items-center gap-2 py-1 text-caption text-ink-base">
                        <input
                          type="checkbox"
                          checked={susZones.includes(z.id)}
                          onChange={(e) =>
                            setSusZones(e.target.checked ? [...susZones, z.id] : susZones.filter((x) => x !== z.id))
                          }
                        />
                        {z.name}
                      </label>
                    ))}
                  </div>
                )}
                <button
                  onClick={async () => { await declareSuspension(susReason.trim(), susZones); setSusReason(''); setSusZones(null) }}
                  disabled={!susReason.trim() || (susZones !== null && susZones.length === 0)}
                  className="mt-3 w-full rounded-lg bg-warn px-4 py-2.5 text-label font-bold text-white transition hover:bg-warn/90 disabled:opacity-40"
                >
                  운영중단 전파
                </button>
              </>
            )}
          </Section>

          {/* 긴급 상황판 */}
          <Section
            title="긴급 · SOS 상황판"
            right={<span className="tnum rounded-full bg-critical-soft px-2 py-0.5 text-caption font-bold text-critical">{issues.filter((i) => i.status !== 'resolved').length}</span>}
            bodyClassName="px-4 py-1"
          >
            <div className="divide-y divide-line-soft">
              {issues.length === 0 && <div className="py-6 text-center text-label text-ink-faint">접수된 안전사고 없음</div>}
              {issues.map((i) => {
                const zn = i.zoneId ? zones.find((z) => z.id === i.zoneId)?.name ?? i.zoneId : '운영본부'
                return (
                  <div key={i.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-label font-semibold text-ink-strong">{zn}</span>
                      <span className="tnum shrink-0 text-caption text-ink-faint">{i.time}</span>
                    </div>
                    <p className="mt-0.5 text-label leading-snug text-ink-base">{i.message}</p>
                    <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-caption font-semibold ${i.status === 'resolved' ? 'bg-ok-soft text-ok' : i.status === 'in_progress' ? 'bg-warn-soft text-warn' : 'bg-critical-soft text-critical'}`}>
                      {i.status === 'resolved' ? '완료' : i.status === 'in_progress' ? '처리중' : '접수'}
                    </span>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* 의료지원반 */}
          <Section title="의료지원반 연계">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-label font-semibold text-ink-strong">현장 의료지원반</div>
                <div className="text-caption text-ink-muted">응급·부상 즉시 연계</div>
              </div>
              <a href="tel:0330001004" className="rounded-lg bg-primary-600 px-3 py-2 text-label font-semibold text-white transition hover:bg-primary-700">연계 호출</a>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
