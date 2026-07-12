import { useEffect, useState } from 'react'
import type { Zone, OpsAlert, KpiSummary } from '../../../types'
import { getZones, getAlerts, getKpi, getRecentEvents } from '../../../lib/services'
import { StatTile, Fill, statusMeta } from '../../../components/ui'

const alertMeta = {
  critical: { dot: 'bg-danger', ring: 'border-l-danger', tag: '경보', tagCls: 'bg-red-50 text-danger' },
  warning: { dot: 'bg-warn', ring: 'border-l-warn', tag: '주의', tagCls: 'bg-amber-50 text-warn' },
  info: { dot: 'bg-brand-500', ring: 'border-l-brand-500', tag: '정보', tagCls: 'bg-brand-50 text-brand-600' },
} as const

// 상황판 지도 좌표 (스키마틱, %)
const pin: Record<string, { x: number; y: number }> = {
  'z-jumunjin': { x: 48, y: 12 },
  'z-gyeongpo': { x: 82, y: 26 },
  'z-gangmun': { x: 87, y: 56 },
  'z-anmok': { x: 74, y: 84 },
  'z-market': { x: 38, y: 85 },
  'z-ojuk': { x: 13, y: 52 },
}

export default function Dashboard() {
  const [zones, setZones] = useState<Zone[]>([])
  const [alerts, setAlerts] = useState<OpsAlert[]>([])
  const [kpi, setKpi] = useState<KpiSummary | null>(null)
  const [recent, setRecent] = useState<Awaited<ReturnType<typeof getRecentEvents>>>([])

  useEffect(() => {
    getZones().then(setZones)
    getAlerts().then(setAlerts)
    getKpi().then(setKpi)
    getRecentEvents().then(setRecent)
  }, [])

  const venue = zones.filter((z) => z.kind === 'venue')
  const tourist = zones.filter((z) => z.kind === 'tourist')
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? ''

  return (
    <div className="mx-auto max-w-[1200px] space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">자원봉사 관제</h1>
          <p className="text-sm text-slate-500">전 거점 자원봉사자 출결·배치·근무공백을 한 화면에서 관제</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-danger">
            <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
            근무공백 경보 {kpi?.gapAlerts ?? 0}건
          </span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-6 gap-3">
        <StatTile label="총 자원봉사자" value={kpi?.total ?? 0} unit="명" tone="brand" hint="1일 2교대 운영" />
        <StatTile label="현재 근무중" value={kpi?.onDuty ?? 0} unit="명" tone="ok" hint="오전조" />
        <StatTile label="휴게·이동" value={kpi?.breakOrMoving ?? 0} unit="명" tone="warn" />
        <StatTile label="미출근" value={kpi?.absent ?? 0} unit="명" tone="danger" />
        <StatTile label="근무공백 경보" value={kpi?.gapAlerts ?? 0} unit="거점" tone="danger" hint="정원 미달" />
        <StatTile label="투입가능 예비" value={kpi?.reserveAvailable ?? 0} unit="명" tone="ok" hint="즉시 배치" />
      </div>

      {/* Row A: 지도 + 알림 */}
      <div className="grid grid-cols-3 gap-5">
        <section className="card col-span-2 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">거점 상황판</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ok" />정상</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger" />공백</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />행사장</span>
            </div>
          </div>
          <MapBoard tourist={tourist} venuePresent={venue.reduce((s, z) => s + z.present, 0)} venueQuota={venue.reduce((s, z) => s + z.quota, 0)} />
        </section>

        <section className="card col-span-1 flex flex-col p-5">
          <h2 className="mb-3 font-semibold text-slate-900">실시간 알림 · 이상치</h2>
          <div className="space-y-2">
            {alerts.map((a) => {
              const m = alertMeta[a.level]
              return (
                <div key={a.id} className={`rounded-lg border border-slate-100 border-l-[3px] ${m.ring} bg-slate-50/60 p-2.5`}>
                  <div className="flex items-center justify-between">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${m.tagCls}`}>{m.tag}</span>
                    <span className="tnum text-xs text-slate-400">{a.time}</span>
                  </div>
                  <div className="mt-1 text-[13px] font-medium text-slate-700">{a.zoneName}</div>
                  <div className="text-xs leading-snug text-slate-500">{a.message}</div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Row B: 거점 현황 + 최근 이벤트 */}
      <div className="grid grid-cols-3 gap-5">
        <section className="card col-span-2 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">거점별 근무 현황</h2>
            <span className="text-xs text-slate-400">유인(관리자 스캔) {venue.length} · 무인(셀프 GPS) {tourist.length}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="pb-2 font-medium">거점</th>
                <th className="pb-2 font-medium">구분</th>
                <th className="pb-2 font-medium">체크 방식</th>
                <th className="pb-2 text-right font-medium">충원</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id} className="border-b border-slate-50">
                  <td className="py-2 font-medium text-slate-800">{z.name}</td>
                  <td className="py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${z.kind === 'venue' ? 'bg-brand-50 text-brand-600' : 'bg-teal-50 text-teal-600'}`}>
                      {z.kind === 'venue' ? '행사장' : '관광지'}
                    </span>
                  </td>
                  <td className="py-2 text-xs text-slate-500">{z.checkMode === 'manager_scan' ? '관리자 스캔' : 'GPS 셀프'}</td>
                  <td className="py-2">
                    <div className="flex justify-end"><Fill present={z.present} quota={z.quota} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card col-span-1 p-5">
          <h2 className="mb-3 font-semibold text-slate-900">최근 출결 이벤트</h2>
          <div className="space-y-3">
            {recent.map((e, i) => {
              const m = statusMeta[e.status]
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="tnum w-11 shrink-0 text-xs text-slate-400">{e.checkedInAt}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-800">
                      {e.name} <span className="font-normal text-slate-400">· {zoneName(e.zoneId)}</span>
                    </div>
                  </div>
                  <span className={`text-xs font-medium ${m.text}`}>{m.label}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 rounded-lg bg-teal-50 p-3 text-xs leading-relaxed text-teal-700">
            무인 관광지 거점은 봉사자 <b>GPS 셀프 체크인</b>, 유인 행사장 거점은 <b>관리자 스캔</b>으로 출결을 기록합니다.
          </div>
        </section>
      </div>
    </div>
  )
}

function MapBoard({ tourist, venuePresent, venueQuota }: { tourist: Zone[]; venuePresent: number; venueQuota: number }) {
  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-lg bg-gradient-to-br from-brand-50 to-teal-50/50 ring-1 ring-slate-100">
      {/* 해안선 느낌의 장식 */}
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <path d="M 0 90 Q 40 60 90 80 T 200 70 T 340 95 T 500 80 L 500 0 L 0 0 Z" fill="rgba(37,99,235,0.04)" />
      </svg>

      {/* 중앙: 올림픽파크 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-xl border-2 border-brand-500 bg-white/90 px-4 py-3 text-center shadow-md">
          <div className="text-xs font-semibold text-brand-700">올림픽파크 부대행사장</div>
          <div className="tnum mt-0.5 text-lg font-bold text-slate-900">
            {venuePresent}
            <span className="text-sm font-normal text-slate-400">/{venueQuota}명</span>
          </div>
          <div className="text-[11px] text-slate-400">유인 6개 거점</div>
        </div>
      </div>

      {/* 관광지 핀 */}
      {tourist.map((z) => {
        const p = pin[z.id]
        if (!p) return null
        const gap = z.present < z.quota
        return (
          <div key={z.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <div className="flex flex-col items-center">
              <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-white shadow ${gap ? 'bg-danger' : 'bg-ok'}`}>
                <span className="tnum">{z.present}/{z.quota}</span>
              </div>
              <div className="mt-0.5 whitespace-nowrap rounded bg-white/80 px-1 text-[10px] font-medium text-slate-600">{z.name}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
