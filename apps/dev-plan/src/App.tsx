import { usePlanProgress } from './hooks/usePlanProgress'

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

export default function App() {
  const { completed, toggle, clearAll, doneCount, total, percent, phases } =
    usePlanProgress()

  return (
    <div className="min-h-svh bg-gradient-to-b from-emerald-950/95 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-10 pb-16 sm:px-6">
        <header className="mb-10 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-emerald-400/90">
            GiaPhả System v2.0
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Kế hoạch phát triển
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-pretty text-sm text-slate-400">
            Mục <strong className="text-slate-300">shipped</strong> trong <code className="rounded bg-slate-800 px-1 py-0.5 text-slate-300">devPlan.ts</code> được
            tích sẵn; chỉnh tay vẫn lưu vào localStorage (chung khoá với landing <code className="text-slate-400">/roadmap</code>).
          </p>

          <div className="mx-auto mt-6 max-w-md">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                {doneCount}/{total} công việc
              </span>
              <span className="font-medium text-emerald-300">{percent}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </header>

        <ol className="space-y-4">
          {phases.map((phase, idx) => {
            const phaseDone = phase.tasks.filter(
              (t) => completed[t.id],
            ).length
            const phaseTotal = phase.tasks.length
            const phasePct = phaseTotal
              ? Math.round((phaseDone / phaseTotal) * 100)
              : 0

            return (
              <li key={phase.id}>
                <details
                  className="group open:bg-slate-800/50 rounded-2xl border border-slate-700/60 bg-slate-900/40 shadow-lg backdrop-blur-sm transition-colors open:border-emerald-800/50"
                  open={idx < 2}
                >
                  <summary className="flex cursor-pointer list-none items-start gap-3 rounded-2xl p-4 pr-4 text-left marker:content-none sm:p-5 [&::-webkit-details-marker]:hidden">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm font-semibold text-emerald-400 ring-1 ring-slate-600/80">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-white">
                        {phase.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {phase.weekRange} · {phase.goal}
                      </span>
                      <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
                          <span
                            className="block h-full rounded-full bg-emerald-500/90"
                            style={{ width: `${phasePct}%` }}
                          />
                        </span>
                        {phaseDone}/{phaseTotal}
                      </span>
                    </span>
                  </summary>

                  <ul className="space-y-1 border-t border-slate-800/80 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
                    {phase.tasks.map((task) => {
                      const isDone = Boolean(completed[task.id])
                      return (
                        <li key={task.id}>
                          <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-800/60">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={isDone}
                              onChange={() => toggle(task.id)}
                            />
                            <span
                              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/80 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-900 ${
                                isDone
                                  ? 'border-emerald-500 bg-emerald-500 text-white'
                                  : 'border-slate-500 bg-slate-800/80'
                              }`}
                            >
                              {isDone && <CheckIcon className="h-3 w-3" />}
                            </span>
                            <span
                              className={`text-sm leading-snug ${
                                isDone
                                  ? 'text-slate-500 line-through decoration-slate-500'
                                  : 'text-slate-200'
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

        <footer className="mt-12 text-center text-xs text-slate-500">
          <p>
            Nguồn: <code className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-300">GiaPha_System_Documentation.md</code> — Mục 16
          </p>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm('Đặt lại về mặc định (theo mục đã shipped trong repo)? Các chỉnh tay sẽ mất.')
              ) {
                clearAll()
              }
            }}
            className="mt-3 text-slate-600 underline decoration-slate-600 underline-offset-2 transition hover:text-slate-400"
          >
            Đặt lại tiến độ
          </button>
        </footer>
      </div>
    </div>
  )
}
