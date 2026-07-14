import { useState } from 'react'
import { getIssues, getZones, updateIssueStatus } from '../../../lib/services'
import { useLive } from '../../../lib/useLive'
import type { IssueType, IssueStatus } from '../../../types'
import { PageHeader, Section } from '../../../components/layout'

const TYPES: (IssueType | 'all')[] = ['all', '민원', '분실물', '미아', '시설이상', '안전사고']
const STATUS: (IssueStatus | 'all')[] = ['all', 'received', 'in_progress', 'resolved']
const statusKo: Record<IssueStatus, string> = { received: '접수', in_progress: '처리중', resolved: '완료' }
const statusCls: Record<IssueStatus, string> = {
  received: 'bg-critical-soft text-critical',
  in_progress: 'bg-warn-soft text-warn',
  resolved: 'bg-ok-soft text-ok',
}
const typeCls: Record<string, string> = {
  민원: 'bg-cat-3/10 text-cat-3', 분실물: 'bg-cat-1/10 text-cat-1', 미아: 'bg-cat-6/10 text-cat-6',
  시설이상: 'bg-cat-4/15 text-cat-4', 안전사고: 'bg-critical-soft text-critical',
}

export default function Issues() {
  const issues = useLive(getIssues) ?? []
  const zones = useLive(getZones) ?? []
  const [type, setType] = useState<IssueType | 'all'>('all')
  const [status, setStatus] = useState<IssueStatus | 'all'>('all')

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id
  const rows = issues.filter((i) => (type === 'all' || i.type === type) && (status === 'all' || i.status === status))
  const count = (s: IssueStatus) => issues.filter((i) => i.status === s).length

  const next = (s: IssueStatus): IssueStatus | null => (s === 'received' ? 'in_progress' : s === 'in_progress' ? 'resolved' : null)
  const nextLabel: Record<IssueStatus, string> = { received: '처리 시작', in_progress: '완료 처리', resolved: '재접수' }

  return (
    <div>
      <PageHeader
        title="민원·분실물·미아 접수대장"
        summary="현장앱·운영본부 접수 → 처리상태 로그. 접수 → 처리중 → 완료"
        right={
          <div className="flex gap-2 text-caption">
            <span className="rounded-lg bg-critical-soft px-2.5 py-1 font-semibold text-critical">접수 <b className="tnum">{count('received')}</b></span>
            <span className="rounded-lg bg-warn-soft px-2.5 py-1 font-semibold text-warn">처리중 <b className="tnum">{count('in_progress')}</b></span>
            <span className="rounded-lg bg-ok-soft px-2.5 py-1 font-semibold text-ok">완료 <b className="tnum">{count('resolved')}</b></span>
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TYPES.map((t) => (
          <button key={t} onClick={() => setType(t)}
            className={`rounded-full px-3 py-1.5 text-label font-semibold transition ${type === t ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'}`}>
            {t === 'all' ? '전체 유형' : t}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        {STATUS.map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-label font-semibold transition ${status === s ? 'bg-primary-600 text-white' : 'bg-surface text-ink-muted shadow-sm hover:text-ink-strong'}`}>
            {s === 'all' ? '전체 상태' : statusKo[s]}
          </button>
        ))}
      </div>

      <Section title={`접수 내역 (${rows.length})`} bodyClassName="p-0">
        <table className="w-full text-label">
          <thead>
            <tr className="border-b border-line bg-neutral-50 text-caption text-ink-muted">
              <th className="px-4 py-2.5 text-left font-semibold">유형</th>
              <th className="px-3 py-2.5 text-left font-semibold">거점</th>
              <th className="px-3 py-2.5 text-left font-semibold">내용</th>
              <th className="px-3 py-2.5 text-left font-semibold">시각</th>
              <th className="px-3 py-2.5 text-left font-semibold">상태</th>
              <th className="px-4 py-2.5 text-right font-semibold">처리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => {
              const nx = next(i.status)
              return (
                <tr key={i.id} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-2.5"><span className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${typeCls[i.type] ?? 'bg-neutral-100 text-ink-muted'}`}>{i.type}</span></td>
                  <td className="px-3 py-2.5 text-ink-base">{zoneName(i.zoneId)}</td>
                  <td className="px-3 py-2.5 text-ink-base">{i.message}</td>
                  <td className="tnum px-3 py-2.5 text-ink-muted">{i.time}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-md px-1.5 py-0.5 text-caption font-semibold ${statusCls[i.status]}`}>{statusKo[i.status]}</span></td>
                  <td className="px-4 py-2.5 text-right">
                    {nx && (
                      <button onClick={() => updateIssueStatus(i.id, nx)}
                        className="rounded-lg bg-primary-600 px-2.5 py-1 text-caption font-semibold text-white transition hover:bg-primary-700">
                        {nextLabel[i.status]}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && <div className="p-8 text-center text-body text-ink-faint">해당 조건의 접수 내역이 없습니다.</div>}
      </Section>
    </div>
  )
}
