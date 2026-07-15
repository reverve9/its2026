import { getSafety, getAssignment, isZoneSuspended } from '../../lib/services'
import { useLive } from '../../lib/useLive'

// 본부→현장 운영중단 전파. FieldLayout 최상단(로고 헤더보다 위)에 고정한다.
//
// 이게 없던 동안 콘솔은 여섯 군데에서 '전파'라고 말했지만 전파되는 곳이 없었다 —
// Safety.tsx 는 "야외 거점 운영중단을 일괄 전파합니다"라 쓰고 버튼 이름이 [야외운영 중단 전파],
// 발령하면 "전파 중"으로 바뀌고, Report.tsx 는 발주처 보고서에 "전파 중"이라 적었다.
// 그런데 grep weatherStop src/surfaces/field/ → 0건. 본부 화면 안에서만 도는 상태였다.
//
// ⚠️ 작업중지(workStop)는 여기 없다 — 의도적이다.
// 과업지시서는 '작업중지'와 '운영중단'을 나란히 다른 조치로 쓴다. 작업중지의 대상은
// "작업자, 운영인력, 하도급업체 종사자"이고 위험작업(고소·전기·중량물·구조물·야간)은
// 설치·철거에 몰려 있다 — 이 플랫폼이 다루는 행사 5일(10/19~23) 밖이고, 현장앱 사용자
// (자원봉사자·거점관리자) 중 위험작업을 하는 사람은 없다. 작업중지는 콘솔에만 둔다.
//
// 범위 판정은 isZoneSuspended 하나로 콘솔 거점 현황과 공유한다(R5) — 두 곳에서 따로
// 판정하면 본부는 '중단'인데 현장은 배너가 없는 상태가 생긴다.
// 거점은 세션이 아니라 assignmentId 로 조회한다 — 세션에 zoneId 를 넣으면 시드가 바뀔 때
// 어긋나는 stale 항목이 하나 더 늘어난다(세션은 이미 role 로 그 문제를 겪었다).
export function SafetyBanner({ assignmentId }: { assignmentId?: string }) {
  const safety = useLive(getSafety)
  const me = useLive(
    () => (assignmentId ? getAssignment(assignmentId) : Promise.resolve(undefined)),
    [assignmentId]
  )
  if (!safety?.suspension.active) return null

  const { reason, at, zoneIds } = safety.suspension
  const total = zoneIds === null

  // 로그인 전(assignmentId 없음)엔 내 거점을 모른다 → 전 거점 발령만 띄운다.
  // 거점별 발령을 '내 거점인지 모른 채' 띄우면 무관한 사람을 멈춰세운다.
  if (!assignmentId) {
    if (!total) return null
  } else if (!isZoneSuspended(safety, me?.zoneId ?? null)) {
    return null
  }

  return (
    <div className="shrink-0 border-b-2 border-warn bg-warn px-4 py-3 text-white">
      <div className="flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/20 text-body">⛔</span>
        <div className="min-w-0">
          <div className="text-label font-bold">
            {total ? '전 거점 운영중단' : '내 거점 운영중단'} · {at}
          </div>
          <div className="mt-0.5 text-caption leading-snug text-white/90">
            {reason} — 활동을 중단하고 안전한 곳에서 대기하십시오. 재개는 본부 안내 후.
          </div>
        </div>
      </div>
    </div>
  )
}
