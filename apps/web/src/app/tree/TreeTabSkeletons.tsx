import { role } from '../../design/roles'

function Bar({ className }: { className?: string }) {
  return (
    <div
      role="presentation"
      className={`animate-pulse rounded-md bg-abnb-hairlineSoft/70 ${className ?? ''}`}
    />
  )
}

/** Đầu layout dòng họ khi đang lấy dữ liệu cây */
export function TreeDetailHeaderSkeleton() {
  return (
    <div className="mt-4 w-full max-w-6xl sm:mt-6 md:mx-auto" aria-busy aria-label="Đang tải dòng họ…">
      <section className="relative overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft/90 bg-abnb-surfaceCard shadow-abnb">
        <div className="relative px-5 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-6">
          <Bar className="h-4 w-32" />
          <Bar className="mt-4 h-8 max-w-[14rem]" />
          <div className="mt-4 flex gap-2">
            <Bar className="h-7 w-20 rounded-full" />
            <Bar className="h-7 w-24 rounded-full" />
          </div>
        </div>
        <div className="border-t border-abnb-hairlineSoft/80 bg-abnb-canvas/40 px-4 py-2.5 sm:px-6">
          <div className="flex gap-6">
            <Bar className="h-4 w-24" />
            <Bar className="h-4 w-28" />
            <Bar className="h-4 w-20" />
            <Bar className="hidden h-4 w-36 sm:block" />
          </div>
        </div>
      </section>
      <div className="mt-6 space-y-4 pb-10 sm:mt-8 sm:pb-12">
        <Bar className="h-44 w-full rounded-abnb-xl sm:h-52" />
        <Bar className="h-6 w-2/3 max-w-xs" />
        <Bar className="h-24 w-full rounded-abnb-xl" />
      </div>
    </div>
  )
}

export function TreeOverviewSkeleton() {
  return (
    <div className={`${role.cardElevated} space-y-10 rounded-abnb-xl border border-transparent`} aria-busy aria-label="Đang tải tổng quan…">
      <div className="space-y-3">
        <Bar className="h-6 w-40" />
        <Bar className="h-4 w-full max-w-lg" />
        <Bar className="h-4 w-full max-w-md" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((k) => (
          <div
            key={k}
            className="rounded-abnb-lg border border-abnb-hairlineSoft/80 bg-abnb-canvas/50 px-4 py-4 shadow-abnb-inner"
          >
            <Bar className="h-3 w-24" />
            <Bar className="mt-3 h-8 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-canvas/40 p-6 sm:p-8">
        <Bar className="h-6 w-48" />
        <Bar className="mt-6 h-4 w-full max-w-xl" />
        <Bar className="mt-2 h-4 w-full max-w-md" />
        <Bar className="mt-2 h-4 w-2/3 max-w-lg" />
      </div>
    </div>
  )
}

/** Chỉ vùng sơ đồ + sidebar (đặt trong thẻ card khi có TreePageIntro phía trên). */
export function TreeChartPanelSkeleton() {
  return (
    <div
      className="grid animate-pulse gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_minmax(17rem,280px)] lg:items-start"
      aria-busy
      aria-label="Đang tải sơ đồ…"
    >
      <Bar className="min-h-[360px] w-full rounded-abnb-xl" />
      <Bar className="hidden min-h-[280px] w-full rounded-abnb-lg lg:block" />
    </div>
  )
}

/** Toàn tab phả hệ (khi cần thay nguyên trang — hiện ít dùng). */
export function TreeChartSkeleton() {
  return (
    <div className="space-y-8" aria-busy aria-label="Đang tải sơ đồ…">
      <div className="space-y-2">
        <Bar className="h-6 w-36" />
        <Bar className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(17rem,280px)]">
        <Bar className="min-h-[360px] w-full rounded-abnb-xl" />
        <Bar className="hidden min-h-[280px] w-full rounded-abnb-xl lg:block" />
      </div>
    </div>
  )
}

export function TreeMembersSkeleton() {
  return (
    <ul className="list-none space-y-4 pb-10" aria-busy aria-label="Đang tải thành viên…">
        {[0, 1, 2, 3, 4].map((k) => (
          <li
            key={k}
            className="rounded-abnb-xl border border-abnb-hairlineSoft/80 bg-abnb-surfaceCard p-5 pl-6 shadow-abnb-inner ring-1 ring-abnb-primary/10"
          >
            <div className="flex gap-4">
              <Bar className="h-14 w-14 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2 pt-1">
                <Bar className="h-5 max-w-[280px] w-1/2" />
                <Bar className="h-3 w-full max-w-xl" />
                <Bar className="h-3 w-5/6 max-w-md" />
              </div>
            </div>
          </li>
        ))}
    </ul>
  )
}

/** Bảng tin: vài ô bài vuông */
export function TreeFeedSkeleton() {
  return (
    <ul className="mt-8 space-y-6" aria-busy aria-label="Đang tải bảng tin…">
      {[0, 1].map((k) => (
        <li key={k} className="rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-surfaceSoft/60 p-4 shadow-abnb-inner sm:p-5">
          <div className="flex gap-3">
            <Bar className="h-11 w-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-3">
              <Bar className="h-4 w-40" />
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-[96%]" />
              <Bar className="h-52 w-full max-w-xl rounded-abnb-lg" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}
