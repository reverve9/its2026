import type { Zone } from '../types'

// 스키매틱 거점 지도 — 타일맵 없이 실제 위경도를 정규화해 상대 위치로 배치.
// (블라인드·오프라인 안전, 지명/브랜딩 노출 없음)
// 모양 = 종류(행사장 사각 / 관광지 원), 색 = 상태(공백=경보 / 정상 / 비운영).

const C = {
  primary: '#37766f',
  critical: '#b91c1c',
  neutral: '#8c979e',
  line: '#d7dde1',
  region: '#eff5f4',
  regionLine: '#aed0cc',
  ink: '#3a4247',
  faint: '#8c979e',
}

const short: Record<string, string> = {
  'z-info': '안내소', 'z-stage': '공연', 'z-food': '음식', 'z-photo': '포토존',
  'z-support': '지원', 'z-sky': '스카시', 'z-market': '중앙시장', 'z-gyeongpo': '경포',
  'z-anmok': '안목', 'z-jumunjin': '주문진', 'z-gangmun': '강문', 'z-ojuk': '오죽헌',
}

const fillOf = (z: Zone) =>
  z.status !== 'open' ? C.neutral : z.present < z.quota ? C.critical : C.primary

export function ZoneMap({ zones }: { zones: Zone[] }) {
  const W = 440, H = 300, pad = 30
  const venues = zones.filter((z) => z.kind === 'venue')
  const tourists = zones.filter((z) => z.kind === 'tourist')

  const lats = zones.map((z) => z.coords.lat)
  const lngs = zones.map((z) => z.coords.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  const nx = (lng: number) => pad + ((lng - minLng) / (maxLng - minLng || 1)) * (W - 2 * pad)
  const ny = (lat: number) => pad + ((maxLat - lat) / (maxLat - minLat || 1)) * (H - 2 * pad)

  // 행사장(올림픽파크) 클러스터 중심 → 그 자리에 region 박스 + 3×2 그리드
  const pcx = venues.reduce((s, z) => s + nx(z.coords.lng), 0) / venues.length
  const pcy = venues.reduce((s, z) => s + ny(z.coords.lat), 0) / venues.length
  const rw = 150, rh = 96
  const rx = Math.min(Math.max(pcx - rw / 2, 6), W - rw - 6)
  const ry = Math.min(Math.max(pcy - rh / 2, 22), H - rh - 6)
  const vpos = (i: number) => ({
    x: rx + 34 + (i % 3) * 42,
    y: ry + 42 + Math.floor(i / 3) * 34,
  })

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="전 거점 상황판">
        {/* 배경 */}
        <rect x="0" y="0" width={W} height={H} rx="10" fill="#fbfcfc" />
        {/* 나침반 */}
        <text x={W - 16} y="20" textAnchor="end" fontSize="10" fill={C.faint}>N ↑</text>

        {/* 관광지 핀 (원) */}
        {tourists.map((z) => {
          const x = nx(z.coords.lng), y = ny(z.coords.lat)
          const anchor = x > W - 70 ? 'end' : 'start'
          const lx = anchor === 'end' ? x - 9 : x + 9
          return (
            <g key={z.id}>
              <circle cx={x} cy={y} r="6" fill={fillOf(z)} stroke="#fff" strokeWidth="1.5" />
              <text x={lx} y={y + 3.5} textAnchor={anchor} fontSize="10" fontWeight="600" fill={C.ink}>
                {short[z.id]}
              </text>
            </g>
          )
        })}

        {/* 행사장 클러스터 region */}
        <rect x={rx} y={ry} width={rw} height={rh} rx="10" fill={C.region} stroke={C.regionLine} strokeWidth="1" />
        <text x={rx + 12} y={ry + 18} fontSize="10.5" fontWeight="700" fill={C.primary}>
          올림픽파크 · 행사장
        </text>
        {venues.map((z, i) => {
          const p = vpos(i)
          return (
            <g key={z.id}>
              <rect x={p.x - 6} y={p.y - 6} width="12" height="12" rx="3" fill={fillOf(z)} stroke="#fff" strokeWidth="1.5" />
              <text x={p.x} y={p.y + 18} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={C.ink}>
                {short[z.id]}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 범례 */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-caption text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: C.primary }} />정상</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: C.critical }} />근무공백</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: C.neutral }} />비운영</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[2px] border border-white bg-ink-faint" />행사장</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-white bg-ink-faint" />관광지</span>
        </span>
      </div>
    </div>
  )
}
