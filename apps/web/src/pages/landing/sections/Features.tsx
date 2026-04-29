import { Bell, MessageCircle, TreePine, Users } from 'lucide-react'
import { landingMedia } from '../../../content/landingMedia'
import { role } from '../../../design/roles'

const items = [
  {
    title: 'Cây gia phả trực quan',
    desc: 'D3 & SVG, thế hệ, vai vế theo tập quán Việt Nam — tìm kiếm, zoom, điều hướng mượt.',
    icon: TreePine,
  },
  {
    title: 'Mạng xã hội dòng họ',
    desc: 'Profile, bảng tin, tưởng nhớ, cột mốc — chỉ trong họ.',
    icon: Users,
  },
  {
    title: 'Chat & nhóm nhánh',
    desc: 'Tin nhắn 1-1, nhóm tự tạo hoặc gợi ý theo cây (Pro).',
    icon: MessageCircle,
  },
  {
    title: 'Nhắc âm lịch',
    desc: 'Sinh nhật, giỗ — thông báo đúng văn hoá.',
    icon: Bell,
  },
] as const

export function Features() {
  return (
    <section id="features" className="border-b border-abnb-hairlineSoft bg-abnb-canvas">
      <div className="lp-container lp-section">
        <div className="mx-auto max-w-2xl text-center">
          <p className={`${role.kicker} mb-5`}>Tính năng</p>
          <h2 className={role.headingSection}>Mọi thứ cần cho một dòng họ</h2>
          <p className={`${role.bodyMd} mt-5 text-pretty text-abnb-body`}>
            Hai trụ cột song song: cộng đồng gắn kết và cây gia phả rõ ràng — không phải chọn một
            trong hai.
          </p>
        </div>

        <figure className="relative mx-auto mt-12 max-w-5xl overflow-hidden rounded-abnb-xl shadow-abnb-lg ring-1 ring-abnb-hairlineSoft lg:mt-14">
          <div className="aspect-[21/9] min-h-[12rem] sm:min-h-[14rem] md:min-h-[16rem]">
            <img
              src={landingMedia.featuresBanner.src}
              alt={landingMedia.featuresBanner.alt}
              width={2000}
              height={857}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover object-[center_40%]"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-abnb-ink/45 via-abnb-ink/15 to-transparent"
            aria-hidden
          />
          <figcaption className="absolute bottom-0 left-0 max-w-md p-5 sm:p-6 md:p-8">
            <p className="text-lg font-semibold leading-snug text-white drop-shadow-sm sm:text-xl">
              Một không gian cho cả nhà — ảnh, chuyện kể và lịch giỗ trong cùng một nơi.
            </p>
            <a
              href={landingMedia.featuresBanner.creditUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-block text-[11px] font-medium text-white/80 underline decoration-white/35 underline-offset-2 hover:text-white"
            >
              {landingMedia.featuresBanner.creditLabel}
            </a>
          </figcaption>
        </figure>

        <ul className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {items.map(({ title, desc, icon: Icon }) => (
            <li
              key={title}
              className="group relative overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft bg-gradient-to-b from-white to-abnb-surfaceSoft/40 p-6 shadow-sm ring-1 ring-black/[0.02] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-abnb-lg sm:p-7"
            >
              <div
                className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-abnb-primary/[0.07] blur-2xl transition-opacity group-hover:opacity-100"
                aria-hidden
              />
              <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-abnb-md bg-abnb-canvas text-abnb-primary shadow-abnb ring-1 ring-abnb-hairlineSoft">
                <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </span>
              <h3 className={`${role.headingModule} relative mt-5 text-[17px] transition-colors group-hover:text-abnb-primary`}>
                {title}
              </h3>
              <p className={`${role.bodySm} relative mt-3 leading-relaxed`}>{desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
