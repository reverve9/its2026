// 시드 데이터 (이벤트 소싱) — store.ts 만 이 파일을 import 한다(R1).
// 화면·컴포넌트는 절대 여기를 직접 읽지 않는다. 반드시 services 경유.
//
// 설계: 상태·checks·present·KPI 는 저장하지 않는다. 원시 사실만 담는다.
//   · 배치(StoredAssignment): 누가 · 어느 조 · 어느 거점 · 예정 출근시각 · 휴게/이동/미출근 프로필
//   · 이벤트(StoredEvent): 체크인·퇴근·정시(1h) 체크 — 전부 멱등키 보유
// services 가 '현재 시각'을 기준으로 이 사실들에서 상태·checks 를 파생한다.
// 기준 시각 = 2026-10-21(수) 14:20 → 오전조 퇴근완료, 오후조 출근 중(미출근 3명 = B플로우 트리거).

import type { Zone, Issue, Notice, Coords } from '../types'
import type { StoredAssignment, StoredEvent } from '../lib/store'

export const SEED_DATE = '2026-10-21'

// ── 시각 헬퍼(시드 전용, clock 비의존) ────────────────────
const H = (h: number, m = 0) => h * 60 + m

// ① 거점 — 행사장 5구역(유인 스캔) + 관광지 6거점(무인 GPS). 조당 정원(quota) 합계 = 55.
//   행사장 30(8+6+6+5+5) · 관광지 25(4+4+4+5+4+4). 두 조 동일 배분 → 총 110.
//   ※ 스카시 포토존은 종합안내소 구역 내부 → 별도 거점 아님.
//   ※ 조직위 운영 구역은 우리 배치 대상 아님 → 거점 없음.
export const zones: Zone[] = [
  { id: 'z-info', name: '종합안내소', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7726, lng: 128.9476 }, geofenceRadius: 60, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 8, present: 0 },
  { id: 'z-stage', name: '공연구역', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7731, lng: 128.9481 }, geofenceRadius: 80, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 6, present: 0 },
  { id: 'z-food', name: '음식판매·휴게구역', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7719, lng: 128.9469 }, geofenceRadius: 70, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 6, present: 0 },
  { id: 'z-photo', name: 'ITS 상징 포토존', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7724, lng: 128.9487 }, geofenceRadius: 40, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 5, present: 0 },
  { id: 'z-support', name: '행사지원구역', kind: 'venue', checkMode: 'manager_scan', coords: { lat: 37.7733, lng: 128.9464 }, geofenceRadius: 60, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 5, present: 0 },
  { id: 'z-market', name: '중앙시장·월화거리', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7519, lng: 128.8961 }, geofenceRadius: 120, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 4, present: 0 },
  { id: 'z-gyeongpo', name: '경포해변', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7955, lng: 128.9106 }, geofenceRadius: 150, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 4, present: 0 },
  { id: 'z-anmok', name: '안목해변', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7735, lng: 128.9473 }, geofenceRadius: 120, opWindow: { start: '10:00', end: '18:00' }, status: 'open', quota: 4, present: 0 },
  { id: 'z-jumunjin', name: '주문진항·수산시장', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.8925, lng: 128.8317 }, geofenceRadius: 130, opWindow: { start: '10:00', end: '17:00' }, status: 'open', quota: 5, present: 0 },
  { id: 'z-gangmun', name: '강문해변', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7907, lng: 128.9169 }, geofenceRadius: 120, opWindow: { start: '11:00', end: '18:00' }, status: 'open', quota: 4, present: 0 },
  { id: 'z-ojuk', name: '오죽헌시립박물관', kind: 'tourist', checkMode: 'self_gps', coords: { lat: 37.7794, lng: 128.8784 }, geofenceRadius: 100, opWindow: { start: '10:00', end: '17:00' }, status: 'open', quota: 4, present: 0 },
]

// ── 이름·연락처·외국어 결정적 생성(랜덤·시각 비의존) ──────
const SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍', '유', '고', '문', '양', '손', '배', '백', '허', '남', '심']
const GIV = ['민준', '서연', '도윤', '하은', '시우', '지우', '예준', '수아', '주원', '지호', '건우', '채원', '우진', '다은', '현우', '유진', '지훈', '서윤', '준서', '하린', '도현', '예은', '시윤', '가은', '승우', '수빈', '지안', '유나', '태호', '서준', '민서', '하준', '예린', '지원', '도경', '세아', '현서', '나윤', '승현', '민재']
const LANGS = ['영어', '중국어', '일본어', '러시아어']

