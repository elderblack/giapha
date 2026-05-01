/** Khớp `ChartMember` của web để chia sẻ layout phả hệ */
export type ChartMember = {
  id: string
  full_name: string
  gender?: string | null
  father_id: string | null
  mother_id: string | null
  spouse_id?: string | null
  lineage_generation?: number | null
  avatar_url?: string | null
}
