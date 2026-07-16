import type { Issue, Zone } from '../types'
import { Fill } from './ui'

// 거점 상황판 = 통계표. 거점이 행, 지표가 열이라 열끼리 비교된다 — 공백 열만 훑어 빈 거점을,
// 이슈 열만 훑어 사고 난 거점을 한눈에 집는다. 지도(핀 배치)를 버린 자리다: 노트북 관제에서
// 운영자는 공간이 아니라 상태로 판단하고, 상태는 좌표가 아니라 정렬된 수로 읽힌다.
//
// 탭을 걷고 11거점을 한 표에 담는다(공간이 남는다) — 행사장·관광지는 그룹 헤더로 가른다.
// 축척 75배(행사장 226m · 관광지 16,678m)는 지도일 때의 문제였다. 표엔 좌표가 없으니
// 두 종류가 한 장에 나란히 서도 뭉치지 않는다. 집계(인원·공백)는 그룹별로, 운영 중 거점만.
const statusMeta: Record<Zone['status'], { label: string; dot: string; cls: string }> = {
  before: { label: '운영 전', dot: 'bg-neutral-300', cls: 'text-ink-faint' },
  open: { label: '운영 중', dot: 'bg-ok', cls: 'text-ok' },
  closed: { label: '종료', dot: 'bg-neutral-300', cls: 'text-ink-faint' },
  suspended: { label: '중단', dot: 'bg-warn', cls: 'text-warn font-bold' },
}

// 0 은 '—' 로 — 문제 거점만 숫자가 남아 색으로 튄다. 0 을 찍으면 정상 거점이 잉크로 시끄럽다(D26).
function Num({ n, cls }: { n: number; cls: string }) {
  return n > 0 ? <span className={`font-semibold ${cls}`}>{n}</span> : <span className="text-ink-faint">—</span>
}

function Group({ title, zones, openIssues }: { title: string; zones: Zone[]; openIssues: (id: string) => number }) {
  const openZones = zones.filter((z) => z.status === 'open')
  const sumPresent = openZones.reduce((s, z) => s + z.present, 0)
  const sumQuota = openZones.reduce((s, z) => s + z.quota, 0)
  const sumGap = openZones.reduce((s, z) => s + Math.max(0, z.quota - z.present), 0)
  const sumIssue = zones.reduce((s, z) => s + openIssues(z.id), 0)
  return (
    <tbody className="border-b-2 border-line last:border-0">
      <tr>
        <td colSpan={6} className="bg-neutral-50 px-3 py-2 text-caption font-bold text-ink-muted">
          {title} <span className="tnum ml-0.5 text-ink-faint">{zones.length}</span>
        </td>
      </tr>
      {zones.map((z) => {
        const s = statusMeta[z.status]
        const gap = z.status === 'open' && z.present < z.quota ? z.quota - z.present : 0
        return (
          <tr key={z.id} className="border-b border-line-soft">
            <td className="py-3.5 pr-3 pl-3 font-semibold text-ink-strong">{z.name}</td>
            <td className="px-3 py-3.5">
              <span className="inline-flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                <span className={`text-caption ${s.cls}`}>{s.label}</span>
              </span>
            </td>
            <td className="px-3 py-3.5"><Fill present={z.present} quota={z.quota} /></td>
            <td className="px-3 py-3.5 text-right tnum"><Num n={gap} cls="text-critical" /></td>
            <td className="px-3 py-3.5 text-right tnum"><Num n={openIssues(z.id)} cls="text-warn" /></td>
            <td className="tnum py-3.5 pl-3 pr-3 text-right text-ink-muted">{z.opWindow.start}–{z.opWindow.end}</td>
          </tr>
        )
      })}
      <tr>
        <td className="py-2.5 pl-3 pr-3 text-caption font-bold text-ink-strong">합계</td>
        <td className="px-3 py-2.5 text-caption text-ink-muted">운영 {openZones.length}</td>
        <td className="px-3 py-2.5"><Fill present={sumPresent} quota={sumQuota} /></td>
        <td className="px-3 py-2.5 text-right tnum"><Num n={sumGap} cls="text-critical" /></td>
        <td className="px-3 py-2.5 text-right tnum"><Num n={sumIssue} cls="text-warn" /></td>
        <td className="py-2.5 pl-3 pr-3" />
      </tr>
    </tbody>
  )
}

export function ZoneBoard({ zones, issues }: { zones: Zone[]; issues: Issue[] }) {
  const openIssues = (id: string) => issues.filter((i) => i.zoneId === id && i.status !== 'resolved').length
  return (
    <table className="w-full text-label">
      <thead>
        <tr className="border-b border-line text-caption text-ink-muted">
          <th className="py-2 pl-3 pr-3 text-left font-semibold">거점</th>
          <th className="px-3 py-2 text-left font-semibold">상태</th>
          <th className="px-3 py-2 text-left font-semibold">인원</th>
          <th className="px-3 py-2 text-right font-semibold">공백</th>
          <th className="px-3 py-2 text-right font-semibold">이슈</th>
          <th className="py-2 pl-3 pr-3 text-right font-semibold">운영시간</th>
        </tr>
      </thead>
      <Group title="행사장" zones={zones.filter((z) => z.kind === 'venue')} openIssues={openIssues} />
      <Group title="관광지" zones={zones.filter((z) => z.kind === 'tourist')} openIssues={openIssues} />
    </table>
  )
}
