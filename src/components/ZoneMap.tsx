import type { Zone } from '../types'

// 스키매틱 거점 지도 — 타일맵 없이 실제 위경도를 정규화해 상대 위치로 배치.
// (블라인드·오프라인 안전, 지명/브랜딩 노출 없음)
// 모양 = 종류(행사장 사각 / 관광지 원), 색 = 상태(공백=경보 / 중단=발령 / 정상 / 비운영).
//
// ⚠️ 한 프레임에 두 종류를 같이 그리지 말 것. 축척이 75배 다르다 —
// 행사장 5거점은 올림픽파크 안 226m 이고 관광지 6거점은 강릉시 전역 16,678m 다.
// 둘을 합치면 1px ≈ 44m 가 되어 행사장 전체가 5px 에 뭉친다. 예전 판은 그래서 행사장을
// 인셋 박스 안 3×2 격자에 인덱스로 찍었는데(좌표를 통째로 버렸다), 그건 묶은 게 아니라
// 묶은 척한 것이었다. 지금은 호출부가 한 종류만 넘기고 그 안에서 정규화한다 →
// 두 축척 다 정직해지고 행사장도 실제 상대 위치를 되찾는다.
const C = {
  primary: '#37766f',
  critical: '#b91c1c',
  warn: '#b45309',
  neutral: '#8c979e',
  ink: '#3a4247',
  faint: '#8c979e',
}

const short: Record<string, string> = {
  'z-info': '안내소', 'z-stage': '공연', 'z-food': '음식', 'z-photo': '포토존',
  'z-support': '지원', 'z-sky': '스카시', 'z-market': '중앙시장', 'z-gyeongpo': '경포',
  'z-anmok': '안목', 'z-jumunjin': '주문진', 'z-gangmun': '강문', 'z-ojuk': '오죽헌',
}

// 중단은 회색(비운영)이 아니라 경고색이다 — 시간이 지나 닫힌 것(before/closed)과 달리
// 본부가 개입해 멈춘 상태라, 지도에서 눈에 띄어야 한다.
const fillOf = (z: Zone) =>
  z.status === 'suspended' ? C.warn : z.status !== 'open' ? C.neutral : z.present < z.quota ? C.critical : C.primary

export function ZoneMap({ zones }: { zones: Zone[] }) {
  const W = 440, H = 240, pad = 34
  if (zones.length === 0) return null

  const lats = zones.map((z) => z.coords.lat)
  const lngs = zones.map((z) => z.coords.lng)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  // 한 점뿐이거나 한 축으로 일직선이면 0 으로 나눈다 — 그 축은 가운데 세운다.
  const spanLat = maxLat - minLat, spanLng = maxLng - minLng
  const nx = (lng: number) => (spanLng ? pad + ((lng - minLng) / spanLng) * (W - 2 * pad) : W / 2)
  const ny = (lat: number) => (spanLat ? pad + ((maxLat - lat) / spanLat) * (H - 2 * pad) : H / 2)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="거점 상황판">
        <rect x="0" y="0" width={W} height={H} rx="10" fill="#fbfcfc" />
        <text x={W - 16} y="20" textAnchor="end" fontSize="10" fill={C.faint}>N ↑</text>

        {zones.map((z) => {
          const x = nx(z.coords.lng), y = ny(z.coords.lat)
          // 우측 끝에 붙은 핀은 라벨이 프레임 밖으로 나가므로 왼쪽에 건다.
          const anchor = x > W - 70 ? 'end' : 'start'
          const lx = anchor === 'end' ? x - 9 : x + 9
          return (
            <g key={z.id}>
              {z.kind === 'venue' ? (
                <rect x={x - 6} y={y - 6} width="12" height="12" rx="3" fill={fillOf(z)} stroke="#fff" strokeWidth="1.5" />
              ) : (
                <circle cx={x} cy={y} r="6" fill={fillOf(z)} stroke="#fff" strokeWidth="1.5" />
              )}
              <text x={lx} y={y + 3.5} textAnchor={anchor} fontSize="10" fontWeight="600" fill={C.ink}>
                {short[z.id]}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 색이 무엇을 뜻하는지 — 모양(행사장/관광지) 범례는 뺐다. 탭이 한 종류만 보여주므로
          한 프레임에 모양이 하나뿐이라, 남겨두면 화면에 없는 구분을 설명하게 된다. */}
      <div className="mt-2 flex items-center gap-x-4 px-1 text-caption text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: C.primary }} />정상</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: C.critical }} />근무공백</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: C.neutral }} />비운영</span>
      </div>
    </div>
  )
}
