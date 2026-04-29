/** Hằng số & helper UI dòng họ — tách khỏi component để fast-refresh sạch */

export function memberInitial(name: string): string {
  const t = name.trim()
  if (!t) return '?'
  return t[0]?.toUpperCase() ?? '?'
}

export const treeAlertErr =
  'rounded-abnb-lg border border-abnb-error/25 bg-abnb-error/[0.06] px-4 py-3 text-sm text-abnb-error'
export const treeAlertInfo =
  'rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-surfaceSoft/60 px-4 py-3 text-sm text-abnb-body'
