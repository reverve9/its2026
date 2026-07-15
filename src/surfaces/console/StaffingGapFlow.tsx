import { useState } from 'react'
import { getZone, getReserveOptions, assignReserve } from '../../lib/services'
import { useLive } from '../../lib/useLive'

// 근무공백 대응 3단계 플로우(B) — 경보 → 예비 선택(외국어·거리) → 배치 확정.
// 핸드오프 최강 카드: 교대 시각 오후조 미출근 → 원격 예비 투입.

export default function StaffingGapFlow({ zoneId, zoneName, onClose }: { zoneId: string; zoneName: string; onClose: () => void }) {
  const zone = useLive(() => getZone(zoneId), [zoneId])
  const options = useLive(() => getReserveOptions(zoneId), [zoneId]) ?? []
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [langOnly, setLangOnly] = useState(false)
  const [eduOnly, setEduOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [placedNames, setPlacedNames] = useState<string[]>([])

  const shortfall = zone ? Math.max(0, zone.quota - zone.present) : 0
  const list = options.filter((o) => (!langOnly || o.langMatch) && (!eduOnly || o.educated))

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < Math.max(shortfall, 1)) next.add(id)
      return next
    })
  }

  const confirm = async () => {
    setBusy(true)
    const names = options.filter((o) => selected.has(o.assignment.id)).map((o) => o.assignment.personName)
    for (const id of selected) {
      await assignReserve(`gap:${zoneId}`, id)
    }
    setPlacedNames(names)
    setBusy(false)
    setStep(2)
  }

  const StepDot = ({ n, label }: { n: number; label: string }) => (
    <div className="flex items-center gap-1.5">
      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${step >= n ? 'bg-primary-600 text-white' : 'bg-neutral-200 text-ink-faint'}`}>{n + 1}</span>
      <span className={`text-caption font-semibold ${step >= n ? 'text-ink-strong' : 'text-ink-faint'}`}>{label}</span>
    </div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/40 p-4" onClick={onClose}>
      <div className="flex max-h-[86vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-lg" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 + 스텝 인디케이터 */}
        <div className="border-b border-line px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="font-title text-title font-medium text-ink-strong">근무공백 대응</div>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-neutral-100" aria-label="닫기">✕</button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <StepDot n={0} label="경보 확인" />
            <span className="h-px flex-1 bg-line" />
            <StepDot n={1} label="예비 선택" />
            <span className="h-px flex-1 bg-line" />
            <StepDot n={2} label="배치 확정" />
          </div>
        </div>

        <div className="overflow-auto p-6">
          {/* STEP 0 — 경보 확인 */}
          {step === 0 && (
            <div>
              <div className="rounded-xl border border-critical/30 bg-critical-soft p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-critical px-1.5 py-0.5 text-caption font-bold text-white">경보</span>
                  <span className="text-body font-semibold text-ink-strong">{zoneName} 근무공백</span>
                </div>
                <p className="mt-2 text-label text-ink-base">
                  오후조 배정 <b className="tnum">{zone?.quota ?? '—'}</b>명 중 <b className="tnum">{zone?.present ?? '—'}</b>명 근무 —
                  <b className="text-critical"> {shortfall}명 부족</b>. 교대 직후 미출근으로 판정.
                </p>
              </div>
              <p className="mt-3 text-label text-ink-muted">
                관광지 무인 거점의 근무공백은 즉시 운영본부 보고 대상입니다. 대기 예비인력을 원격 투입합니다.
              </p>
              <div className="mt-5 flex justify-end">
                <button onClick={() => setStep(1)} className="rounded-lg bg-primary-600 px-4 py-2.5 text-label font-semibold text-white transition hover:bg-primary-700">예비인력 선택 →</button>
              </div>
            </div>
          )}

          {/* STEP 1 — 예비 선택 */}
          {step === 1 && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-label text-ink-muted">최대 <b className="tnum text-ink-strong">{Math.max(shortfall, 1)}</b>명 선택 · 교육 이수자 우선</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setEduOnly((v) => !v)}
                    className={`rounded-full px-3 py-1 text-caption font-semibold transition ${eduOnly ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-ink-muted'}`}
                  >
                    교육 이수자만
                  </button>
                  <button
                    onClick={() => setLangOnly((v) => !v)}
                    className={`rounded-full px-3 py-1 text-caption font-semibold transition ${langOnly ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-ink-muted'}`}
                  >
                    외국어 가능만
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {list.map((o) => {
                  const on = selected.has(o.assignment.id)
                  return (
                    <button
                      key={o.assignment.id}
                      onClick={() => toggle(o.assignment.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${on ? 'border-primary-400 bg-primary-50' : 'border-line bg-page hover:border-primary-200'}`}
                    >
                      <span className={`grid h-5 w-5 place-items-center rounded-md border text-[11px] ${on ? 'border-primary-600 bg-primary-600 text-white' : 'border-line text-transparent'}`}>✓</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-label font-semibold text-ink-strong">{o.assignment.personName}</span>
                          {o.langMatch && <span className="rounded bg-info-soft px-1.5 py-0.5 text-caption font-semibold text-info">{o.assignment.lang?.join('·')}</span>}
                          {/* 교육 미이수 = soft 경고. 선택은 막지 않는다. */}
                          {!o.educated && (
                            <span className="rounded bg-warn-soft px-1.5 py-0.5 text-caption font-semibold text-warn">교육 미이수</span>
                          )}
                        </div>
                        <div className="tnum text-caption text-ink-muted">{o.assignment.phone}</div>
                      </div>
                      <span className="tnum shrink-0 text-label font-semibold text-ink-base">{o.distanceKm ?? '—'}km</span>
                    </button>
                  )
                })}
                {list.length === 0 && <div className="py-6 text-center text-label text-ink-faint">조건에 맞는 예비인력이 없습니다.</div>}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <button onClick={() => setStep(0)} className="text-label text-ink-muted hover:text-ink-strong">← 경보</button>
                <button
                  onClick={confirm}
                  disabled={selected.size === 0 || busy}
                  className="rounded-lg bg-primary-600 px-4 py-2.5 text-label font-semibold text-white transition hover:bg-primary-700 disabled:opacity-40"
                >
                  {busy ? '배치 중…' : `${selected.size}명 배치 확정`}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — 완료 */}
          {step === 2 && (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-ok-soft text-2xl">✓</div>
              <div className="mt-3 text-body font-semibold text-ink-strong">배치 완료 — 경보 해소</div>
              <p className="mt-1 text-label text-ink-muted">
                {zoneName}에 <b className="text-ink-strong">{placedNames.join(' · ')}</b> 투입. 즉시 체크인 처리되어 대시보드·로스터에 반영되었습니다.
              </p>
              <button onClick={onClose} className="mt-5 rounded-lg bg-primary-600 px-5 py-2.5 text-label font-semibold text-white transition hover:bg-primary-700">확인</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
