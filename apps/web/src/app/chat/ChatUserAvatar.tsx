import { User } from 'lucide-react'

/** Avatar DM: ảnh hoặc icon người mặc định trong vòng tròn (đồng bộ UX với mobile). */
export function ChatUserAvatar(props: {
  avatarUrl?: string | null
  alt?: string
  size?: 'sm' | 'md'
}) {
  const cls = props.size === 'sm' ? 'h-9 w-9 text-[17px]' : 'h-11 w-11 text-[20px]'
  if (props.avatarUrl) {
    return (
      <img src={props.avatarUrl} alt={props.alt ?? ''} className={`${cls} shrink-0 rounded-full object-cover`} />
    )
  }
  return (
    <span
      className={`flex ${cls} shrink-0 items-center justify-center rounded-full bg-abnb-primary/12 text-abnb-primary ring-2 ring-abnb-canvas`}
      aria-hidden
    >
      <User className={props.size === 'sm' ? 'h-[18px] w-[18px]' : 'h-[22px] w-[22px]'} strokeWidth={2} />
    </span>
  )
}
