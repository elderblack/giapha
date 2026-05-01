export type TreeRow = {
  id: string
  name: string
  clan_name: string | null
  origin_place: string | null
  description: string | null
  owner_id: string | null
  /** Tên trên header app (chủ dòng); null = mặc định app ("Cội Nguồn"). */
  app_header_display_name?: string | null
  /** Path trong bucket family-tree-brand. */
  app_header_logo_path?: string | null
  cover_url?: string | null
}

export type MemberRow = {
  id: string
  family_tree_id: string
  full_name: string
  gender: string | null
  birth_date: string | null
  death_date: string | null
  notes: string | null
  father_id: string | null
  mother_id: string | null
  /** Đời trong phả (0=đời 1, 1=đời 2…). Tùy chọn; dùng khi chưa gắn cha/mẹ mà vẫn cần đúng tầng trên sơ đồ */
  lineage_generation?: number | null
  spouse_id: string | null
  /** SĐT (VN); nếu có — chủ/biên tập có thể cấp tài khoản mật khẩu không cần email */
  phone?: string | null
  linked_profile_id: string | null
  birth_lunar_text?: string | null
  death_lunar_text?: string | null
  memorial_note?: string | null
  /** Gửi email nhắc giỗ (theo kỷ niệm ngày mất dương lịch, giờ VN) */
  memorial_reminder_enabled?: boolean | null
  /** Nhắc theo kỷ niệm ngày mất âm (suy từ death_date); false = kỷ niệm dương */
  memorial_reminder_use_lunar?: boolean | null
  /** Nhắc trước N ngày so với ngày kỷ niệm; 0 = đúng ngày */
  memorial_reminder_days_before?: number | null
  /** Ảnh đại diện từ profiles khi đã liên kết tài khoản */
  avatar_url?: string | null
}

export function claimRpcErrorVi(code: string | undefined): string {
  switch (code) {
    case 'unauthorized':
      return 'Bạn cần đăng nhập.'
    case 'forbidden':
      return 'Bạn không thuộc dòng họ này — không thể liên kết.'
    case 'not_found':
      return 'Không tìm thấy thành viên.'
    case 'already_linked':
      return 'Node này đã liên kết với một tài khoản khác.'
    case 'already_claimed_other':
      return 'Bạn đã liên kết với một người khác trong cây này.'
    default:
      return 'Không thực hiện được.'
  }
}

/** Hậu duệ của `rootId` (gồm cả chính `rootId`) — theo quan hệ cha/mẹ → con */
export function membersInDescendantSubtree(members: MemberRow[], rootId: string): MemberRow[] {
  const ids = new Set<string>([rootId])
  let added = true
  while (added) {
    added = false
    for (const m of members) {
      if (ids.has(m.id)) continue
      if ((m.father_id && ids.has(m.father_id)) || (m.mother_id && ids.has(m.mother_id))) {
        ids.add(m.id)
        added = true
      }
    }
  }
  return members.filter((m) => ids.has(m.id))
}

export function memberRequestRpcErrorVi(code: string | undefined): string {
  switch (code) {
    case 'unauthorized':
      return 'Bạn cần đăng nhập.'
    case 'forbidden':
      return 'Bạn không có quyền duyệt đề xuất này.'
    case 'not_found':
      return 'Không tìm thấy đề xuất.'
    case 'not_pending':
      return 'Đề xuất đã được xử lý trước đó.'
    case 'only_member_role':
      return 'Chức năng này chỉ dành cho thành viên thường (chủ hoặc biên tập viên thêm người trực tiếp).'
    case 'must_claim_node':
      return 'Bạn cần liên kết tài khoản với một người trên cây trước khi đề xuất thêm người.'
    case 'name_too_short':
      return 'Tên cần ít nhất 2 ký tự.'
    case 'invalid_spouse':
      return 'Chọn người làm vợ/chồng không hợp lệ.'
    case 'spouse_not_same_generation':
      return 'Chỉ có thể đề xuất vợ/chồng cùng thế hệ với người bạn đã liên kết.'
    case 'invalid_child_parent':
      return 'Thông tin cha/mẹ trong đề xuất con không hợp lệ.'
    case 'parent_not_in_your_branch':
      return 'Người làm cha/mẹ phải thuộc nhánh của bạn trên cây.'
    case 'invalid_kind':
      return 'Loại đề xuất không hợp lệ.'
    default:
      return 'Không thực hiện được.'
  }
}

