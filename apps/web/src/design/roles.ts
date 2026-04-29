/**
 * Vai trò UI — map DESIGN.md (Airbnb) → class Tailwind.
 */
export const role = {
  pageCanvas: 'min-h-svh bg-abnb-canvas text-abnb-ink antialiased',

  link: 'text-abnb-ink underline-offset-2 transition-colors hover:text-abnb-primary',

  linkMuted: 'text-abnb-muted transition-colors hover:text-abnb-ink',

  /** Eyebrow — nhẹ, uppercase tracking (marketing premium) */
  kicker:
    'text-xs font-semibold uppercase tracking-[0.14em] text-abnb-muted',

  /** Hero — display: tinh giản trọng lượng, Airbnb ưu tiên 500–600 */
  displayHero:
    'text-balance text-[2rem] font-semibold leading-[1.12] tracking-[-0.028em] text-abnb-ink sm:text-[2.5rem] md:text-[2.75rem] lg:text-[3.25rem] lg:leading-[1.08]',

  headingSection:
    'text-balance text-[1.375rem] font-semibold leading-snug tracking-[-0.02em] text-abnb-ink md:text-2xl md:leading-tight',

  headingModule:
    'text-[15px] font-semibold leading-snug tracking-[-0.01em] text-abnb-ink',

  bodyMd: 'text-[17px] font-normal leading-[1.55] text-abnb-body md:text-lg md:leading-relaxed',

  bodySm: 'text-sm font-normal leading-relaxed text-abnb-body',

  caption: 'text-sm font-medium text-abnb-muted',

  statLabel: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-abnb-mutedSoft',

  monoStat: 'text-xs font-semibold uppercase tracking-wide text-abnb-muted',

  /** Primary CTA — viên bo đầy (gần pill search Airbnb) */
  btnPrimary:
    'inline-flex h-[3.25rem] items-center justify-center rounded-full bg-abnb-primary px-8 text-[15px] font-semibold text-abnb-onPrimary shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-abnb-primaryActive hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-abnb-ink active:translate-y-0 disabled:cursor-not-allowed disabled:translate-y-0 disabled:bg-abnb-primaryDisabled disabled:shadow-none disabled:text-abnb-onPrimary',

  btnSecondary:
    'inline-flex h-[3.25rem] items-center justify-center rounded-full border border-abnb-hairline bg-abnb-canvas px-8 text-[15px] font-semibold text-abnb-ink shadow-sm transition-[transform,background-color,border-color] duration-200 hover:-translate-y-0.5 hover:border-abnb-borderStrong hover:bg-abnb-surfaceSoft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-abnb-ink active:translate-y-0',

  card:
    'rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-surfaceCard shadow-abnb transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-abnb-hairline hover:shadow-abnb-lg',

  cardQuiet:
    'rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-canvas',

  cardElevated:
    'rounded-abnb-lg border border-abnb-hairlineSoft bg-gradient-to-b from-white to-abnb-surfaceSoft shadow-abnb-lg',

  surfaceBand: 'bg-abnb-surfaceSoft',

  input:
    'h-14 w-full rounded-abnb-md border border-abnb-hairline bg-abnb-canvas px-4 py-2 text-base text-abnb-ink shadow-abnb-inner placeholder:text-abnb-muted transition-[border,box-shadow] focus:border-abnb-ink focus:outline-none focus:ring-2 focus:ring-abnb-ink/10',

  inputError: '!border-2 !border-abnb-error focus:!ring-abnb-error/15',

  topNav:
    'border-b border-abnb-hairlineSoft/80 bg-abnb-canvas/80 backdrop-blur-lg backdrop-saturate-150 shadow-[0_1px_0_rgba(0,0,0,0.03)] supports-[backdrop-filter]:bg-abnb-canvas/72',

  /** Shell app — nền mesh nhẹ theo DESIGN */
  appShellBg: 'min-h-svh bg-mesh-soft',

  /** pt rộng một chút dưới header sticky để không dính sát mép điều hướng */
  appMain: 'pb-14 pt-5 md:pb-20 md:pt-6',

  /** Khối tiêu đề trang trong app */
  pageHero:
    'relative overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft/90 bg-abnb-canvas/90 px-5 py-6 shadow-abnb sm:px-8 sm:py-7',

  /** Ô icon trong thẻ (Trang nhà / CTA) */
  iconTile:
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-abnb-md bg-gradient-to-br from-abnb-primary/[0.14] to-abnb-luxe/[0.08] text-abnb-primary shadow-abnb-inner ring-1 ring-abnb-hairlineSoft/70',

  /** Nhóm nav dạng capsule (desktop) */
  appNavTrack:
    'flex max-w-[100vw] items-center gap-0.5 overflow-x-auto rounded-full bg-abnb-surfaceSoft/95 p-1 pl-1.5 pr-1.5 ring-1 ring-abnb-hairlineSoft/80 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-none',

  /** Segment control (cây / force) */
  segmentedTrack: 'inline-flex rounded-full bg-abnb-surfaceStrong/90 p-1 ring-1 ring-abnb-hairlineSoft/80',

  segmentBtn:
    'rounded-full px-4 py-2 text-[13px] font-semibold transition-all duration-200',

  segmentBtnActive: 'bg-abnb-canvas text-abnb-ink shadow-abnb',

  segmentBtnInactive: 'text-abnb-muted hover:text-abnb-body',

  footer: 'border-t border-abnb-hairlineSoft bg-abnb-surfaceSoft/50',

  legalTiny: 'text-[13px] font-normal leading-snug text-abnb-muted',
} as const
