import { Link, useNavigate } from 'react-router-dom'
import { Link2, Loader2, Pencil, Trash2, UserPlus, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { role } from '../design/roles'
import { getSupabase } from '../lib/supabase'
import { AddMemberModal } from './tree/AddMemberModal'
import { MemberPhoneAccountCard } from './tree/MemberPhoneAccountCard'
import {
  dateInputValue,
  formatDateVi,
  genderLabel,
  memberRequestRpcErrorVi,
  parentLabel,
  spouseLabel,
  type MemberRequestRow,
  type MemberRow,
} from './tree/treeTypes'
import { applySpouseLink, clearMemberSpouse } from './tree/treeMemberDb'
import { TreePageIntro } from './tree/TreeChrome'
import { memberInitial, treeAlertErr } from './tree/treeUi'
import { useTreeWorkspace } from './tree/treeWorkspaceContext'
import { feedUserProfilePath } from './feed/feedProfileHref'
import { broadcastFamilyChatThreadsReload } from './chat/chatReadSync'
import { LunarFromSolarButton } from './tree/LunarFromSolarButton'
import { TreeMembersSkeleton } from './tree/TreeTabSkeletons'

type AccountRoleRow = {
  user_id: string
  role: string
  profiles: { full_name: string } | null
}

export function TreeMembersPage() {
  const { user } = useAuth()
  const sb = getSupabase()
  const {
    treeId,
    tree,
    members,
    membersErr,
    loadMembers,
    isOwner,
    canEditMembers,
    canUseClaim,
    myLinkedMemberId,
    myTreeRole,
    hasTreeRole,
    generations,
    supportsMemberPhoneColumn,
    linkBusyId,
    linkMsg,
    claimMember,
    unlinkMember,
  } = useTreeWorkspace()

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalKey, setAddModalKey] = useState(0)
  const [branchGroupBusyMemberId, setBranchGroupBusyMemberId] = useState<string | null>(null)
  const [branchGroupErr, setBranchGroupErr] = useState<string | null>(null)
  const navigate = useNavigate()
  const [memberRequests, setMemberRequests] = useState<MemberRequestRow[] | null>(null)
  const [memberReqErr, setMemberReqErr] = useState<string | null>(null)
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [editDeathDate, setEditDeathDate] = useState('')
  const [editFatherId, setEditFatherId] = useState('')
  const [editMotherId, setEditMotherId] = useState('')
  const [editSpouseId, setEditSpouseId] = useState('')
  const [editLineageGen, setEditLineageGen] = useState('')
  const [editBirthLunar, setEditBirthLunar] = useState('')
  const [editDeathLunar, setEditDeathLunar] = useState('')
  const [editMemorialNote, setEditMemorialNote] = useState('')
  const [editMemorialReminder, setEditMemorialReminder] = useState(false)
  const [editMemorialUseLunar, setEditMemorialUseLunar] = useState(false)
  const [editMemorialDaysBefore, setEditMemorialDaysBefore] = useState('0')
  const [editPhone, setEditPhone] = useState('')
  const [editBusy, setEditBusy] = useState(false)
  const [editErr, setEditErr] = useState<string | null>(null)
  const [deleteErr, setDeleteErr] = useState<string | null>(null)
  const [accountRows, setAccountRows] = useState<AccountRoleRow[] | null>(null)
  const [accountErr, setAccountErr] = useState<string | null>(null)
  const [roleBusyUserId, setRoleBusyUserId] = useState<string | null>(null)

  const startEdit = useCallback(
    (m: MemberRow) => {
      setEditingId(m.id)
      setEditName(m.full_name)
      setEditGender(m.gender ?? '')
      setEditBirthDate(dateInputValue(m.birth_date))
      setEditDeathDate(dateInputValue(m.death_date))
      setEditFatherId(m.father_id ?? '')
      setEditMotherId(m.mother_id ?? '')
      const sp = m.spouse_id ?? members?.find((x) => x.spouse_id === m.id)?.id ?? ''
      setEditSpouseId(sp)
      setEditLineageGen(m.lineage_generation != null ? String(m.lineage_generation) : '')
      setEditBirthLunar(m.birth_lunar_text ?? '')
      setEditDeathLunar(m.death_lunar_text ?? '')
      setEditMemorialNote(m.memorial_note ?? '')
      setEditMemorialReminder(Boolean(m.death_date && m.memorial_reminder_enabled))
      setEditMemorialUseLunar(Boolean(m.death_date && m.memorial_reminder_use_lunar))
      setEditMemorialDaysBefore(
        m.memorial_reminder_days_before != null ? String(m.memorial_reminder_days_before) : '0',
      )
      setEditPhone(m.phone?.trim() ?? '')
      setEditErr(null)
    },
    [members],
  )

  const loadAccountRows = useCallback(async () => {
    if (!sb || !treeId || !isOwner) return
    const { data, error } = await sb
      .from('family_tree_roles')
      .select('user_id, role, profiles(full_name)')
      .eq('family_tree_id', treeId)
    if (error) {
      setAccountErr(error.message)
      setAccountRows([])
      return
    }
    setAccountErr(null)
    const rows = (data ?? []) as {
      user_id: string
      role: string
      profiles: { full_name: string } | { full_name: string }[] | null
    }[]
    const normalized: AccountRoleRow[] = rows.map((row) => {
      const p = row.profiles
      const one =
        p && Array.isArray(p) ? p[0] : p && typeof p === 'object' && 'full_name' in p ? p : null
      return {
        user_id: row.user_id,
        role: row.role,
        profiles: one && typeof one.full_name === 'string' ? { full_name: one.full_name } : null,
      }
    })
    setAccountRows(normalized)
  }, [sb, treeId, isOwner])

  useEffect(() => {
    if (!isOwner) {
      const id = window.setTimeout(() => setAccountRows(null), 0)
      return () => window.clearTimeout(id)
    }
    const t = window.setTimeout(() => {
      void loadAccountRows()
    }, 0)
    return () => window.clearTimeout(t)
  }, [isOwner, loadAccountRows])

  async function setAccountRole(userId: string, newRole: 'editor' | 'member') {
    if (!sb || !treeId) return
    setRoleBusyUserId(userId)
    setAccountErr(null)
    const { error } = await sb
      .from('family_tree_roles')
      .update({ role: newRole })
      .eq('family_tree_id', treeId)
      .eq('user_id', userId)
    setRoleBusyUserId(null)
    if (error) {
      setAccountErr(error.message)
      return
    }
    void loadAccountRows()
  }

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditErr(null)
  }, [])

  const openBranchGroupChat = useCallback(
    async (branchRootMemberId: string) => {
      if (!sb || !treeId) return
      setBranchGroupBusyMemberId(branchRootMemberId)
      setBranchGroupErr(null)
      const { data, error } = await sb.rpc('family_chat_get_or_create_branch_group', {
        p_family_tree_id: treeId,
        p_branch_root_member_id: branchRootMemberId,
      })
      setBranchGroupBusyMemberId(null)
      if (error) {
        const raw = error.message ?? ''
        const lc = raw.toLowerCase()
        if (lc.includes('branch_group_too_few')) {
          setBranchGroupErr(
            'Cần ít nhất hai tài khoản đã liên kết trong nhánh (từ thành viên gốc trở xuống) để có nhóm chat nhánh.',
          )
        } else if (lc.includes('branch_group_not_in_subtree')) {
          setBranchGroupErr(
            'Bạn phải có tài khoản gắn với một người trong nhánh đó (gốc + hậu duệ).',
          )
        } else if (lc.includes('no_tree_access')) {
          setBranchGroupErr('Bạn không có quyền trên cây gia phả này.')
        } else {
          setBranchGroupErr(raw || 'Không mở được nhóm nhánh.')
        }
        return
      }
      broadcastFamilyChatThreadsReload()
      void navigate(`/app/chat/${String(data)}`)
    },
    [navigate, sb, treeId],
  )

  const loadMemberRequests = useCallback(async () => {
    if (!sb || !treeId || !hasTreeRole) return
    const { data, error } = await sb
      .from('family_tree_member_requests')
      .select('*')
      .eq('family_tree_id', treeId)
      .order('created_at', { ascending: false })
    if (error) {
      setMemberReqErr(error.message)
      setMemberRequests([])
      return
    }
    setMemberReqErr(null)
    setMemberRequests((data as MemberRequestRow[]) ?? [])
  }, [sb, treeId, hasTreeRole])

  useEffect(() => {
    if (!tree || !hasTreeRole) return
    const t = window.setTimeout(() => void loadMemberRequests(), 0)
    return () => window.clearTimeout(t)
  }, [tree, hasTreeRole, loadMemberRequests])

  async function reviewMemberRequest(requestId: string, approve: boolean) {
    if (!sb) return
    let rejectReason: string | null = null
    if (!approve) {
      const r = window.prompt('Lý do từ chối (tuỳ chọn). Nhấn Huỷ để không gửi.')
      if (r === null) return
      rejectReason = r.trim() || null
    }
    setReviewBusyId(requestId)
    const { data, error } = await sb.rpc('review_family_tree_member_request', {
      p_request_id: requestId,
      p_approve: approve,
      p_reject_reason: rejectReason,
    })
    setReviewBusyId(null)
    if (error) {
      window.alert(error.message)
      return
    }
    const body = data as { ok?: boolean; error?: string }
    if (!body?.ok) {
      window.alert(memberRequestRpcErrorVi(body?.error))
      return
    }
    void loadMemberRequests()
    if (approve) void loadMembers({ force: true })
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!sb || !editingId) return
    setEditErr(null)
    const name = editName.trim()
    if (name.length < 2) {
      setEditErr('Tên cần ít nhất 2 ký tự.')
      return
    }
    const lgRaw = editLineageGen.trim()
    let lineage_generation: number | null = null
    if (lgRaw !== '') {
      const n = Number.parseInt(lgRaw, 10)
      if (!Number.isFinite(n) || n < 0) {
        setEditErr('Đời trong phả phải là số nguyên ≥ 0 hoặc để trống.')
        return
      }
      lineage_generation = n
    }
    const deathIso = editDeathDate.trim() || null
    let memorial_reminder_enabled = false
    let memorial_reminder_use_lunar = false
    let memorial_reminder_days_before = 0
    if (deathIso && editMemorialReminder) {
      memorial_reminder_enabled = true
      memorial_reminder_use_lunar = editMemorialUseLunar
      const dRaw = editMemorialDaysBefore.trim()
      const dn = dRaw === '' ? 0 : Number.parseInt(dRaw, 10)
      if (!Number.isFinite(dn) || dn < 0 || dn > 30) {
        setEditErr('Nhắc trước ngày giỗ: số ngày từ 0 đến 30.')
        return
      }
      memorial_reminder_days_before = dn
    }
    setEditBusy(true)
    const { error } = await sb
      .from('family_tree_members')
      .update({
        full_name: name,
        gender: editGender || null,
        birth_date: editBirthDate.trim() || null,
        death_date: deathIso,
        birth_lunar_text: editBirthLunar.trim() || null,
        death_lunar_text: editDeathLunar.trim() || null,
        memorial_note: editMemorialNote.trim() || null,
        memorial_reminder_enabled,
        memorial_reminder_use_lunar,
        memorial_reminder_days_before,
        father_id: editFatherId || null,
        mother_id: editMotherId || null,
        lineage_generation,
        ...(supportsMemberPhoneColumn ? { phone: editPhone.trim() || null } : {}),
      })
      .eq('id', editingId)
    if (error) {
      setEditBusy(false)
      setEditErr(error.message)
      return
    }
    const sp = await applySpouseLink(sb, editingId, editSpouseId || null)
    setEditBusy(false)
    if (sp.error) {
      setEditErr(sp.error)
      return
    }
    cancelEdit()
    void loadMembers({ force: true })
  }

  async function deleteMember(id: string, name: string) {
    if (!sb || !canEditMembers) return
    if (!window.confirm(`Xoá thành viên «${name}»? Quan hệ cha/mẹ tới người này sẽ được gỡ (nếu có).`)) {
      return
    }
    setDeleteErr(null)
    await clearMemberSpouse(sb, id)
    const { error } = await sb.from('family_tree_members').delete().eq('id', id)
    if (error) {
      setDeleteErr(error.message)
      return
    }
    void loadMembers({ force: true })
  }

  if (!tree) return null

  const canProposeMember = myTreeRole === 'member' && Boolean(myLinkedMemberId)
  const canOpenAddModal = canEditMembers || canProposeMember
  const pendingRequests = (memberRequests ?? []).filter((r) => r.status === 'pending')

  return (
    <div className="space-y-10">
      <TreePageIntro kicker="Thành viên" title="Danh sách & quyền">
        Liên kết tài khoản một-một với người trên cây. Chủ và biên tập chỉnh trực tiếp; thành viên đã liên kết có thể
        gửi đề xuất thêm vợ/chồng (cùng thế hệ) hoặc con cháu trong nhánh — cần được duyệt.
      </TreePageIntro>

      {linkMsg ? (
        <p className={treeAlertErr} role="alert">
          {linkMsg}
        </p>
      ) : null}

      {deleteErr ? (
        <p className={treeAlertErr} role="alert">
          {deleteErr}
        </p>
      ) : null}

      {canOpenAddModal ? (
        <div
          className={`${role.cardElevated} flex flex-col gap-5 rounded-abnb-xl !p-6 sm:flex-row sm:items-center sm:justify-between`}
        >
          <div className="flex min-w-0 gap-4">
            <span className={`${role.iconTile} !h-12 !w-12 shrink-0`}>
              <UserPlus className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <h3 className={role.headingModule}>{canEditMembers ? 'Thêm thành viên' : 'Đề xuất thêm người'}</h3>
              <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
                {canEditMembers
                  ? 'Thêm người trực tiếp với đầy đủ quan hệ cha/mẹ và vợ/chồng.'
                  : 'Luồng đề xuất gửi tới chủ hoặc biên tập — sau khi duyệt mới hiện trên phả hệ.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAddModalKey((k) => k + 1)
              setAddModalOpen(true)
            }}
            className={`${role.btnPrimary} shrink-0 justify-center !rounded-full !px-7 !text-[14px]`}
          >
            {canEditMembers ? 'Mở biểu mẫu thêm' : 'Gửi đề xuất mới'}
          </button>
        </div>
      ) : (
        <div className={`${role.cardQuiet} rounded-abnb-xl border border-dashed border-abnb-hairlineSoft px-6 py-8`}>
          <p className={`${role.bodySm} text-abnb-muted`}>
            Để đề xuất thêm người, hãy <strong>liên kết tài khoản</strong> với một người trên cây. Chủ hoặc biên tập luôn
            có thể mở biểu mẫu thêm trực tiếp.
          </p>
        </div>
      )}

      {hasTreeRole ? (
        <section className={`${role.card} space-y-5 rounded-abnb-xl !p-6 sm:!p-8`}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className={`${role.headingModule} text-base`}>Hàng chờ đề xuất</h3>
            <p className={role.caption}>
              {pendingRequests.length > 0 ? `${pendingRequests.length} chờ duyệt` : 'Không có đề xuất đang chờ'}
            </p>
          </div>
          {memberReqErr ? (
            <p className={treeAlertErr} role="alert">
              {memberReqErr}
            </p>
          ) : null}
          {memberRequests === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-abnb-primary" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <p className={`${role.bodySm} text-abnb-muted`}>Không có đề xuất đang chờ duyệt.</p>
          ) : (
            <ul className="space-y-3">
              {pendingRequests.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-col gap-4 rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-canvas/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-abnb-ink">{req.full_name}</p>
                    <p className="mt-1 text-abnb-muted">
                      {req.request_kind === 'spouse' ? (
                        <>
                          Vợ/chồng của <strong>{parentLabel(members ?? [], req.spouse_of_member_id)}</strong>
                        </>
                      ) : (
                        <>
                          Con —{' '}
                          {req.child_parent_as === 'father' ? 'cha' : 'mẹ'}:{' '}
                          <strong>{parentLabel(members ?? [], req.child_parent_member_id)}</strong>
                        </>
                      )}
                    </p>
                    <p className={`${role.caption} mt-1`}>Gửi lúc {formatDateVi(req.created_at)}</p>
                  </div>
                  {canEditMembers ? (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={reviewBusyId !== null}
                        onClick={() => void reviewMemberRequest(req.id, true)}
                        className="rounded-full border border-abnb-hairlineSoft bg-abnb-surfaceSoft px-3 py-1.5 text-[13px] font-semibold text-abnb-ink hover:bg-abnb-hairlineSoft/40 disabled:opacity-60"
                      >
                        {reviewBusyId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Duyệt'}
                      </button>
                      <button
                        type="button"
                        disabled={reviewBusyId !== null}
                        onClick={() => void reviewMemberRequest(req.id, false)}
                        className="rounded-full border border-abnb-hairlineSoft px-3 py-1.5 text-[13px] font-semibold text-abnb-error hover:bg-abnb-surfaceSoft disabled:opacity-60"
                      >
                        Từ chối
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-[13px] font-medium text-abnb-muted">Chờ duyệt</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <AddMemberModal
        key={addModalKey}
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        treeId={treeId}
        members={members}
        generations={generations}
        canDirectAdd={canEditMembers}
        myLinkedMemberId={myLinkedMemberId}
        supportsMemberPhoneColumn={supportsMemberPhoneColumn}
        onSaved={() => {
          void loadMembers({ force: true })
          void loadMemberRequests()
        }}
      />

      {membersErr ? (
        <p className={treeAlertErr} role="alert">
          {membersErr}
        </p>
      ) : null}
      {branchGroupErr ? (
        <p className={treeAlertErr} role="alert">
          {branchGroupErr}
        </p>
      ) : null}

      {members === null ? (
        <TreeMembersSkeleton />
      ) : members.length === 0 ? (
        <div className={`${role.cardQuiet} rounded-abnb-xl border border-dashed border-abnb-hairlineSoft px-8 py-12 text-center`}>
          <p className={`${role.bodyMd} text-abnb-muted`}>
            Chưa có ai trong danh sách. {canEditMembers ? 'Hãy thêm tổ tiên hoặc mốc đầu tiên cho dòng họ.' : ''}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {members.map((m) => {
            const parentOptions = members.filter((x) => x.id !== m.id)
            const spouseOptions = members.filter((x) => x.id !== m.id)
            const isEditing = editingId === m.id
            const gen = generations.get(m.id) ?? 0
            return (
              <li
                key={m.id}
                className={`${role.card} group relative overflow-hidden rounded-abnb-xl !p-0 ring-1 ring-transparent transition-all hover:ring-abnb-primary/15`}
              >
                <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-abnb-primary/50 to-abnb-luxe/40 opacity-80" />
                {!isEditing ? (
                  <div className="flex flex-col gap-4 p-5 pl-6 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-4">
                      {m.linked_profile_id ? (
                        <Link
                          to={feedUserProfilePath(m.linked_profile_id)}
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-abnb-primary/16 to-abnb-luxe/12 text-lg font-semibold text-abnb-primary shadow-abnb-inner ring-2 ring-abnb-canvas outline-none transition hover:opacity-95 focus-visible:ring-2 focus-visible:ring-abnb-primary/40"
                          aria-label={`Hồ sơ ${m.full_name}`}
                        >
                          {memberInitial(m.full_name)}
                        </Link>
                      ) : (
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-abnb-primary/16 to-abnb-luxe/12 text-lg font-semibold text-abnb-primary shadow-abnb-inner ring-2 ring-abnb-canvas"
                          aria-hidden
                        >
                          {memberInitial(m.full_name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-abnb-ink">
                        {m.linked_profile_id ? (
                          <Link
                            to={feedUserProfilePath(m.linked_profile_id)}
                            className={`${role.link} font-semibold text-abnb-ink no-underline hover:underline`}
                          >
                            {m.full_name}
                          </Link>
                        ) : (
                          <span>{m.full_name}</span>
                        )}
                        <span className="inline-flex rounded-full bg-abnb-surfaceSoft px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-abnb-muted ring-1 ring-abnb-hairlineSoft/70">
                          Thế hệ {gen}
                        </span>
                      </p>
                      <p className={`${role.bodySm} mt-1 text-abnb-muted`}>
                        {m.gender ? genderLabel[m.gender] ?? m.gender : '—'} · Sinh (dương):{' '}
                        {formatDateVi(m.birth_date)}
                        {m.birth_lunar_text ? (
                          <>
                            {' '}
                            · Sinh âm: <span className="font-medium">{m.birth_lunar_text}</span>
                          </>
                        ) : null}
                        {' · '}
                        Mất (dương): {formatDateVi(m.death_date)}
                        {m.death_lunar_text ? (
                          <>
                            {' '}
                            · Mất âm: <span className="font-medium">{m.death_lunar_text}</span>
                          </>
                        ) : null}
                      </p>
                      {supportsMemberPhoneColumn && m.phone?.trim() ? (
                        <p className={`${role.bodySm} mt-1 text-abnb-muted`}>
                          SĐT (phục vụ cấp tài khoản):{' '}
                          <span className="font-mono font-medium">{m.phone.trim()}</span>
                        </p>
                      ) : null}
                      {m.memorial_note ? (
                        <p className={`${role.bodySm} mt-1 text-abnb-muted`}>
                          Giỗ / nhắc lịch: <span className="font-medium">{m.memorial_note}</span>
                        </p>
                      ) : null}
                      {m.death_date && m.memorial_reminder_enabled ? (
                        <p className={`${role.bodySm} mt-1 text-abnb-muted`}>
                          Email nhắc giỗ ({m.memorial_reminder_use_lunar ? 'kỷ niệm âm' : 'kỷ niệm dương'} từ ngày mất dương):{' '}
                          <span className="font-medium">
                            {(m.memorial_reminder_days_before ?? 0) === 0
                              ? 'đúng ngày kỷ niệm'
                              : `trước ${m.memorial_reminder_days_before} ngày`}
                          </span>
                        </p>
                      ) : null}
                      <p className={`${role.bodySm} mt-0.5 text-abnb-muted`}>
                        Cha: {parentLabel(members, m.father_id)} · Mẹ: {parentLabel(members, m.mother_id)} · Vợ/chồng:{' '}
                        {spouseLabel(members, m)}
                      </p>
                      {m.linked_profile_id ? (
                        <p className={`${role.bodySm} mt-1 font-medium text-abnb-primary`}>
                          Đã liên kết tài khoản
                          {m.linked_profile_id === user?.id ? ' (bạn)' : ''}
                        </p>
                      ) : null}
                      {hasTreeRole && !isEditing ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            disabled={branchGroupBusyMemberId !== null}
                            onClick={() => void openBranchGroupChat(m.id)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-abnb-primary/35 bg-abnb-primary/8 px-3 py-1.5 text-[13px] font-semibold text-abnb-primary transition-colors hover:bg-abnb-primary/14 disabled:opacity-60"
                            title="Nhóm chat chứa mọi tài khoản đã gắn trong nhánh từ thành viên này trở xuống"
                          >
                            {branchGroupBusyMemberId === m.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            )}
                            Nhóm chat nhánh
                          </button>
                          <span className={`${role.bodySm} mt-1 block text-abnb-muted`}>
                            Gồm người đã liên kết TK trong nhánh của “{m.full_name}”.
                          </span>
                        </div>
                      ) : null}
                      {user?.id && canUseClaim && !isEditing ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!m.linked_profile_id && !myLinkedMemberId ? (
                            <button
                              type="button"
                              disabled={linkBusyId !== null}
                              onClick={() => void claimMember(m.id)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-abnb-hairlineSoft bg-abnb-surfaceSoft px-3 py-1.5 text-[13px] font-semibold text-abnb-ink hover:bg-abnb-hairlineSoft/40 disabled:opacity-60"
                            >
                              {linkBusyId === m.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Link2 className="h-3.5 w-3.5" />
                              )}
                              Đây là tôi (liên kết tài khoản)
                            </button>
                          ) : null}
                          {m.linked_profile_id === user?.id ? (
                            <button
                              type="button"
                              disabled={linkBusyId !== null}
                              onClick={() => void unlinkMember(m.id)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-abnb-hairlineSoft px-3 py-1.5 text-[13px] font-semibold text-abnb-muted hover:bg-abnb-surfaceSoft disabled:opacity-60"
                            >
                              {linkBusyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                              Huỷ liên kết của tôi
                            </button>
                          ) : null}
                          {canEditMembers && m.linked_profile_id && m.linked_profile_id !== user?.id ? (
                            <button
                              type="button"
                              disabled={linkBusyId !== null}
                              onClick={() => void unlinkMember(m.id)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-abnb-hairlineSoft px-3 py-1.5 text-[13px] font-semibold text-abnb-error/90 hover:bg-abnb-surfaceSoft disabled:opacity-60"
                            >
                              {linkBusyId === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                              Gỡ liên kết
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      {canEditMembers && !m.linked_profile_id ? (
                        <MemberPhoneAccountCard
                          memberId={m.id}
                          memberName={m.full_name}
                          memberPhone={m.phone}
                          supportsMemberPhoneColumn={supportsMemberPhoneColumn}
                          disabled={linkBusyId !== null}
                          onDone={() => void loadMembers({ force: true })}
                        />
                      ) : null}
                    </div>
                    </div>
                    {canEditMembers ? (
                      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
                        <button
                          type="button"
                          onClick={() => startEdit(m)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-abnb-hairlineSoft bg-abnb-canvas px-4 py-2 text-sm font-semibold text-abnb-ink shadow-abnb-inner transition-colors hover:bg-abnb-surfaceSoft"
                        >
                          <Pencil className="h-4 w-4" />
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteMember(m.id, m.full_name)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-abnb-error/25 bg-abnb-error/[0.04] px-4 py-2 text-sm font-semibold text-abnb-error hover:bg-abnb-error/[0.08]"
                          aria-label={`Xoá ${m.full_name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                          Xoá
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => void submitEdit(e)}
                    className="space-y-4 border-t border-abnb-hairlineSoft p-5 pl-6 pt-5"
                  >
                    <p className={`${role.caption} text-abnb-ink`}>Sửa thành viên</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label htmlFor={`edit-name-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Họ tên *
                        </label>
                        <input
                          id={`edit-name-${m.id}`}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className={`${role.input} mt-2`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`edit-phone-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Số điện thoại{' '}
                          <span className="font-normal text-abnb-muted">
                            (tuỳ chọn — dùng cấp tài khoản SĐT sau khi đã lưu)
                          </span>
                        </label>
                        <input
                          id={`edit-phone-${m.id}`}
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          placeholder="0912345678"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className={`${role.input} mt-2`}
                        />
                        {!supportsMemberPhoneColumn ? (
                          <p className={`${role.caption} mt-2 text-amber-800/90`}>
                            Để <strong>lưu</strong> được SĐT, cần migration có cột phone — chạy{' '}
                            <code className="rounded bg-abnb-surfaceSoft px-1 py-px text-[12px]">supabase db push</code>
                            , tải lại trang và lưu lại.
                          </p>
                        ) : null}
                      </div>
                      <div>
                        <label htmlFor={`edit-g-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Giới tính
                        </label>
                        <select
                          id={`edit-g-${m.id}`}
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value)}
                          className={`${role.input} mt-2`}
                        >
                          <option value="">—</option>
                          <option value="male">Nam</option>
                          <option value="female">Nữ</option>
                          <option value="other">Khác</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`edit-b-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Ngày sinh
                        </label>
                        <input
                          id={`edit-b-${m.id}`}
                          type="date"
                          value={editBirthDate}
                          onChange={(e) => setEditBirthDate(e.target.value)}
                          className={`${role.input} mt-2`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-d-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Ngày mất
                        </label>
                        <input
                          id={`edit-d-${m.id}`}
                          type="date"
                          value={editDeathDate}
                          onChange={(e) => setEditDeathDate(e.target.value)}
                          className={`${role.input} mt-2`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label htmlFor={`edit-bl-${m.id}`} className={`${role.caption} text-abnb-body`}>
                            Sinh âm lịch (ghi chú)
                          </label>
                          <LunarFromSolarButton solarIso={editBirthDate} onApply={setEditBirthLunar} />
                        </div>
                        <input
                          id={`edit-bl-${m.id}`}
                          value={editBirthLunar}
                          onChange={(e) => setEditBirthLunar(e.target.value)}
                          placeholder="Ghi tay hoặc «Từ ngày dương» (hệ âm Trung–Việt)"
                          className={`${role.input} mt-2`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label htmlFor={`edit-dl-${m.id}`} className={`${role.caption} text-abnb-body`}>
                            Mất âm lịch (ghi chú)
                          </label>
                          <LunarFromSolarButton solarIso={editDeathDate} onApply={setEditDeathLunar} />
                        </div>
                        <input
                          id={`edit-dl-${m.id}`}
                          value={editDeathLunar}
                          onChange={(e) => setEditDeathLunar(e.target.value)}
                          placeholder="Ghi tay hoặc «Từ ngày dương»"
                          className={`${role.input} mt-2`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`edit-mem-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Ngày giỗ / nhắc lịch
                        </label>
                        <input
                          id={`edit-mem-${m.id}`}
                          value={editMemorialNote}
                          onChange={(e) => setEditMemorialNote(e.target.value)}
                          placeholder="vd. Giỗ mùng 3 ÂL hằng năm"
                          className={`${role.input} mt-2`}
                        />
                      </div>
                      <div className="sm:col-span-2 rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-canvas/40 px-4 py-3">
                        <label className={`flex cursor-pointer items-start gap-3 ${role.caption} text-abnb-body`}>
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-abnb-hairlineSoft"
                            checked={editMemorialReminder}
                            disabled={!editDeathDate}
                            onChange={(e) => setEditMemorialReminder(e.target.checked)}
                          />
                          <span>
                            Gửi email nhắc giỗ (giờ Việt Nam) tới chủ và mọi người trong dòng họ. Ngày kỷ niệm lấy từ
                            ngày mất <strong>dương</strong> trong hồ sơ (chuyển sang âm nếu bạn chọn bên dưới).
                          </span>
                        </label>
                        <label
                          className={`mt-3 flex cursor-pointer items-start gap-3 pl-7 ${role.caption} text-abnb-body`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded border-abnb-hairlineSoft"
                            checked={editMemorialUseLunar}
                            disabled={!editDeathDate || !editMemorialReminder}
                            onChange={(e) => setEditMemorialUseLunar(e.target.checked)}
                          />
                          <span>
                            Nhắc theo kỷ niệm <strong>âm lịch</strong> (tháng/ngày âm suy từ ngày mất dương — hệ Trung–Việt
                            thông dụng). Nếu tắt: nhắc theo kỷ niệm tháng/ngày <strong>dương</strong>.
                          </span>
                        </label>
                        <div className="mt-3 pl-7">
                          <label htmlFor={`edit-memdays-${m.id}`} className={`${role.caption} text-abnb-body`}>
                            Nhắc trước (ngày)
                          </label>
                          <input
                            id={`edit-memdays-${m.id}`}
                            type="number"
                            min={0}
                            max={30}
                            inputMode="numeric"
                            disabled={!editDeathDate || !editMemorialReminder}
                            value={editMemorialDaysBefore}
                            onChange={(e) => setEditMemorialDaysBefore(e.target.value.replace(/\D/g, ''))}
                            className={`${role.input} mt-2 max-w-[8rem]`}
                          />
                          <p className={`${role.caption} mt-1 text-abnb-muted`}>0 = đúng ngày kỷ niệm; tối đa 30.</p>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`edit-lg-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Đời trong phả <span className="font-normal text-abnb-muted">(tùy chọn)</span>
                        </label>
                        <input
                          id={`edit-lg-${m.id}`}
                          inputMode="numeric"
                          value={editLineageGen}
                          onChange={(e) => setEditLineageGen(e.target.value.replace(/\D/g, ''))}
                          placeholder="0 = đời 1 trong phả; để trống = chỉ theo cha mẹ"
                          className={`${role.input} mt-2`}
                        />
                      </div>
                      <div>
                        <label htmlFor={`edit-f-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Cha
                        </label>
                        <select
                          id={`edit-f-${m.id}`}
                          value={editFatherId}
                          onChange={(e) => setEditFatherId(e.target.value)}
                          className={`${role.input} mt-2`}
                        >
                          <option value="">—</option>
                          {parentOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`edit-mo-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Mẹ
                        </label>
                        <select
                          id={`edit-mo-${m.id}`}
                          value={editMotherId}
                          onChange={(e) => setEditMotherId(e.target.value)}
                          className={`${role.input} mt-2`}
                        >
                          <option value="">—</option>
                          {parentOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor={`edit-s-${m.id}`} className={`${role.caption} text-abnb-body`}>
                          Vợ / chồng
                        </label>
                        <select
                          id={`edit-s-${m.id}`}
                          value={editSpouseId}
                          onChange={(e) => setEditSpouseId(e.target.value)}
                          className={`${role.input} mt-2`}
                        >
                          <option value="">—</option>
                          {spouseOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {editErr ? (
                      <p className="text-sm text-abnb-error" role="alert">
                        {editErr}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={editBusy}
                        className={`${role.btnPrimary} !h-11 justify-center !rounded-full !px-6 disabled:opacity-60`}
                      >
                        {editBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                      </button>
                      <button
                        type="button"
                        disabled={editBusy}
                        onClick={cancelEdit}
                        className={`${role.btnSecondary} !h-11 !rounded-full !px-6`}
                      >
                        Huỷ
                      </button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {isOwner ? (
        <section className={`${role.cardElevated} space-y-5 rounded-abnb-xl !p-6 sm:!p-8`}>
          <div>
            <h3 className={`${role.headingModule} text-base`}>Tài khoản &amp; quyền</h3>
            <p className={`${role.bodySm} mt-2 text-abnb-muted`}>
              Chỉ chủ dòng đổi vai trò sau khi mọi người tham gia bằng mã mời.
            </p>
          </div>
          {accountErr ? (
            <p className={treeAlertErr} role="alert">
              {accountErr}
            </p>
          ) : null}
          {accountRows === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-abnb-primary" />
            </div>
          ) : (
            <ul className="space-y-3">
              {[...accountRows]
                .sort((a, b) => {
                  const w = (r: string) => (r === 'owner' ? 0 : r === 'editor' ? 1 : 2)
                  const d = w(a.role) - w(b.role)
                  if (d !== 0) return d
                  return (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '', 'vi')
                })
                .map((row) => {
                  const isTreeOwner = tree.owner_id === row.user_id
                  const name = row.profiles?.full_name ?? 'Tài khoản'
                  const canPickRole = !isTreeOwner && row.role !== 'owner'
                  return (
                    <li
                      key={row.user_id}
                      className="flex flex-col gap-3 rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-canvas/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-abnb-ink">
                          <Link
                            to={feedUserProfilePath(row.user_id)}
                            className={`${role.link} font-semibold text-abnb-ink no-underline hover:underline`}
                          >
                            {name}
                          </Link>
                        </p>
                        <p className={`${role.caption} mt-0.5`}>
                          {isTreeOwner || row.role === 'owner'
                            ? 'Chủ dòng'
                            : row.role === 'editor'
                              ? 'Biên tập viên'
                              : 'Thành viên'}
                        </p>
                      </div>
                      {canPickRole ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            className={`${role.input} !h-11 w-full min-w-[10rem] sm:w-auto`}
                            value={row.role === 'editor' ? 'editor' : 'member'}
                            disabled={roleBusyUserId === row.user_id}
                            onChange={(e) => {
                              const v = e.target.value as 'editor' | 'member'
                              if (v === row.role) return
                              void setAccountRole(row.user_id, v)
                            }}
                          >
                            <option value="member">Thành viên</option>
                            <option value="editor">Biên tập viên</option>
                          </select>
                          {roleBusyUserId === row.user_id ? (
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-abnb-primary" />
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}
