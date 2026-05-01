import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { APP_DISPLAY_NAME, APP_HEADER_BRAND_REFRESH_EVENT } from '../lib/appHeaderBrandEvents'
import { getUserFamilyTreeId } from '../lib/familyTreeMembership'
import { getSupabase } from '../lib/supabase'

export function useAppHeaderBrand() {
  const { user } = useAuth()
  const sb = getSupabase()
  const [title, setTitle] = useState(APP_DISPLAY_NAME)
  const [logoPublicUrl, setLogoPublicUrl] = useState<string | null>(null)
  const [cacheBust, setCacheBust] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    if (!sb || !user?.id) {
      setTitle(APP_DISPLAY_NAME)
      setLogoPublicUrl(null)
      setCacheBust((n) => n + 1)
      setLoading(false)
      return
    }
    const treeId = await getUserFamilyTreeId(sb, user.id)
    if (!treeId) {
      setTitle(APP_DISPLAY_NAME)
      setLogoPublicUrl(null)
      setCacheBust((n) => n + 1)
      setLoading(false)
      return
    }
    const { data, error } = await sb
      .from('family_trees')
      .select('app_header_display_name, app_header_logo_path')
      .eq('id', treeId)
      .maybeSingle()
    if (error || !data) {
      setTitle(APP_DISPLAY_NAME)
      setLogoPublicUrl(null)
      setCacheBust((n) => n + 1)
      setLoading(false)
      return
    }
    const row = data as { app_header_display_name?: string | null; app_header_logo_path?: string | null }
    const t = row.app_header_display_name?.trim()
    setTitle(t && t.length > 0 ? t : APP_DISPLAY_NAME)
    const p = row.app_header_logo_path?.trim()
    if (p) {
      const {
        data: { publicUrl },
      } = sb.storage.from('family-tree-brand').getPublicUrl(p)
      setLogoPublicUrl(publicUrl ?? null)
    } else {
      setLogoPublicUrl(null)
    }
    setCacheBust((n) => n + 1)
    setLoading(false)
  }, [sb, user?.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => void load()
    window.addEventListener(APP_HEADER_BRAND_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(APP_HEADER_BRAND_REFRESH_EVENT, onRefresh)
  }, [load])

  return {
    title,
    logoPublicUrl,
    /** Gắn vào `?v=` ảnh để tránh cache sau khi đổi file. */
    logoUrlWithBust: logoPublicUrl ? `${logoPublicUrl}?v=${cacheBust}` : null,
    loading,
    refresh: load,
  }
}
