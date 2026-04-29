import { role } from '../../../design/roles'

export function ProblemSolution() {
  return (
    <section
      className={`${role.surfaceBand} border-b border-abnb-hairlineSoft`}
    >
      <div className="lp-container lp-section">
        <div className="mx-auto max-w-3xl text-center lg:max-w-4xl">
          <p className={`${role.kicker} mb-5`}>Vì sao cần GiaPhả</p>
          <h2 className={`${role.headingSection} mx-auto max-w-[22ch]`}>
            Gia phả thất lạc — họ hàng xa cách — ký ức phai mờ
          </h2>
          <p
            className={`${role.bodyMd} mx-auto mt-8 max-w-2xl text-pretty text-abnb-body`}
          >
            GiaPhả không phải bảng tin cho bạn bè ngẫu nhiên. Đây là nơi kể chuyện gia đình, nhắc giỗ
            đúng văn hóa, và{' '}
            <span className="font-medium text-abnb-ink">nhìn rõ bạn đứng ở đâu trên cây</span>.
          </p>
        </div>
        <ul className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { t: 'Một nguồn sự thật', d: 'Cây & hồ sơ đồng bộ, ít phân mảnh.' },
            { t: 'Ngữ cảnh Việt', d: 'Vai vế, giỗ chạp, âm lịch trong một chỗ.' },
            { t: 'Khép kín họ hàng', d: 'Chia sẻ có kiểm soát, không ồn ào MXH.' },
          ].map((item) => (
            <li
              key={item.t}
              className="rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-canvas px-5 py-5 text-left shadow-sm transition-shadow duration-300 hover:shadow-abnb"
            >
              <p className="text-[15px] font-semibold text-abnb-ink">{item.t}</p>
              <p className={`${role.bodySm} mt-2 leading-relaxed`}>{item.d}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
