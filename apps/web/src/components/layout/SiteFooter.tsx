import { Link } from 'react-router-dom'
import { TreePine } from 'lucide-react'
import { role } from '../../design/roles'

export function SiteFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className={role.footer}>
      <div className="lp-container max-w-abnb py-14 lg:py-20">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-abnb-md bg-abnb-canvas text-abnb-primary shadow-abnb ring-1 ring-abnb-hairlineSoft"
                aria-hidden
              >
                <TreePine className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className={`${role.headingModule} text-[17px]`}>GiaPhả</span>
            </div>
            <p className={`${role.bodySm} mt-5 max-w-sm leading-relaxed`}>
              Mạng xã hội dòng họ và cây gia phả — một nền tảng, nhiều thế hệ, một không gian riêng
              cho họ hàng.
            </p>
          </div>
          <div className="grid gap-10 sm:grid-cols-2 md:gap-8 lg:col-span-7 lg:grid-cols-2">
            <div>
              <p className={role.statLabel}>Sản phẩm</p>
              <ul className="mt-4 space-y-3">
                <li>
                  <a href="#features" className={`${role.linkMuted} text-[15px] no-underline`}>
                    Tính năng
                  </a>
                </li>
                <li>
                  <a href="#pricing" className={`${role.linkMuted} text-[15px] no-underline`}>
                    Bảng giá
                  </a>
                </li>
                <li>
                  <a href="#waitlist" className={`${role.linkMuted} text-[15px] no-underline`}>
                    Đăng ký sớm
                  </a>
                </li>
                <li>
                  <Link to="/roadmap" className={`${role.linkMuted} text-[15px] no-underline`}>
                    Lộ trình phát triển
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className={role.statLabel}>Ứng dụng</p>
              <ul className="mt-4 space-y-3">
                <li>
                <Link to="/app" className={`${role.linkMuted} text-[15px] no-underline`}>
                  Vào web app
                </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-14 border-t border-abnb-hairlineSoft pt-8">
          <p className={role.legalTiny}>
            © {year} GiaPhả. Cấu trúc nội dung tham khảo{' '}
            <a
              href="https://giaphadaiviet.vn/"
              className="text-abnb-legalLink underline-offset-2 hover:underline"
            >
              giaphadaiviet.vn
            </a>
            . Hệ màu & component theo DESIGN.md (Airbnb).
          </p>
        </div>
      </div>
    </footer>
  )
}
