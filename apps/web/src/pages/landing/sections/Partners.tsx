import { role } from '../../../design/roles'

/** Minh hoạ đối tác / dòng họ beta — thay logo vector khi có file thật. */
const partners = [
  { monogram: 'TK', name: 'Tộc Khánh', tint: 'from-abnb-primary/20 to-abnb-primary/5' },
  { monogram: 'VP', name: 'Việt Phả', tint: 'from-abnb-luxe/15 to-abnb-luxe/5' },
  { monogram: 'HM', name: 'Họ Mai', tint: 'from-emerald-500/15 to-emerald-500/5' },
  { monogram: 'ĐP', name: 'Đồng Phả', tint: 'from-amber-500/15 to-amber-500/5' },
  { monogram: 'GH', name: 'Gia Hương', tint: 'from-sky-500/15 to-sky-500/5' },
  { monogram: 'LT', name: 'Liên Tộc', tint: 'from-abnb-plus/20 to-abnb-plus/5' },
] as const

export function Partners() {
  return (
    <section
      aria-label="Đối tác và cộng đồng beta"
      className="border-b border-abnb-hairlineSoft bg-abnb-surfaceSoft/60"
    >
      <div className="lp-container py-12 md:py-14 lg:py-16">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="max-w-md lg:shrink-0">
            <p className={role.kicker}>Đồng hành</p>
            <p className={`${role.headingModule} mt-3 text-lg md:text-xl`}>
              Cộng đồng dòng họ & nhóm beta
            </p>
            <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
              Tên minh hoạ — thay logo đối tác thật khi ký hợp tác.
            </p>
          </div>
          <ul className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 lg:flex-1 lg:justify-end">
            {partners.map((p) => (
              <li key={p.name}>
                <div
                  className={`flex items-center gap-3 rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-canvas px-4 py-3 shadow-sm ring-1 ring-black/[0.02] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-abnb`}
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-abnb-md bg-gradient-to-br ${p.tint} text-[13px] font-bold tracking-tight text-abnb-ink`}
                    aria-hidden
                  >
                    {p.monogram}
                  </span>
                  <span className="text-sm font-semibold text-abnb-ink">{p.name}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