export function inviteViaRpcErrorVi(code: string | undefined): string {
  switch (code) {
    case 'unauthorized':
      return 'Bạn cần đăng nhập.'
    case 'invalid_token':
      return 'Liên kết không hợp lệ hoặc đã hết hạn.'
    case 'need_email_account':
      return 'Tài khoản của bạn chưa có email — hãy đăng nhập bằng email hoặc thêm email trong cài đặt tài khoản.'
    case 'email_mismatch':
      return 'Phải đăng nhập bằng đúng email đã nhập khi tạo lời mời.'
    case 'already_linked':
      return 'Node này đã có người liên kết.'
    case 'already_claimed_other':
      return 'Bạn đã liên kết một người khác trong cây này.'
    case 'already_in_another_tree':
      return 'Bạn đã thuộc một dòng họ khác — không thể nhận lời mời này.'
    case 'not_found':
      return 'Không tìm thấy dữ liệu liên quan.'
    default:
      return 'Không thực hiện được.'
  }
}

export function provisionMemberPhoneErrorVi(code: string | undefined): string {
  switch (code) {
    case 'unauthorized':
      return 'Bạn cần đăng nhập.'
    case 'forbidden':
      return 'Chỉ chủ hoặc biên tập viên có thể cấp tài khoản.'
    case 'not_found':
      return 'Không tìm thấy thành viên.'
    case 'already_linked':
      return 'Node này đã có người liên kết.'
    case 'need_valid_phone':
      return 'Số điện thoại không hợp lệ hoặc đang trống — lưu SĐT chuẩn VN (vd. 0912345678) trước.'
    case 'phone_user_linked_other_node':
      return 'Số này đã gắn tài khoản khác trong cây — không thể gán trùng.'
    case 'already_in_another_tree':
      return 'Tài khoản đó đã thuộc dòng họ khác — không thể gán vào node này.'
    case 'create_failed':
      return 'Không tạo được tài khoản (kiểm tra Auth: bật đăng nhập SĐT / SMS).'
    case 'role_insert_failed':
      return 'Đã tạo tài khoản nhưng không gán quyền trong dòng họ — liên hệ quản trị.'
    default:
      return 'Không cấp được tài khoản.'
  }
}

export function inviteCreateRpcErrorVi(code: string | undefined): string {
  switch (code) {
    case 'unauthorized':
      return 'Bạn cần đăng nhập.'
    case 'invalid_email':
      return 'Email không hợp lệ.'
    case 'not_found':
      return 'Không tìm thấy thành viên.'
    case 'already_linked':
      return 'Node này đã có người liên kết.'
    case 'forbidden':
      return 'Chỉ chủ hoặc biên tập viên có thể tạo lời mời.'
    default:
      return 'Không tạo được lời mời.'
  }
}

export type MemberRequestRow = {
  id: string
  family_tree_id: string
  requested_by: string
  status: 'pending' | 'approved' | 'rejected'
  request_kind: 'spouse' | 'child'
  spouse_of_member_id: string | null
  child_parent_member_id: string | null
  child_parent_as: 'father' | 'mother' | null
  full_name: string
  gender: string | null
  birth_date: string | null
  death_date: string | null
  notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  reject_reason: string | null
  created_at: string
}

export const genderLabel: Record<string, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
}

export function parentLabel(members: MemberRow[], id: string | null): string {
  if (!id) return '—'
  return members.find((m) => m.id === id)?.full_name ?? '—'
}

export function spouseLabel(members: MemberRow[], m: MemberRow): string {
  if (m.spouse_id) {
    return members.find((x) => x.id === m.spouse_id)?.full_name ?? '—'
  }
  const rev = members.find((x) => x.spouse_id === m.id)
  return rev?.full_name ?? '—'
}

export function formatDateVi(iso: string | null): string {
  if (!iso) return '—'
  const t = iso.slice(0, 10)
  const [y, mo, d] = t.split('-')
  if (!y || !mo || !d) return iso
  return `${d}/${mo}/${y}`
}

/** Parse YYYY-MM-DD theo lịch địa phương (tránh lệch ngày theo UTC). */
export function parseLocalYmd(iso: string | null): Date | null {
  if (!iso) return null
  const t = iso.slice(0, 10)
  const [ys, ms, ds] = t.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return dt
}

/** Số tuổi đủ (đã qua sinh nhật trong năm của `ref`). */
export function completedYearsBetween(birth: Date, ref: Date): number {
  let years = ref.getFullYear() - birth.getFullYear()
  const monthDiff = ref.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) years--
  return Math.max(0, years)
}

/**
 * Tuổi hiện tại nếu còn sống, tuổi lúc mất nếu có `death_date`; không có ngày sinh → "—".
 */
export function formatMemberAgeVi(member: Pick<MemberRow, 'birth_date' | 'death_date'>): string {
  const birth = parseLocalYmd(member.birth_date)
  if (!birth) return '—'
  const death = parseLocalYmd(member.death_date)
  const end = death ?? new Date()
  if (death && end.getTime() < birth.getTime()) return '—'
  const years = completedYearsBetween(birth, end)
  return `${years} tuổi`
}

export function dateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}
