import { Briefcase, MapPin, UserRound } from 'lucide-react'
import { role } from '../../design/roles'

export type ProfilePublicFields = {
  full_name: string
  hometown: string | null
  current_city: string | null
  occupation: string | null
}

export function ProfileAboutView({ profile }: { profile: ProfilePublicFields }) {
  const rows: { icon: typeof MapPin; label: string; value: string | null | undefined }[] = [
    { icon: MapPin, label: 'Quê quán', value: profile.hometown?.trim() || null },
    { icon: MapPin, label: 'Đang sống tại', value: profile.current_city?.trim() || null },
    { icon: Briefcase, label: 'Nghề nghiệp', value: profile.occupation?.trim() || null },
  ]

  const filled = rows.filter((r) => r.value)

  return (
    <div className="overflow-hidden rounded-abnb-xl border border-abnb-hairlineSoft/90 bg-gradient-to-br from-abnb-surfaceCard via-abnb-surfaceCard to-abnb-primary/[0.04] shadow-abnb">
      <div className="border-b border-abnb-hairlineSoft/80 bg-abnb-surfaceSoft/60 px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-abnb-lg bg-abnb-primary/12 text-abnb-primary ring-1 ring-abnb-primary/15">
            <UserRound className="h-[1.35rem] w-[1.35rem]" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h2 className={`${role.headingSection} m-0 text-[1.05rem]`}>Giới thiệu</h2>
            <p className={`${role.caption} m-0 mt-1 text-abnb-muted`}>
              Tiểu sử hiển thị phía trên; phần dưới là thông tin bổ sung (cùng nhìn thấy khi là thành viên cùng dòng họ).
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-6 sm:px-7">
        {filled.length === 0 ? (
          <p className={`${role.bodySm} m-0 text-center text-abnb-muted`}>
            Chưa có thông tin giới thiệu công khai.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {filled.map((row) => (
              <li
                key={row.label}
                className="flex gap-4 rounded-abnb-lg border border-abnb-hairlineSoft/70 bg-abnb-canvas/90 px-4 py-4 sm:gap-5 sm:px-5"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-abnb-surfaceSoft text-abnb-muted ring-1 ring-abnb-hairlineSoft/90">
                  <row.icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={2} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`${role.caption} m-0 font-semibold uppercase tracking-wide text-abnb-muted`}>
                    {row.label}
                  </p>
                  <p className={`${role.bodyMd} m-0 mt-1 whitespace-pre-wrap break-words text-abnb-body`}>
                    {row.value}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
