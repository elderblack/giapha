import { role } from '../../../design/roles'

const steps = [
  {
    step: '01',
    title: 'Khởi tạo dòng họ',
    body: 'Đặt tên chi họ, tỉnh thành, mô tả ngắn — bắt đầu trong vài phút.',
  },
  {
    step: '02',
    title: 'Thêm thành viên & nhánh',
    body: 'Thêm tổ tiên, phân nhánh, mời người thân gắn tài khoản.',
  },
  {
    step: '03',
    title: 'Hoàn thiện gia phả',
    body: 'Đăng bài, trò chuyện, nhắc giỗ — một nơi cho cả dòng họ.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-abnb-hairlineSoft bg-abnb-surfaceSoft/40">
      <div className="lp-container lp-section">
        <div className="mx-auto max-w-2xl text-center">
          <p className={`${role.kicker} mb-5`}>Ba bước</p>
          <h2 className={role.headingSection}>Từ khởi tạo đến cộng đồng sống</h2>
          <p className={`${role.bodyMd} mt-5 text-abnb-body`}>
            Quy trình rõ ràng — không cần làm kỹ sư để có cây đẹp.
          </p>
        </div>

        {/* Mobile: vertical */}
        <ol className="mx-auto mt-14 max-w-lg space-y-0 lg:hidden">
          {steps.map((s, i) => (
            <li key={s.step} className="relative flex gap-5 pb-10 last:pb-0">
              {i < steps.length - 1 ? (
                <span
                  className="absolute left-[0.9375rem] top-10 h-[calc(100%-0.25rem)] w-px bg-abnb-hairlineSoft"
                  aria-hidden
                />
              ) : null}
              <span
                className="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-abnb-canvas bg-abnb-primary text-[11px] font-bold text-white shadow-sm"
              >
                {i + 1}
              </span>
              <div className={`${role.cardQuiet} flex-1 p-5 shadow-sm`}>
                <h3 className={`${role.headingModule} text-[16px]`}>{s.title}</h3>
                <p className={`${role.bodySm} mt-2 leading-relaxed`}>{s.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Desktop: horizontal */}
        <div className="relative mx-auto mt-16 hidden max-w-5xl lg:block">
          <div
            className="absolute left-[12%] right-[12%] top-[1.125rem] h-px bg-gradient-to-r from-transparent via-abnb-hairline to-transparent"
            aria-hidden
          />
          <ol className="grid grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <li key={s.step} className="relative text-center">
                <span
                  className="relative z-[1] mx-auto flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-abnb-canvas bg-abnb-primary text-[12px] font-bold text-white shadow-md"
                >
                  {i + 1}
                </span>
                <div className="mt-8 rounded-abnb-xl border border-abnb-hairlineSoft bg-abnb-canvas p-6 text-left shadow-abnb transition-shadow hover:shadow-abnb-lg">
                  <h3 className={`${role.headingModule} text-[16px]`}>{s.title}</h3>
                  <p className={`${role.bodySm} mt-3 leading-relaxed`}>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
