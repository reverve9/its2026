// 아직 안 만든 화면 자리. Phase 2/3에서 실제 화면으로 교체.
export default function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="card max-w-md p-8 text-center">
        <div className="font-title text-title font-medium text-ink-strong">{title}</div>
        {note && <p className="mt-2 text-body text-ink-muted">{note}</p>}
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-caption font-medium text-ink-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
          제작 예정
        </div>
      </div>
    </div>
  )
}