const nameOf = (i: number) => SUR[i % SUR.length] + GIV[(i * 7 + 3) % GIV.length]
const phoneOf = (i: number) =>
  `010-${String(2000 + ((i * 37) % 8000)).padStart(4, '0')}-${String(1000 + ((i * 53) % 9000)).padStart(4, '0')}`
const langOf = (i: number): string[] | undefined => (i % 3 === 0 ? [LANGS[(i * 5) % LANGS.length]] : undefined)

// 거점 좌표 근처의 GPS 좌표(무인 체크인 이벤트용) — 결정적 미세 변위.
const nearby = (c: Coords, i: number): Coords => ({
  lat: +(c.lat + ((i % 5) - 2) * 0.0002).toFixed(6),
  lng: +(c.lng + (((i * 3) % 5) - 2) * 0.0002).toFixed(6),
})

// ── 특수 프로필 태그 — (zoneId|shift|localIdx) 키 ─────────
// 14:20 시나리오를 의도적으로 심는다. §5 보고용 근거.
const NOSHOW = new Set(['z-jumunjin|PM|0', 'z-jumunjin|PM|1', 'z-gyeongpo|PM|0']) // 오후조 미출근 3명 → 근무공백 2거점
const PM_MISSED = new Set(['z-info|PM|2']) // 출근했으나 14:00 정시체크 누락 → soft 경보
const PM_BREAK = new Set(['z-food|PM|1']) // 오후 휴게 로테이션 중
const PM_MOVING = new Set(['z-photo|PM|1']) // 거점 간 이동 중
const AM_MISSED = new Set(['z-info|AM|3']) // 오전조 13:00 정시체크 누락(이력)

const key = (zoneId: string, shift: 'AM' | 'PM', idx: number) => `${zoneId}|${shift}|${idx}`

// ── 배치 + 이벤트 생성 ──────────────────────────────────
const assignments: StoredAssignment[] = []
const events: StoredEvent[] = []
let gid = 0
let eid = 0

const AM_SLOTS = [H(10), H(11), H(12), H(13)]

function pushEvent(
  a: StoredAssignment,
  kind: StoredEvent['kind'],
  timeMin: number,
  extra: Partial<StoredEvent> = {}
) {
  if (!a.zoneId) return
  eid++
  events.push({
    id: `ev-${eid}`,
    idempotencyKey: `seed:${a.id}:${kind}:${extra.slot ?? timeMin}`,
    assignmentId: a.id,
    kind,
    timeMin,
    method: extra.method ?? (zoneById(a.zoneId).checkMode === 'self_gps' ? 'gps' : 'scan'),
    slot: extra.slot,
    gps: extra.gps,
    anomaly: extra.anomaly,
  })
}

const zoneById = (id: string) => zones.find((z) => z.id === id)!

for (const z of zones) {
  for (const shift of ['AM', 'PM'] as const) {
    for (let idx = 0; idx < z.quota; idx++) {
      gid++
      const k = key(z.id, shift, idx)
      const isManager = z.kind === 'venue' && idx === 0
      const id = `as-${gid}`
      const a: StoredAssignment = {
        id,
        personName: nameOf(gid),
        phone: phoneOf(gid),
        role: isManager ? '거점관리자' : '봉사자',
        lang: langOf(gid),
        isReserve: false,
        date: SEED_DATE,
        shift,
        zoneId: z.id,
        plannedInMin: shift === 'AM' ? H(10) : H(14),
      }

      const noShow = NOSHOW.has(k)
      if (noShow) {
        a.noShow = true
        assignments.push(a)
        continue // 이벤트 없음
      }
      if (PM_BREAK.has(k)) a.breaks = [{ startMin: H(14, 8), endMin: H(14, 40), note: '오후 휴게 로테이션' }]
      if (PM_MOVING.has(k)) a.moving = { startMin: H(14, 12), endMin: H(14, 32), note: '포토존 → 행사지원구역 지원' }
      assignments.push(a)

      // ── 이벤트 생성 ──
      const isGps = z.checkMode === 'self_gps'
      const method = isGps ? 'gps' : 'scan'
      const gps = isGps ? nearby(z.coords, gid) : undefined

      if (shift === 'AM') {
        // 오전조: 출근(09:50~09:58, 첫 슬롯 前) → 정시 10·11·12·13 → 퇴근(13:58~14:06)
        const inMin = H(9, 50) + (gid % 9)
        pushEvent(a, 'checkin', inMin, { method, gps: gps && nearby(z.coords, gid + 1) })
        for (const slot of AM_SLOTS) {
          if (AM_MISSED.has(k) && slot === H(13)) continue // 13:00 누락(이력)
          pushEvent(a, 'hourly', slot + (gid % 4), { slot, method, gps: gps && nearby(z.coords, gid + slot) })
        }
        pushEvent(a, 'checkout', H(13, 58) + (gid % 8), { method })
      } else {
        // 오후조: 출근(13:52~14:00, 첫 슬롯 前) → 정시 14:00(누락 태그면 생략). 15·16·17시는 미래 슬롯.
        const inMin = H(13, 52) + (gid % 9)
        const anomaly =
          k === 'z-market|PM|1' ? `지오펜스 경계(${z.geofenceRadius}m) 근접 — 이상치 기록(차단 아님)` : undefined
        pushEvent(a, 'checkin', inMin, { method, gps: gps && nearby(z.coords, gid + 2), anomaly })
        if (!PM_MISSED.has(k)) {
          pushEvent(a, 'hourly', H(14) + (gid % 5), { slot: H(14), method, gps: gps && nearby(z.coords, gid + 14) })
        }
      }
    }
  }
}

