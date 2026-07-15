import { useState } from 'react'
import {
  getSafety, getSafetyIssues, getZones,
  declareWorkStop, liftWorkStop, declareSuspension, liftSuspension,
  toggleHazard, fileIncidentReport,
} from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import { getNowMin } from '../../../lib/clock'
import { PageHeader, Section, LivePill } from '../../../components/layout'

// 운영중단 사유 프리셋 — 핵심은 문구가 아니라 '범위가 다르다'는 것이다.
// 기상은 야외 거점만 닫고 실내(박물관)는 살린다. 비상사태·애도는 전 거점(zoneIds: null).
// 국가 애도로 전국 행사가 일괄 취소된 선례가 있고, 그것도 전날 예고가 아니라 행사 당일
// 오후에 — 이미 인력이 거점에 배치된 상태에서 — 전파됐다.
const OUTDOOR_ZONES = ['z-gyeongpo', 'z-anmok', 'z-gangmun', 'z-photo', 'z-stage']
const SUSPEND_PRESETS: { label: string; reason: string; zoneIds: string[] | null }[] = [
  { label: '강풍특보', reason: '강풍특보 — 야외 구조물·천막 전도 위험', zoneIds: OUTDOOR_ZONES },
  { label: '폭우', reason: '호우특보 — 야외 활동 위험, 실내 거점은 정상 운영', zoneIds: OUTDOOR_ZONES },
  { label: '국가 비상사태·애도', reason: '국가 애도기간 — 행사 전면 중단', zoneIds: null },
]

export default function Safety() {
  const safety = useLive(getSafety)
  const issues = useLive(getSafetyIssues) ?? []
  const zones = useLive(getZones) ?? []

  const [susReason, setSusReason] = useState('')
  const [susZones, setSusZones] = useState<string[] | null>(null) // null = 전 거점
  const [stopReason, setStopReason] = useState('')
  const [inc, setInc] = useState({ zoneId: '', summary: '', firstAction: '' })
  const [incSent, setIncSent] = useState(false)

  if (!safety) return null
  const ws = safety.workStop
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
        summary="중대재해처벌법 대응 — 작업중지·사고 초동보고·위험요인 점검. SOS·기상특보 전파"
        right={<LivePill label="안전상황실 연결" />}
      />

      {/* 작업중지 발령 배너 */}
      {ws.active && (
        <div className="mb-5 flex items-center gap-4 rounded-xl border-2 border-critical bg-critical-soft px-5 py-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-critical text-2xl text-white">✋</span>
          <div className="min-w-0 flex-1">
            <div className="text-body font-bold text-critical">작업중지 발령 중 · {ws.at}</div>
            <div className="text-label text-ink-base">사유: {ws.reason} — 전 거점 위험작업 중지, 안전 확인 후 재개</div>
          </div>
          <button onClick={() => liftWorkStop()} className="shrink-0 rounded-lg border border-critical bg-surface px-3 py-2 text-label font-semibold text-critical transition hover:bg-critical-soft">
            작업 재개(해제)
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-5">
        {/* 좌 2/3 — 중대재해 대응 */}
        <div className="col-span-2 flex flex-col gap-5">
          {/* 작업중지 발령 */}
          {!ws.active && (
            <Section title="작업중지 발령">
              <p className="text-label text-ink-muted">급박한 위험 시 즉시 작업중지. 발령 사유가 기록되고 전 거점에 전파됩니다.</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={stopReason}
                  onChange={(e) => setStopReason(e.target.value)}
                  placeholder="발령 사유 (예: 강풍 특보 — 무대 구조물 위험)"
                  className="flex-1 rounded-lg border border-line bg-page px-3 py-2 text-label text-ink-strong outline-none focus:border-critical"
                />
                <button
                  onClick={() => { if (stopReason.trim()) { declareWorkStop(stopReason.trim()); setStopReason('') } }}
                  disabled={!stopReason.trim()}
                  className="shrink-0 rounded-lg bg-critical px-4 py-2 text-label font-bold text-white transition hover:bg-critical/90 disabled:opacity-40"
                >
                  작업중지 발령
                </button>
              </div>
            </Section>
          )}

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
              placeholder="초동조치 (예: 부상자 안전지대 이동·119 신고·의료지원반 연계)"
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
                {/* 사유 프리셋 — 범위가 다르다. 기상은 야외 일부, 비상사태는 전 거점. */}
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
                  placeholder="중단 사유 (예: 강풍특보 — 야외 구조물 위험)"
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
                const zn = zones.find((z) => z.id === i.zoneId)?.name ?? i.zoneId
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
