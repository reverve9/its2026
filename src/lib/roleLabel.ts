import type { StaffRole } from '../types'

// 화면에 찍는 역할 배지. 백엔드 StaffRole 과 일부러 다르다 —
// 데이터는 '거점관리자·현장운영'으로 정확히 부르고, 배지는 짧게 읽힌다.
//
// role 이 없는 사람 = 슈퍼어드민. StaffRole 셋 중 어느 것도 아니라서 undefined 이고,
// 지어낸 역할을 채워넣는 대신 여기서 '관리자'로 찍는다.
const LABEL: Record<StaffRole, string> = {
  봉사자: '봉사자',
  거점관리자: '거점관리',
  현장운영: '스태프',
}

// ⚠️ 배지 문구는 바뀔 수 있다. 분기는 여기에 없다 — 화면은 zoneId·kind 로 갈리고(D12)
// 이 함수는 순수 표시층이라, 라벨을 갈아도 동작은 미동도 하지 않는다.
export const roleLabel = (role?: StaffRole): string => (role ? LABEL[role] : '관리자')

// 배지 색도 라벨과 같은 자리에 둔다 — 화면마다 색을 새로 고르면 같은 역할이 화면마다 달라 보인다.
// 운영인력 둘(거점관리·스태프)이 같은 색인 건 의도다: 둘은 같은 kind 이고 갈리는 건 zoneId 뿐이라(D12)
// 색까지 가르면 화면이 없는 위계를 말한다. 구분은 라벨 텍스트가 한다.
// 고용형태 배지(직원 info · 일용 primary)와 나란히 서므로 색이 겹치지 않게 골랐다.
const CLS: Record<StaffRole, string> = {
  봉사자: 'bg-neutral-100 text-ink-muted',
  거점관리자: 'bg-primary-50 text-primary-700',
  현장운영: 'bg-primary-50 text-primary-700',
}
export const roleCls = (role?: StaffRole): string => (role ? CLS[role] : 'bg-neutral-100 text-ink-muted')
