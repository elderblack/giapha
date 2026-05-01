export function profileAllowsPasswordChange(identities: { provider: string }[] | undefined): boolean {
  if (!identities?.length) return false
  return identities.some((i) => i.provider === 'email' || i.provider === 'phone')
}
