// 현장 안내 정적 정보 — 비상연락망 · 셔틀/관광 안내.
// 방문객 응대·비상 대응용. (블라인드: 실제 번호 아닌 대표 예시)

export interface Contact {
  label: string
  phone: string
  note?: string
}

export const EMERGENCY_CONTACTS: Contact[] = [
  { label: '현장 운영본부', phone: '033-000-1000', note: '전 거점 총괄·근무공백 대응' },
  { label: '안전상황실', phone: '033-000-1119', note: '사고 접수·안전 조치' },
  { label: '의료지원반', phone: '033-000-1004', note: '응급·부상 연계' },
  { label: '강릉시 종합상황실', phone: '033-000-2000', note: '유관기관 연계' },
]

export const SHUTTLE_INFO = {
  title: '셔틀 · 관광 안내',
  lines: [
    '셔틀: 행사장 ↔ 주요 관광지 20분 간격 순환(10:00–18:00)',
    '주요 정류장: 종합안내소 · 경포해변 · 중앙시장 · 오죽헌',
    '관광 문의는 방문객에게 안내소 리플릿·모바일 안내페이지 안내',
  ],
}
