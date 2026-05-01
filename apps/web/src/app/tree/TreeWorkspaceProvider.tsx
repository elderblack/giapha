import type { ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { getSupabase } from '../../lib/supabase'
import { computeMemberGenerations } from '../../lib/familyTreeGenerations'
import { claimRpcErrorVi, type MemberRow, type TreeRow } from './treeTypes'
import { TreeWorkspaceContext, type TreeWorkspaceValue } from './treeWorkspaceContext'

const MEMBERS_SELECT_WITH_PHONE =
  'id,family_tree_id,full_name,gender,birth_date,death_date,notes,birth_lunar_text,death_lunar_text,memorial_note,memorial_reminder_enabled,memorial_reminder_use_lunar,memorial_reminder_days_before,father_id,mother_id,lineage_generation,spouse_id,phone,linked_profile_id'

const MEMBERS_SELECT_NO_PHONE =
  'id,family_tree_id,full_name,gender,birth_date,death_date,notes,birth_lunar_text,death_lunar_text,memorial_note,memorial_reminder_enabled,memorial_reminder_use_lunar,memorial_reminder_days_before,father_id,mother_id,lineage_generation,spouse_id,linked_profile_id'

function memberPhoneMissingError(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('family_tree_members.phone') ||
    (m.includes('column') && m.includes('phone') && m.includes('does not exist'))
  )
}

