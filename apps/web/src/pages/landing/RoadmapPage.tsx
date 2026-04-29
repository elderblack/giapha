import { Link } from 'react-router-dom'
import { useDevPlanProgress } from '../../hooks/useDevPlanProgress'
import { role } from '../../design/roles'

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export function RoadmapPage() {
  const { completed, toggle, clearAll, doneCount, total, percent, phases } = useDevPlanProgress()

  return (
    <div className="lp-container max-w-abnb py-12 sm:py-16">
      <Link
        to="/"
        className={`${role.bodySm} font-semibold text-abnb-primary no-underline hover:underline`}
      >
        ← Về trang chủ
      </Link>

      <header className="mt-6 text-center sm:mt-8">
        <p className={role.kicker}>GiaPhả System v2.0</p>
        <h1 className={`${role.displayHero} mt-3 max-w-2xl mx-auto text-[1.65rem] sm:text-[2rem]`}>
          Lộ trình phát triển
        </h1>
        <p className={`${role.bodySm} mx-auto mt-3 max-w-xl text-abnb-muted`}>
          Các mục đã phát hành trên repo được <strong>tích sẵn</strong> (cờ <code className="text-xs">shipped</code> trong{' '}
          <code className="rounded bg-abnb-surfaceSoft px-1.5 py-0.5 text-xs">devPlan.ts</code>). Trình duyệt ghi đè nếu bạn
          bấm tay — dùng chung khoá lưu với app <code className="rounded bg-abnb-surfaceSoft px-1.5 py-0.5 text-xs">dev-plan</code>.
        </p>

        <div className="mx-auto mt-8 max-w-md">
          <div className="flex items-center justify-between text-xs text-abnb-muted">
            <span>
              {doneCount}/{total} công việc
            </span>
            <span className="font-semibold text-abnb-primary">{percent}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-abnb-surfaceSoft">
            <div
              className="h-full rounded-full bg-abnb-primary transition-all duration-500 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </header>

      <ol className="mx-auto mt-12 max-w-2xl space-y-4">
        {phases.map((phase, idx) => {
          const phaseDone = phase.tasks.filter((t) => completed[t.id]).length
          const phaseTotal = phase.tasks.length
          const phasePct = phaseTotal ? Math.round((phaseDone / phaseTotal) * 100) : 0

          return (
            <li key={phase.id}>
              <details
                className="group rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-abnb open:border-abnb-hairline"
                open={idx < 2}
              >
                <summary className="flex cursor-pointer list-none items-start gap-3 rounded-abnb-lg p-4 pr-4 text-left marker:content-none sm:p-5 [&::-webkit-details-marker]:hidden">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-abnb-md bg-abnb-surfaceSoft text-sm font-semibold text-abnb-primary ring-1 ring-abnb-hairlineSoft">
                    {idx + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-abnb-ink">{phase.title}</span>
                    <span className="mt-0.5 block text-xs text-abnb-muted">
                      {phase.weekRange} · {phase.goal}
                    </span>
                    <span className="mt-2 inline-flex items-center gap-2 text-xs text-abnb-muted">
                      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-abnb-surfaceSoft">
                        <span
                          className="block h-full rounded-full bg-abnb-primary/90"
                          style={{ width: `${phasePct}%` }}
                        />
                      </span>
                      {phaseDone}/{phaseTotal}
                    </span>
                  </span>
                </summary>

                <ul className="space-y-0.5 border-t border-abnb-hairlineSoft px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
                  {phase.tasks.map((task) => {
                    const isDone = Boolean(completed[task.id])
                    return (
                      <li key={task.id}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-abnb-md px-2 py-2 transition-colors hover:bg-abnb-surfaceSoft">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={isDone}
                            onChange={() => toggle(task.id)}
                          />
                          <span
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-abnb-ink/20 peer-focus-visible:ring-offset-2 ${
                              isDone
                                ? 'border-abnb-primary bg-abnb-primary text-white'
                                : 'border-abnb-hairline bg-abnb-canvas'
                            }`}
                          >
                            {isDone && <CheckIcon className="h-3 w-3" />}
                          </span>
                          <span
                            className={`text-sm leading-snug ${
                              isDone
                                ? 'text-abnb-muted line-through decoration-abnb-mutedSoft'
                                : 'text-abnb-body'
                            }`}
                          >
                            {task.label}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </details>
            </li>
          )
        })}
      </ol>

      <footer className="mt-12 text-center">
        <p className={role.legalTiny}>
          Nguồn: mục 16 —{' '}
          <span className="rounded bg-abnb-surfaceSoft px-1.5 py-0.5">GiaPha_System_Documentation v2.0</span>
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Đặt lại về mặc định (theo mục đã shipped trong repo)? Các chỉnh tay sẽ mất.'))
              clearAll()
          }}
          className={`${role.bodySm} mt-3 font-semibold text-abnb-muted underline-offset-2 hover:text-abnb-ink hover:underline`}
        >
          Đặt lại tiến độ
        </button>
      </footer>
    </div>
  )
}
