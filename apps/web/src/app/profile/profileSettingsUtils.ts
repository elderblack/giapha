export function profileAllowsPasswordChange(identities: { provider: string }[] | undefined): boolean {
  if (!identities?.length) return false
  return identities.some((i) => i.provider === 'email' || i.provider === 'phone')
}

export type ProfileSettingsRow = {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  cover_url: string | null
  bio: string | null
  hometown: string | null
  current_city: string | null
  occupation: string | null
  phone: string | null
}
