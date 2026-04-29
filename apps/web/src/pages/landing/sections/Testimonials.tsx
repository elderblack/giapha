import { role } from '../../../design/roles'

export function Testimonials() {
  const quotes = [
    {
      text: 'Cuối cùng có chỗ dòng họ tụ họp mà không bị lẫn với bảng tin thế giới.',
      author: 'Hội trưởng dòng họ',
      role: 'Beta',
    },
    {
      text: 'Cây gia phả nhìn một phát hiểu ngay tôi ở nhánh nào — đúng ý từ lâu.',
      author: 'Thành viên thử nghiệm',
      role: 'Họ Nguyễn',
    },
  ]
  return (
    <section className="border-b border-abnb-hairlineSoft bg-abnb-canvas">
      <div className="lp-container lp-section">
        <div className="mx-auto max-w-2xl text-center">
          <p className={`${role.kicker} mb-5`}>Phản hồi</p>
          <h2 className={role.headingSection}>Tiếng nói từ những người đi trước</h2>
          <p className={`${role.bodySm} mt-4 text-abnb-muted`}>Nội bộ beta — sẽ mở rộng khi ra mắt.</p>
        </div>
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:mt-16 lg:gap-6">
          {quotes.map((q) => (
            <li
              key={q.author}
              className="group relative flex flex-col rounded-abnb-xl border border-abnb-hairlineSoft bg-gradient-to-br from-white to-abnb-surfaceSoft/30 p-8 shadow-sm transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-abnb-lg sm:p-9"
            >
              <span
                className="font-serif text-5xl font-semibold leading-none text-abnb-primary/25"
                aria-hidden
              >
                &ldquo;
              </span>
              <p className={`${role.bodyMd} -mt-6 text-pretty text-abnb-ink`}>{q.text}</p>
              <div className="mt-8 flex items-center gap-3 border-t border-abnb-hairlineSoft pt-6">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-abnb-primary/12 text-sm font-semibold text-abnb-primary"
                  aria-hidden
                >
                  {q.author.charAt(0)}
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-abnb-ink">{q.author}</p>
                  <p className={`${role.caption} text-[13px]`}>{q.role}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
