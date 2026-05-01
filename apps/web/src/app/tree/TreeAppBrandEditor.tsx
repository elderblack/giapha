import { useCallback, useEffect, useRef, useState } from 'react'
import { ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { role } from '../../design/roles'
import { getSupabase } from '../../lib/supabase'
import { APP_DISPLAY_NAME, dispatchAppHeaderBrandRefresh } from '../../lib/appHeaderBrandEvents'
import { useTreeWorkspace } from './treeWorkspaceContext'

const MAX_NAME_LEN = 32

export function TreeAppBrandEditor() {
  const { isOwner, treeId, tree, reloadTree } = useTreeWorkspace()
  const sb = getSupabase()
  const fileRef = useRef<HTMLInputElement>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    setNameDraft(tree?.app_header_display_name?.trim() ?? '')
  }, [tree?.id, tree?.app_header_display_name])

  useEffect(() => {
    if (!pendingFile) {
      setPendingPreviewUrl(null)
      return
    }
    const u = URL.createObjectURL(pendingFile)
    setPendingPreviewUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [pendingFile])

  const storedPath = tree?.app_header_logo_path?.trim() ?? ''
  const previewFromStorage =
    storedPath && sb ? sb.storage.from('family-tree-brand').getPublicUrl(storedPath).data.publicUrl : null

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp|gif)/i.test(file.type)) {
      setMsg('Chọn ảnh JPEG, PNG, WebP hoặc GIF (tối đa ~1 MB).')
      return
    }
    setPendingFile(file)
    setMsg(null)
  }

  const clearLogo = useCallback(async () => {
    if (!isOwner || !sb || !treeId || !tree) return
    setBusy(true)
    setMsg(null)
    try {
      const oldPath = tree.app_header_logo_path?.trim()
      if (oldPath) {
        const { error: re } = await sb.storage.from('family-tree-brand').remove([oldPath])
        if (re) {
          setMsg(re.message)
          return
        }
      }
      const { error: ue } = await sb.from('family_trees').update({ app_header_logo_path: null }).eq('id', treeId)
      if (ue) {
        setMsg(ue.message)
        return
      }
      dispatchAppHeaderBrandRefresh()
      await reloadTree()
      setPendingFile(null)
      setMsg('Đã xóa logo.')
    } finally {
      setBusy(false)
    }
  }, [isOwner, sb, treeId, tree, reloadTree])

  const save = useCallback(async () => {
    if (!isOwner || !sb || !treeId || !tree) return
    const trimmed = nameDraft.trim()
    let displayNameDb: string | null = trimmed.length === 0 ? null : trimmed
    if (displayNameDb && displayNameDb.length > MAX_NAME_LEN) {
      setMsg(`Tên tối đa ${MAX_NAME_LEN} ký tự.`)
      return
    }
    if (displayNameDb && displayNameDb.length === 0) displayNameDb = null

    setBusy(true)
    setMsg(null)
    try {
      let logoPath = tree.app_header_logo_path?.trim() || null

      if (pendingFile) {
        const ext = pendingFile.name.split('.').pop()?.toLowerCase() ?? 'webp'
        const safe = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext.replace('jpeg', 'jpg') : 'webp'
        const nextPath = `${treeId}/header-logo-${crypto.randomUUID()}.${safe}`
        const { error: upErr } = await sb.storage.from('family-tree-brand').upload(nextPath, pendingFile, {
          upsert: false,
          contentType: pendingFile.type || 'image/jpeg',
        })
        if (upErr) {
          setMsg(upErr.message)
          return
        }
        const oldPath = tree.app_header_logo_path?.trim()
        if (oldPath && oldPath !== nextPath) {
          await sb.storage.from('family-tree-brand').remove([oldPath])
        }
        logoPath = nextPath
      }

      const { error: dbErr } = await sb
        .from('family_trees')
        .update({
          app_header_display_name: displayNameDb,
          app_header_logo_path: logoPath,
        })
        .eq('id', treeId)

      if (dbErr) {
        setMsg(dbErr.message)
        return
      }
      setPendingFile(null)
      dispatchAppHeaderBrandRefresh()
      await reloadTree()
      setMsg('Đã lưu tên và logo trên header (áp dụng cho toàn app khi bạn đã đăng nhập).')
    } finally {
      setBusy(false)
    }
  }, [isOwner, sb, treeId, tree, nameDraft, pendingFile, reloadTree])

  const resetNameToDefault = useCallback(async () => {
    if (!isOwner || !sb || !treeId) return
    setBusy(true)
    setMsg(null)
    try {
      const { error } = await sb.from('family_trees').update({ app_header_display_name: null }).eq('id', treeId)
      if (error) {
        setMsg(error.message)
        return
      }
      setNameDraft('')
      dispatchAppHeaderBrandRefresh()
      await reloadTree()
      setMsg(`Đã đặt lại tên mặc định ${APP_DISPLAY_NAME}.`)
    } finally {
      setBusy(false)
    }
  }, [isOwner, sb, treeId, tree, reloadTree])

  if (!isOwner) return null

  const objectPreview = pendingPreviewUrl ?? previewFromStorage

  return (
    <div className={`${role.cardElevated} rounded-abnb-xl border border-abnb-hairlineSoft/90 !p-6 sm:!p-8`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className={role.iconTile}>
            <Sparkles className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h3 className={`${role.headingModule} text-base`}>Thương hiệu trên thanh điều hướng</h3>
            <p className={`${role.bodySm} mt-2 max-w-xl text-abnb-muted`}>
              Chỉ chủ dòng có thể đổi logo và chữ kế bên (ví dụ tên họ). Ảnh dùng màu icon chữ được rõ nhất.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="app-header-brand-name" className={`${role.caption} mb-2 block text-abnb-muted`}>
            Tên hiển thị (để trống = “{APP_DISPLAY_NAME}”)
          </label>
          <input
            id="app-header-brand-name"
            className={`${role.input} max-w-md`}
            maxLength={MAX_NAME_LEN}
            value={nameDraft}
            placeholder="Ví dụ: Gia tộc Nguyễn"
            onChange={(e) => setNameDraft(e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-abnb-md border border-abnb-hairlineSoft bg-abnb-canvas shadow-abnb-inner">
            {objectPreview ? (
              <img src={objectPreview} alt="" className="h-full w-full min-h-0 min-w-0 object-cover object-center" />
            ) : (
              <ImageIcon className="h-7 w-7 text-abnb-muted" strokeWidth={1.5} aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onFileChange} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${role.btnSecondary} h-11 rounded-full px-5 text-sm`}
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                Chọn logo
              </button>
              {storedPath || pendingFile ? (
                <button type="button" className={`${role.btnSecondary} h-11 rounded-full px-5 text-sm`} onClick={() => void clearLogo()} disabled={busy}>
                  Xóa logo
                </button>
              ) : null}
              <button type="button" className={`${role.btnPrimary} h-11 rounded-full px-6 text-sm`} onClick={() => void save()} disabled={busy}>
                {busy ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Đang lưu…
                  </span>
                ) : (
                  'Lưu'
                )}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`${role.linkMuted} text-sm underline-offset-2`}
                onClick={() => void resetNameToDefault()}
                disabled={busy || nameDraft.trim().length === 0}
              >
                Đặt lại tên mặc định
              </button>
            </div>
            {pendingFile ? <p className={`${role.caption} text-abnb-primary`}>Ảnh mới sẽ được tải lên khi bạn bấm Lưu.</p> : null}
            {msg ? <p className={`${role.bodySm} text-abnb-body`}>{msg}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
