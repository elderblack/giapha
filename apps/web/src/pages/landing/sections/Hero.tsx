import { Link } from 'react-router-dom'
import { MessageCircle, Share2, Sparkles, TreePine } from 'lucide-react'
import { landingMedia } from '../../../content/landingMedia'
import { role } from '../../../design/roles'

function TreeVisualFloating() {
  return (
    <div className="relative mx-auto w-full max-w-[26rem] lg:mx-0">
      <div
        className="pointer-events-none absolute -right-4 -top-8 h-40 w-40 rounded-full bg-abnb-primary/15 blur-3xl md:h-52 md:w-52"
        aria-hidden
      />
      <div
        className={`relative overflow-hidden rounded-abnb-xl border border-white/70 bg-gradient-to-br from-white via-abnb-canvas to-abnb-surfaceSoft p-1 shadow-abnb-lg ring-1 ring-abnb-hairlineSoft`}
      >
        <div className="relative rounded-[calc(0.875rem-1px)] bg-abnb-canvas/95 p-6 shadow-abnb-inner md:p-7">
          <div className="absolute inset-0 bg-mesh-soft opacity-90" aria-hidden />
          <div className="absolute inset-0 overflow-hidden rounded-[inherit] opacity-[0.14]">
            <svg className="h-full w-full" viewBox="0 0 400 320" fill="none" aria-hidden>
              <path
                d="M200 28 L200 108 M108 108 L200 108 L292 108 M200 108 L200 196 M156 196 L200 196 L244 196 M200 196 L200 278"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-abnb-primary"
              />
            </svg>
          </div>
          <div className="relative flex flex-col gap-5">
            <div className="flex items-center justify-between gap-4">
              <div
                className={`inline-flex items-center gap-2 rounded-full border border-abnb-hairlineSoft bg-abnb-surfaceSoft/90 px-3 py-1.5 text-[12px] font-semibold text-abnb-ink shadow-sm`}
              >
                <TreePine className="h-3.5 w-3.5 text-abnb-primary" strokeWidth={2.25} />
                Cây tương tác
              </div>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-abnb-primary/10 text-abnb-primary">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            </div>
            <div className="space-y-3 border-t border-abnb-hairlineSoft pt-5">
              <p className={`${role.bodySm} flex items-start gap-2.5 font-medium text-abnb-ink`}>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-abnb-md bg-abnb-surfaceSoft ring-1 ring-abnb-hairlineSoft">
                  <Share2 className="h-3.5 w-3.5 text-abnb-primary" strokeWidth={1.75} />
                </span>
                Bảng tin & ký ức dòng họ.
              </p>
              <p className={`${role.bodySm} flex items-start gap-2.5 font-medium text-abnb-ink`}>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-abnb-md bg-abnb-surfaceSoft ring-1 ring-abnb-hairlineSoft">
                  <MessageCircle className="h-3.5 w-3.5 text-abnb-primary" strokeWidth={1.75} />
                </span>
                Chat & nhóm theo nhánh.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroFigure() {
  const { src, alt, creditUrl, creditLabel } = landingMedia.hero
  return (
    <figure className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="relative aspect-[3/4] overflow-hidden rounded-abnb-xl shadow-abnb-lg ring-1 ring-abnb-hairlineSoft sm:aspect-[5/6] lg:aspect-[4/5]">
        <img
          src={src}
          alt={alt}
          width={800}
          height={1000}
          decoding="async"
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover object-[center_25%]"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-abnb-ink/35 via-abnb-ink/5 to-transparent"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-abnb-primary/10"
          aria-hidden
        />
        <figcaption className="absolute bottom-0 left-0 right-0 px-4 py-3 text-end">
          <a
            href={creditUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-[11px] font-medium text-white/85 underline decoration-white/40 underline-offset-2 transition-opacity hover:text-white"
          >
            {creditLabel}
          </a>
        </figcaption>
      </div>
      {/* Thẻ tính năng chồng lên ảnh — desktop: góc dưới trái; mobile: chồng dưới */}
      <div className="relative z-10 -mt-14 px-2 sm:-mt-16 sm:px-4 lg:absolute lg:bottom-6 lg:left-6 lg:right-auto lg:mt-0 lg:max-w-[min(100%,19.5rem)] lg:px-0">
        <TreeVisualFloating />
      </div>
    </figure>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-abnb-hairlineSoft bg-abnb-canvas">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" aria-hidden />
      <div className="pointer-events-none absolute inset-0 bg-hero-radial-secondary" aria-hidden />
      <div className="lp-container lp-section relative pb-20 pt-6 md:pb-24 md:pt-8 lg:pb-28 lg:pt-10">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="animate-fade-up lg:col-span-6">
            <p className={`${role.kicker} mb-5`}>Phần mềm gia phả trực tuyến</p>
            <h1 className={role.displayHero}>
              Gắn kết mọi{' '}
              <span className="relative inline-block">
                <span className="relative z-10 text-abnb-primary">thế hệ</span>
                <span
                  className="absolute -bottom-1 left-0 right-0 z-0 h-3 rounded-sm bg-abnb-primary/15"
                  aria-hidden
                />
              </span>
            </h1>
            <p className={`${role.bodyMd} mt-7 max-w-xl text-pretty`}>
              Kết nối họ hàng, lưu cây gia phả, chia sẻ ký ức — một nền tảng cho người Việt, nơi
              cộng đồng và phả hệ đứng cạnh nhau, rõ ràng và ấm áp.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
              <a href="#waitlist" className={role.btnPrimary}>
                Đăng ký sớm
              </a>
              <Link to="/app" className={role.btnSecondary}>
                Xem bản thử
              </Link>
            </div>
            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-abnb-hairlineSoft pt-10 sm:max-w-md sm:gap-8">
              <div>
                <dt className={role.statLabel}>Không gian</dt>
                <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-abnb-ink">
                  Riêng tư
                </dd>
              </div>
              <div>
                <dt className={role.statLabel}>Phả hệ</dt>
                <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-abnb-ink">
                  Một cây
                </dd>
              </div>
              <div>
                <dt className={role.statLabel}>Truyền thống</dt>
                <dd className="mt-1.5 text-2xl font-semibold tracking-tight text-abnb-ink">
                  Âm lịch
                </dd>
              </div>
            </dl>
          </div>
          <div className="animate-fade-up-delay lg:col-span-6 lg:justify-self-stretch">
            <HeroFigure />
          </div>
        </div>
      </div>
    </section>
  )
}
