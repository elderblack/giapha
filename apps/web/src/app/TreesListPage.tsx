import { Link, Navigate, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { ChevronRight, Loader2, Plus, KeyRound, TreePine } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuth } from '../auth/useAuth'
import { role } from '../design/roles'
import { getUserFamilyTreeId } from '../lib/familyTreeMembership'
import { getSupabase } from '../lib/supabase'

type TreeRow = {
  id: string
  name: string
  clan_name: string | null
  origin_place: string | null
  description: string | null
  owner_id: string | null
  invite_code?: string
  created_at: string
}

export function TreesListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const sb = getSupabase()
  const [trees, setTrees] = useState<TreeRow[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [joinMsg, setJoinMsg] = useState<string | null>(null)
  /** `undefined` = đang kiểm tra (chỉ khi đã đăng nhập); `null` = chưa có dòng họ; string = id dòng họ */
  const [myFamilyTreeId, setMyFamilyTreeId] = useState<string | null | undefined>(undefined)

  const joinSchema = z.object({
    code: z.string().min(1).uuid('Mã mời không đúng định dạng.'),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<{ code: string }>({
    resolver: zodResolver(joinSchema),
    defaultValues: { code: '' },
  })

  const refresh = useCallback(async () => {
    if (!sb) return
    const { data, error } = await sb.from('family_trees').select('*').order('created_at', {
      ascending: false,
    })
    if (error) {
      setErr(error.message)
      setTrees([])
      return
    }
    setErr(null)
    setTrees((data as TreeRow[]) ?? [])
  }, [sb])

  useEffect(() => {
    if (!sb) return
    const t = window.setTimeout(() => {
      void refresh()
    }, 0)
    return () => window.clearTimeout(t)
  }, [sb, refresh])

  useEffect(() => {
    if (!sb || !user?.id) {
      const id = window.setTimeout(() => setMyFamilyTreeId(null), 0)
      return () => window.clearTimeout(id)
    }
    let cancelled = false
    void (async () => {
      const treeId = await getUserFamilyTreeId(sb, user.id)
      if (!cancelled) setMyFamilyTreeId(treeId)
    })()
    return () => {
      cancelled = true
    }
  }, [sb, user?.id])

  const onJoin = handleSubmit(async ({ code }) => {
    if (!sb) return
    setJoinMsg(null)
    const uuid = code.trim()
    const { data, error } = await sb.rpc('join_family_tree', { p_invite: uuid })
    if (error) {
      setJoinMsg(error.message)
      return
    }
    const body = data as { ok?: boolean; error?: string; name?: string; family_tree_id?: string }
    if (!body?.ok) {
      if (body?.error === 'already_in_another_tree') {
        setJoinMsg('Bạn đã thuộc một dòng họ khác. Mỗi tài khoản chỉ có một dòng họ — không thể tham gia thêm.')
      } else {
        setJoinMsg(body?.error === 'not_found' ? 'Không tìm thấy mã mời.' : 'Không tham gia được.')
      }
      return
    }
    reset({ code: '' })
    const tid = body.family_tree_id
    if (typeof tid === 'string' && tid) {
      navigate(`/app/trees/${tid}`, { replace: true })
      return
    }
    setJoinMsg(`Đã tham gia «${body.name ?? 'dòng họ'}».`)
    void refresh()
  })

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  if (!sb) {
    return <p className="text-sm text-abnb-error">Không kết nối được. Vui lòng thử lại sau.</p>
  }

  if (user?.id && myFamilyTreeId === undefined) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        <p className={role.caption}>Đang tải…</p>
      </div>
    )
  }

  if (user?.id && myFamilyTreeId) {
    return <Navigate to={`/app/trees/${myFamilyTreeId}`} replace />
  }

  if (trees === null) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
        <p className={role.caption}>Đang tải danh sách…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start lg:gap-10">
        <div className={`${role.pageHero} animate-fade-up overflow-hidden`}>
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <span className={`${role.iconTile} !h-14 !w-14`}>
              <TreePine className="h-7 w-7" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className={role.kicker}>Dòng họ</p>
              <h1 className={`${role.headingSection} mt-2`}>Không gian của gia tộc</h1>
              <p className={`${role.bodySm} mt-3 max-w-prose text-abnb-body`}>
                Mỗi tài khoản chỉ thuộc <strong>một dòng họ</strong>. Đã có dòng họ thì không tạo hoặc tham gia thêm.
                Thành viên cần{' '}
                <Link to="/app/login" className="font-semibold text-abnb-primary no-underline hover:underline">
                  đăng nhập
                </Link>{' '}
                trước khi dán mã mời.
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/app/trees/new"
          className={`${role.btnPrimary} animate-fade-up-delay flex h-[3.25rem] w-full shrink-0 items-center justify-center gap-2 !rounded-full no-underline lg:mt-3 lg:inline-flex lg:w-auto`}
        >
          <Plus className="h-4 w-4" />
          Tạo dòng họ
        </Link>
      </div>

      <div
        className={`${role.cardElevated} animate-fade-up-slow mt-10 overflow-hidden rounded-abnb-xl !p-0 ring-1 ring-abnb-primary/10`}
      >
        <div className="flex flex-col gap-1 border-b border-abnb-hairlineSoft bg-gradient-to-r from-abnb-primary/[0.07] to-transparent px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-abnb-md bg-abnb-canvas/90 text-abnb-primary shadow-abnb-inner ring-1 ring-abnb-hairlineSoft/70">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 className={`${role.headingModule} text-base`}>Tham gia bằng mã mời</h2>
              <p className={`${role.caption} mt-0.5`}>Dán UUID chủ dòng gửi cho bạn</p>
            </div>
          </div>
        </div>
        <form onSubmit={(e) => void onJoin(e)} className="space-y-4 p-6 sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              {...register('code')}
              placeholder="Dán mã mời"
              className={`${role.input} flex-1 font-mono text-sm`}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className={`${role.btnSecondary} shrink-0 !rounded-full whitespace-nowrap disabled:opacity-60`}
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tham gia'}
            </button>
          </div>
          {errors.code && <p className="text-sm text-abnb-error">{errors.code.message}</p>}
          {joinMsg && (
            <p className="text-sm text-abnb-ink" role="status">
              {joinMsg}
            </p>
          )}
        </form>
      </div>

      {err && <p className="mt-8 text-sm text-abnb-error">{err}</p>}

      <ul className="mt-10 grid gap-5 sm:grid-cols-1">
        {trees.length === 0 ? (
          <li
            className={`${role.bodyMd} rounded-abnb-xl border-2 border-dashed border-abnb-hairlineSoft bg-abnb-canvas/50 px-8 py-14 text-center text-abnb-muted`}
          >
            Chưa có dòng họ nào — hãy tạo hoặc tham gia bằng mã ở trên.
          </li>
        ) : (
          trees.map((t) => (
            <li key={t.id}>
              <div className={`${role.card} group rounded-abnb-xl !p-0 transition-all hover:-translate-y-0.5`}>
                <Link
                  to={`/app/trees/${t.id}`}
                  className="flex items-stretch gap-0 overflow-hidden rounded-abnb-xl no-underline sm:gap-0"
                >
                  <div className="flex w-14 shrink-0 items-center justify-center bg-gradient-to-b from-abnb-surfaceSoft to-abnb-canvas ring-1 ring-abnb-hairlineSoft/60 sm:w-16">
                    <ChevronRight className="h-6 w-6 text-abnb-primary transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="min-w-0 flex-1 p-5 sm:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xl font-semibold tracking-tight text-abnb-ink group-hover:text-abnb-primary">
                          {t.name}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {t.clan_name ? (
                            <span className="inline-flex rounded-full bg-abnb-surfaceSoft px-2.5 py-0.5 text-[12px] font-semibold text-abnb-muted ring-1 ring-abnb-hairlineSoft/70">
                              Chi: {t.clan_name}
                            </span>
                          ) : null}
                          {t.origin_place ? (
                            <span className="inline-flex rounded-full bg-abnb-surfaceSoft px-2.5 py-0.5 text-[12px] font-semibold text-abnb-muted ring-1 ring-abnb-hairlineSoft/70">
                              Gốc: {t.origin_place}
                            </span>
                          ) : null}
                          {t.owner_id === user?.id ? (
                            <span className="inline-flex rounded-full bg-abnb-primary/12 px-2.5 py-0.5 text-[12px] font-semibold text-abnb-primary">
                              Chủ dòng
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-abnb-surfaceStrong px-2.5 py-0.5 text-[12px] font-semibold text-abnb-muted">
                              Thành viên
                            </span>
                          )}
                        </div>
                        {t.description ? (
                          <p className={`${role.bodySm} mt-4 line-clamp-2 text-abnb-body`}>{t.description}</p>
                        ) : null}
                      </div>
                      {t.owner_id === user?.id && t.invite_code ? (
                        <div
                          className="w-full shrink-0 rounded-abnb-lg border border-abnb-hairlineSoft bg-abnb-surfaceSoft/80 p-4 sm:max-w-[14rem]"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          role="presentation"
                        >
                          <p className={role.statLabel}>Mã mời</p>
                          <p className="mt-2 break-all font-mono text-[12px] leading-relaxed text-abnb-ink">
                            {t.invite_code}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              void copy(t.invite_code!)
                            }}
                            className="mt-3 text-[12px] font-semibold text-abnb-primary hover:underline"
                          >
                            Sao chép
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