export function TreeWorkspaceProvider({
  children,
  treeId: treeIdProp,
}: {
  children: ReactNode
  /** Khi có (ví dụ Trang nhà `/app/home`), bỏ qua `treeId` trên URL */
  treeId?: string
}) {
  const { treeId: treeIdParam } = useParams<{ treeId: string }>()
  const treeId = treeIdProp ?? treeIdParam ?? ''
  const { user } = useAuth()
  const sb = getSupabase()

  const [tree, setTree] = useState<TreeRow | null | undefined>(undefined)
  const [err, setErr] = useState<string | null>(null)
  const [members, setMembers] = useState<MemberRow[] | null>(null)
  const [membersErr, setMembersErr] = useState<string | null>(null)
  /** Tránh gọi API lặp khi chỉ đổi tab (cùng treeId): đánh dấu đã đã hoàn thành lần tải thành viên cho tree này. */
  const membersLoadedForTreeRef = useRef<string | null>(null)
  const [supportsMemberPhoneColumn, setSupportsMemberPhoneColumn] = useState(true)
  const [myTreeRole, setMyTreeRole] = useState<'owner' | 'editor' | 'member' | null>(null)
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null)
  const [linkMsg, setLinkMsg] = useState<string | null>(null)

  const isOwner = Boolean(user?.id && tree?.owner_id === user.id)
  const hasTreeRole = Boolean(myTreeRole) || isOwner
  const canEditMembers = Boolean(isOwner || myTreeRole === 'editor')
  const canUseClaim = Boolean(user?.id && hasTreeRole)

  const myLinkedMemberId = useMemo(() => {
    if (!members || !user?.id) return null
    return members.find((m) => m.linked_profile_id === user.id)?.id ?? null
  }, [members, user])

  const generations = useMemo(() => {
    if (!members?.length) return new Map<string, number>()
    return computeMemberGenerations(members)
  }, [members])

  const chartMembers = useMemo(() => {
    if (!members) return []
    return members.map((m) => ({
      id: m.id,
      full_name: m.full_name,
      gender: m.gender ?? null,
      father_id: m.father_id,
      mother_id: m.mother_id,
      spouse_id: m.spouse_id,
      lineage_generation: m.lineage_generation ?? null,
      avatar_url: m.avatar_url ?? null,
    }))
  }, [members])

  const loadMembers = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!sb || !treeId) return
      if (opts?.force) {
        membersLoadedForTreeRef.current = null
      }

      try {
        let usePhoneCol = true
        const r1 = await sb
          .from('family_tree_members')
          .select(MEMBERS_SELECT_WITH_PHONE)
          .eq('family_tree_id', treeId)
          .order('full_name')

        let picked = r1
        if (r1.error && memberPhoneMissingError(r1.error.message ?? '')) {
          usePhoneCol = false
          picked = (await sb
            .from('family_tree_members')
            .select(MEMBERS_SELECT_NO_PHONE)
            .eq('family_tree_id', treeId)
            .order('full_name')) as typeof r1
        }

        const { data, error } = picked
        if (error) {
          setSupportsMemberPhoneColumn(true)
          setMembers([])
          setMembersErr(error.message)
          return
        }

        setSupportsMemberPhoneColumn(usePhoneCol)
        const rows = (data as MemberRow[]) ?? []
        const profileIds = [
          ...new Set(rows.map((m) => m.linked_profile_id).filter((id): id is string => Boolean(id))),
        ]
        let avatarByProfile = new Map<string, string | null>()
        if (profileIds.length > 0) {
          const { data: profs, error: pe } = await sb.from('profiles').select('id, avatar_url').in('id', profileIds)
          if (!pe && profs) {
            avatarByProfile = new Map(
              (profs as { id: string; avatar_url: string | null }[]).map((p) => [p.id, p.avatar_url]),
            )
          }
        }
        setMembersErr(null)
        setMembers(
          rows.map((m) => ({
            ...m,
            avatar_url: m.linked_profile_id ? (avatarByProfile.get(m.linked_profile_id) ?? null) : null,
          })),
        )
      } finally {
        membersLoadedForTreeRef.current = treeId
      }
    },
    [sb, treeId],
  )

  useEffect(() => {
    if (!treeId || !sb) {
      const id = window.setTimeout(() => setTree(null), 0)
      return () => window.clearTimeout(id)
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await sb.from('family_trees').select('*').eq('id', treeId).maybeSingle()
      if (cancelled) return
      if (error) {
        setErr(error.message)
        setTree(null)
        return
      }
      setErr(null)
      setTree(data as TreeRow | null)
    })()
    return () => {
      cancelled = true
    }
  }, [treeId, sb])

  useLayoutEffect(() => {
    membersLoadedForTreeRef.current = null
    setMembers(null)
  }, [treeId])

  useEffect(() => {
    if (!tree || !treeId || !sb) return
    if (membersLoadedForTreeRef.current === treeId) return
    const t = window.setTimeout(() => {
      void loadMembers()
    }, 0)
    return () => window.clearTimeout(t)
  }, [tree, treeId, sb, loadMembers])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!sb || !treeId || !user?.id) {
        const id = window.setTimeout(() => setMyTreeRole(null), 0)
        return () => window.clearTimeout(id)
      }
      const { data } = await sb
        .from('family_tree_roles')
        .select('role')
        .eq('family_tree_id', treeId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      const r = data?.role
      if (r === 'owner' || r === 'editor' || r === 'member') setMyTreeRole(r)
      else setMyTreeRole(null)
    })()
    return () => {
      cancelled = true
    }
  }, [sb, treeId, user?.id])

  const claimMember = useCallback(
    async (memberId: string) => {
      if (!sb) return
      setLinkMsg(null)
      setLinkBusyId(memberId)
      const { data, error } = await sb.rpc('claim_family_tree_member', { p_member_id: memberId })
      setLinkBusyId(null)
      if (error) {
        setLinkMsg(error.message)
        return
      }
      const body = data as { ok?: boolean; error?: string }
      if (!body?.ok) {
        setLinkMsg(claimRpcErrorVi(body?.error))
        return
      }
      void loadMembers({ force: true })
    },
    [sb, loadMembers],
  )

  const reloadTree = useCallback(async () => {
    if (!sb || !treeId) return
    const { data, error } = await sb.from('family_trees').select('*').eq('id', treeId).maybeSingle()
    if (error) return
    setTree((data as TreeRow | null) ?? null)
  }, [sb, treeId])

  const unlinkMember = useCallback(
    async (memberId: string) => {
      if (!sb) return
      setLinkMsg(null)
      setLinkBusyId(memberId)
      const { data, error } = await sb.rpc('unlink_family_tree_member', { p_member_id: memberId })
      setLinkBusyId(null)
      if (error) {
        setLinkMsg(error.message)
        return
      }
      const body = data as { ok?: boolean; error?: string }
      if (!body?.ok) {
        setLinkMsg(claimRpcErrorVi(body?.error))
        return
      }
      void loadMembers({ force: true })
    },
    [sb, loadMembers],
  )

  const value = useMemo<TreeWorkspaceValue>(
    () => ({
      treeId,
      tree,
      treeLoadErr: err,
      members,
      membersErr,
      supportsMemberPhoneColumn,
      loadMembers,
      isOwner,
      myTreeRole,
      hasTreeRole,
      canEditMembers,
      canUseClaim,
      myLinkedMemberId,
      generations,
      chartMembers,
      linkBusyId,
      linkMsg,
      setLinkMsg,
      claimMember,
      unlinkMember,
      reloadTree,
    }),
    [
      treeId,
      tree,
      err,
      members,
      membersErr,
      supportsMemberPhoneColumn,
      loadMembers,
      isOwner,
      myTreeRole,
      hasTreeRole,
      canEditMembers,
      canUseClaim,
      myLinkedMemberId,
      generations,
      chartMembers,
      linkBusyId,
      linkMsg,
      claimMember,
      unlinkMember,
      reloadTree,
    ],
  )

  if (!treeId) {
    return null
  }

  return <TreeWorkspaceContext.Provider value={value}>{children}</TreeWorkspaceContext.Provider>
}
