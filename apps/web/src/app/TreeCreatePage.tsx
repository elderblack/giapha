import { Link, Navigate, useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { useAuth } from '../auth/useAuth'
import { role } from '../design/roles'
import { getUserFamilyTreeId } from '../lib/familyTreeMembership'
import { getSupabase } from '../lib/supabase'

const schema = z.object({
  name: z.string().min(2, 'Ít nhất 2 ký tự').max(200),
  clan_name: z.string().max(120).optional().or(z.literal('')),
  origin_place: z.string().max(200).optional().or(z.literal('')),
  description: z.string().max(2000).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

function isCreateFamilyTreeRpcMissing(err: { message?: string }): boolean {
  const m = (err.message ?? '').toLowerCase()
  if (m.includes('name_too_short') || m.includes('unauthorized')) {
    return false
  }
  return (
    (m.includes('create_family_tree') &&
      (m.includes('does not exist') ||
        m.includes('could not find') ||
        m.includes('schema cache'))) ||
    (m.includes('could not find the function') && m.includes('create_family_tree'))
  )
}

export function TreeCreatePage() {
  const { user } = useAuth()
  const sb = getSupabase()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  /** `undefined` = đang kiểm tra khi đã đăng nhập; `null` = chưa có dòng họ */
  const [existingTreeId, setExistingTreeId] = useState<string | null | undefined>(undefined)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', clan_name: '', origin_place: '', description: '' },
  })

  useEffect(() => {
    if (!sb || !user?.id) {
      const id = window.setTimeout(() => setExistingTreeId(null), 0)
      return () => window.clearTimeout(id)
    }
    let cancelled = false
    void (async () => {
      const tid = await getUserFamilyTreeId(sb, user.id)
      if (!cancelled) setExistingTreeId(tid)
    })()
    return () => {
      cancelled = true
    }
  }, [sb, user?.id])

  const onSubmit = handleSubmit(async (values) => {
    if (!user?.id || !sb) return
    setServerError(null)
    const { data: treeId, error: rpcErr } = await sb.rpc('create_family_tree', {
      p_name: values.name.trim(),
      p_clan_name: values.clan_name?.trim() || null,
      p_origin_place: values.origin_place?.trim() || null,
      p_description: values.description?.trim() || null,
    })

    if (rpcErr && isCreateFamilyTreeRpcMissing(rpcErr)) {
      setServerError(
        'Không tìm thấy chức năng create_family_tree trên máy chủ. Hãy deploy migrations Supabase mới nhất (một dòng họ / một tài khoản chỉ được tạo qua RPC).',
      )
      return
    }

    if (rpcErr) {
      const m = rpcErr.message.toLowerCase()
      if (m.includes('name_too_short')) {
        setServerError('Tên dòng họ cần ít nhất 2 ký tự.')
      } else if (m.includes('unauthorized')) {
        setServerError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
      } else if (m.includes('already_in_family_tree')) {
        setServerError(
          'Bạn đã thuộc một dòng họ. Mỗi tài khoản chỉ có một dòng họ — không thể tạo thêm.',
        )
      } else {
        setServerError(rpcErr.message)
      }
      return
    }

    if (treeId == null || treeId === '') {
      setServerError('Không tạo được dòng họ.')
      return
    }

    navigate(`/app/trees/${treeId}`, { replace: true })
  })

  if (!sb) {
    return <p className="text-sm text-abnb-error">Không kết nối được. Vui lòng thử lại sau.</p>
  }

  if (user?.id && existingTreeId === undefined) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-abnb-primary" />
      </div>
    )
  }

  if (user?.id && existingTreeId) {
    return <Navigate to={`/app/trees/${existingTreeId}`} replace />
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className={`${role.pageHero} animate-fade-up`}>
        <Link
          to="/app/trees"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-abnb-hairlineSoft bg-abnb-surfaceSoft/80 px-3.5 py-1.5 text-[13px] font-semibold text-abnb-primary shadow-abnb-inner no-underline transition-colors hover:border-abnb-hairline hover:bg-abnb-canvas"
        >
          ← Danh sách dòng họ
        </Link>
        <p className={`${role.kicker} mt-5`}>Dòng họ mới</p>
        <h1 className={`${role.headingSection} mt-3`}>Tạo dòng họ</h1>
        <p className={`${role.bodySm} mt-3 text-abnb-body`}>
          Bạn trở thành chủ dòng họ và nhận mã mời để mời người thân.
        </p>
      </div>
      <form
        onSubmit={(e) => void onSubmit(e)}
        className={`${role.card} mt-8 animate-fade-up-delay space-y-5 rounded-abnb-xl !p-6`}
      >
        <div>
          <label htmlFor="name" className={`${role.caption} text-abnb-body`}>
            Tên dòng họ *
          </label>
          <input id="name" {...register('name')} className={`${role.input} mt-2`} />
          {errors.name && <p className="mt-1 text-sm text-abnb-error">{errors.name.message}</p>}
        </div>
        <div>
          <label htmlFor="clan" className={`${role.caption} text-abnb-body`}>
            Tên chi / nhánh
          </label>
          <input id="clan" {...register('clan_name')} className={`${role.input} mt-2`} />
        </div>
        <div>
          <label htmlFor="origin" className={`${role.caption} text-abnb-body`}>
            Quê / gốc tích
          </label>
          <input id="origin" {...register('origin_place')} className={`${role.input} mt-2`} />
        </div>
        <div>
          <label htmlFor="desc" className={`${role.caption} text-abnb-body`}>
            Giới thiệu ngắn
          </label>
          <textarea
            id="desc"
            rows={3}
            {...register('description')}
            className={`${role.input} mt-2 resize-y py-3`}
          />
        </div>
        {serverError && (
          <p className="text-sm text-abnb-error" role="alert">
            {serverError}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`${role.btnPrimary} w-full justify-center !rounded-full disabled:opacity-60`}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tạo dòng họ'}
        </button>
      </form>
    </div>
  )
}
