import { role } from '../../../design/roles'

const tiers = [
  {
    name: 'Free',
    price: '0đ',
    blurb: 'Bắt đầu cùng dòng họ',
    features: [
      'Tối đa 50 thành viên trong cây',
      'Bài đăng & chat cơ bản',
      'Nhắn tin 1-1; tối đa 3 nhóm',
    ],
    cta: 'Dùng miễn phí',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '99.000đ',
    period: '/tháng',
    blurb: 'Không giới hạn cá nhân',
    features: [
      'Không giới hạn thành viên, 5GB media',
      'Xuất PDF gia phả',
      'Nhóm tự động theo nhánh',
    ],
    cta: 'Nhận tin khi mở bán',
    highlight: true,
    badge: 'Phổ biến',
  },
  {
    name: 'Dòng họ',
    price: '499.000đ',
    period: '/tháng',
    blurb: 'Cả tộc cùng kho tài sản số',
    features: [
      '50GB lưu trữ, phân quyền nâng cao',
      'Hỗ trợ ưu tiên',
      'Tên miền riêng (theo cấu hình)',
    ],
    cta: 'Đăng ký quan tâm',
    highlight: false,
  },
] as const

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-abnb-hairlineSoft bg-abnb-surfaceSoft/30">
      <div className="lp-container lp-section">
        <div className="mx-auto max-w-2xl text-center">
          <p className={`${role.kicker} mb-5`}>Bảng giá</p>
          <h2 className={role.headingSection}>Chọn mức phù hợp dòng họ bạn</h2>
          <p className={`${role.bodyMd} mt-5 text-abnb-body`}>
            Thanh toán bật ở Giai đoạn 7; giá dự kiến theo tài liệu sản phẩm.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-3 md:gap-6 lg:mt-16">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                t.highlight
                  ? 'relative flex flex-col overflow-hidden rounded-abnb-xl border-2 border-abnb-primary bg-abnb-canvas p-7 shadow-abnb-lg md:p-8'
                  : `relative flex flex-col rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-canvas p-7 shadow-sm transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-abnb-lg md:p-8`
              }
            >
              {'badge' in t && t.badge ? (
                <span className="absolute right-5 top-5 rounded-full bg-abnb-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  {t.badge}
                </span>
              ) : null}
              <p
                className={
                  t.highlight
                    ? `${role.statLabel} text-abnb-primary`
                    : `${role.statLabel} text-abnb-muted`
                }
              >
                {t.name}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-[1.75rem] font-semibold tracking-tight text-abnb-ink">
                  {t.price}
                </span>
                {'period' in t && t.period ? (
                  <span className="text-sm font-medium text-abnb-muted">{t.period}</span>
                ) : null}
              </div>
              <p className={`${role.bodySm} mt-2 font-medium text-abnb-body`}>{t.blurb}</p>
              <ul className="mt-7 flex-1 space-y-3 border-t border-abnb-hairlineSoft pt-7">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-3 text-[15px] leading-snug text-abnb-body">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-abnb-primary"
                      aria-hidden
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#waitlist"
                className={
                  t.highlight
                    ? `${role.btnPrimary} mt-8 w-full justify-center !rounded-full`
                    : `${role.btnSecondary} mt-8 w-full justify-center !rounded-full`
                }
              >
                {t.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
