/** Thế hệ: mức sàn từ lineage_generation (đời trong phả); cộng cạnh cha/mẹ; đồng bộ vợ/chồng. */

export function computeMemberGenerations(
  members: {
    id: string
    father_id: string | null
    mother_id: string | null
    spouse_id?: string | null
    lineage_generation?: number | null
  }[],
): Map<string, number> {
  const gen = new Map<string, number>()
  for (const m of members) gen.set(m.id, Math.max(0, m.lineage_generation ?? 0))

  let changed = true
  let guard = 0
  const limit = members.length * 6 + 24
  while (changed && guard < limit) {
    guard += 1
    changed = false

    for (const m of members) {
      let next = gen.get(m.id) ?? 0
      if (m.father_id) next = Math.max(next, (gen.get(m.father_id) ?? -1) + 1)
      if (m.mother_id) next = Math.max(next, (gen.get(m.mother_id) ?? -1) + 1)
      const cur = gen.get(m.id) ?? 0
      if (next > cur) {
        gen.set(m.id, next)
        changed = true
      }
    }

    for (const m of members) {
      if (!m.spouse_id) continue
      const a = gen.get(m.id) ?? 0
      const b = gen.get(m.spouse_id) ?? 0
      const t = Math.max(a, b)
      if (t > a) {
        gen.set(m.id, t)
        changed = true
      }
      if (t > b) {
        gen.set(m.spouse_id, t)
        changed = true
      }
    }
  }
  return gen
}
