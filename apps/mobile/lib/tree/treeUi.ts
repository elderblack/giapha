export function memberInitial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]?.toUpperCase() ?? '?'
}