// ── 예비인력 pool(별도 유지 — 배치 안 된 상태, 110 에 미포함) ──
const RESERVE_COUNT = 7
for (let r = 0; r < RESERVE_COUNT; r++) {
  gid++
  assignments.push({
    id: `rs-${r + 1}`,
    personName: nameOf(gid),
    phone: phoneOf(gid),
    role: '봉사자',
    lang: r % 2 === 0 ? [LANGS[r % LANGS.length]] : undefined,
    isReserve: true,
    date: SEED_DATE,
    shift: 'PM', // 현재 조 대기
    zoneId: null,
    plannedInMin: H(14),
  })
}

export { assignments, events }

// ④ 이슈 ────────────────────────────────────────────────
export const issues: Issue[] = [
  { id: 'is-1', type: '분실물', zoneId: 'z-info', status: 'in_progress', time: '13:34', message: '검정 백팩 습득 — 종합안내소 보관, 소유자 확인 중' },
  { id: 'is-2', type: '미아', zoneId: 'z-stage', status: 'resolved', time: '12:20', message: '미아(여, 6세) 보호 → 보호자 인계 완료' },
  { id: 'is-3', type: '시설이상', zoneId: 'z-food', status: 'received', time: '14:11', message: '음식구역 손세정대 수압 약함 — 점검 요청' },
  { id: 'is-4', type: '민원', zoneId: 'z-photo', status: 'received', time: '14:17', message: '포토존 대기줄 안내 인력 보강 요청' },
]

// ⑤ 공지·안내기준 ───────────────────────────────────────
export const notices: Notice[] = [
  { id: 'nt-1', title: '오후조 교대 안내', body: '14:00 오전조 퇴근·오후조 투입 완료 확인. 미출근 인력 즉시 예비 대체.', scope: 'all', time: '13:55' },
  { id: 'nt-2', title: '기상 안내', body: '오후 3시경 강풍 예보 — 야외 포토존·해변거점 안전고지 문안 통일 배포.', scope: 'all', time: '13:50' },
  { id: 'nt-3', title: '셔틀 운행 안내 문안', body: '방문객 문의 대비 셔틀 배차 간격·정류장 안내 표준 문안.', scope: ['z-info', 'z-market', 'z-gyeongpo'], time: '09:10' },
]

// ── 실비 배치계획(5일) — computeExpenses 근거. 월~목 110 · 금 55(1교대). ──
export const DEPLOYMENT_PLAN: { date: string; headcount: number; shifts: number }[] = [
  { date: '2026-10-19', headcount: 110, shifts: 2 }, // 월
  { date: '2026-10-20', headcount: 110, shifts: 2 }, // 화
  { date: '2026-10-21', headcount: 110, shifts: 2 }, // 수
  { date: '2026-10-22', headcount: 110, shifts: 2 }, // 목
  { date: '2026-10-23', headcount: 55, shifts: 1 }, // 금 — 10:00~13:00 1교대(탄력 조정)
]

export const EXPENSE_UNIT_PER_DAY = 24000 // 본공고 3-1: 1인 1일 24,000원
export const ACTIVITY_GOODS_SETS = 110 // 바람막이·가방 세트(제작·배부비 별도 산출)
