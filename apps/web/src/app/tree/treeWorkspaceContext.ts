import { createContext, useContext } from 'react'
import type { ChartMember } from '../../components/FamilyTreeChart'
import type { MemberRow, TreeRow } from './treeTypes'

export type TreeWorkspaceValue = {
  treeId: string
  tree: TreeRow | null | undefined
  treeLoadErr: string | null
  members: MemberRow[] | null
  membersErr: string | null
  /** False khi DB chưa có migration cột `family_tree_members.phone` (đã fallback select không có phone). */
  supportsMemberPhoneColumn: boolean
  loadMembers: (opts?: { force?: boolean }) => Promise<void>
  isOwner: boolean
  /** Role trong family_tree_roles cho cây hiện tại (chủ thường có 'owner' trong bảng) */
  myTreeRole: 'owner' | 'editor' | 'member' | null
  /** Đang là thành viên tài khoản của cây (có dòng role hoặc là owner_id trên cây) */
  hasTreeRole: boolean
  /** Chỉnh sửa danh sách người trong cây (chủ hoặc editor) */
  canEditMembers: boolean
  canUseClaim: boolean
  myLinkedMemberId: string | null
  generations: Map<string, number>
  chartMembers: ChartMember[]
  linkBusyId: string | null
  linkMsg: string | null
  setLinkMsg: (v: string | null) => void
  claimMember: (memberId: string) => Promise<void>
  unlinkMember: (memberId: string) => Promise<void>
  /** Tải lại hàng family_trees (sau khi chủ sửa brand / ảnh bìa…). */
  reloadTree: () => Promise<void>
}

export const TreeWorkspaceContext = createContext<TreeWorkspaceValue | null>(null)

export function useTreeWorkspace() {
  const ctx = useContext(TreeWorkspaceContext)
  if (!ctx) throw new Error('useTreeWorkspace must be used inside TreeWorkspaceProvider')
  return ctx
}
