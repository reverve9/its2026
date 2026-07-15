import { getNoticesFor, describeAudience, getZones } from '../../lib/services'
import { useLive } from '../../lib/useLive'

// 본부→현장 상황전파의 현장측 수신함. 봉사자·거점관리자가 공유한다.
//
// 이 화면이 없던 동안 getNotices() 소비자는 콘솔 대시보드 하나뿐이었다 —
// 운영본부가 자기가 쓴 공지를 자기가 읽고 있었고 현장에는 아무것도 가지 않았다.
//
// 받는 목록은 getNoticesFor 가 주소(구분×역할×거점)와 발령 시각으로 걸러준다.
// 화면은 거르지 않는다(R1·R5) — 여기서 또 거르면 판정이 두 곳으로 갈린다.
// assignmentId: null = 슈퍼어드민(배치 없음). getNoticesFor 가 모양으로 판정한다.
export function NoticeCard({ assignmentId }: { assignmentId: string | null }) {
  const notices = useLive(() => getNoticesFor(assignmentId), [assignmentId]) ?? []
  const zones = useLive(getZones) ?? []

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-label font-semibold text-ink-strong">본부 공지 · 안내기준</span>
        <span className="tnum text-caption text-ink-faint">{notices.length}건</span>
      </div>

      {notices.length === 0 ? (
        <p className="mt-2 text-caption text-ink-muted">받은 공지가 없습니다.</p>
      ) : (
        <div className="mt-2 divide-y divide-line-soft">
          {notices.map((n) => (
            <div key={n.id} className="py-2.5 first:pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-label font-semibold text-ink-strong">{n.title}</span>
                <span className="tnum shrink-0 text-caption text-ink-faint">{n.time}</span>
              </div>
              <p className="mt-0.5 text-caption leading-snug text-ink-base">{n.body}</p>
              {/* 누구에게 온 공지인지 — '전원'인지 '나에게 지목된 것'인지가 행동을 가른다. */}
              <span className="mt-1.5 inline-block rounded bg-neutral-100 px-1.5 py-0.5 text-caption text-ink-muted">
                {describeAudience(n.audience, zones)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
