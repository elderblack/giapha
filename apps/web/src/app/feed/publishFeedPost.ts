import { getSupabase } from '../../lib/supabase'
import { guessFeedMediaKind } from './guessFeedMedia'
import { uploadFamilyFeedMediaXHR } from './uploadFamilyFeedMediaXHR'

export type FeedPublishProgress =
  | { phase: 'creating_post' }
  | {
      phase: 'uploading'
      fileIndex: number
      fileCount: number
      fileName: string
      loaded: number
      total: number
      overall: number
    }
  | { phase: 'saving_media'; fileIndex: number; fileCount: number }

export type FeedPublishOnProgress = (p: FeedPublishProgress) => void

function supabaseHttpConfig(): { url: string; anonKey: string } | null {
  const url = import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined
  const anonKey =
    (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined)
  if (!url?.trim() || !anonKey?.trim()) return null
  return { url: url.trim(), anonKey: anonKey.trim() }
}

function overallUploadRatio(fileIndex: number, fileCount: number, loaded: number, total: number): number {
  if (fileCount <= 0) return 1
  const denom = total > 0 ? total : 1
  const frac = Math.min(1, loaded / denom)
  return Math.min(1, (fileIndex + frac) / fileCount)
}

function rafThrottle(onProgress: FeedPublishOnProgress | undefined) {
  if (!onProgress) return () => {}
  let raf = 0
  let pending: FeedPublishProgress | null = null
  const flush = () => {
    raf = 0
    if (pending) {
      onProgress(pending)
      pending = null
    }
  }
  return (p: FeedPublishProgress) => {
    pending = p
    if (!raf) raf = requestAnimationFrame(flush)
  }
}

function extFromMime(mime: string): string {
  const m = mime.toLowerCase()
  if (!m) return 'bin'
  if (m.includes('webp')) return 'webp'
  if (m.includes('png')) return 'png'
  if (m.includes('gif')) return 'gif'
  if (m.includes('jpeg') || m.endsWith('/jpg')) return 'jpg'
  if (m.includes('webm')) return 'webm'
  if (m.includes('mp4')) return 'mp4'
  return 'bin'
}

function extOnlyFromFilename(name: string): string | null {
  const m = name.trim().match(/\.([a-zA-Z0-9]{2,14})$/i)
  const ext = (m?.[1] ?? '').toLowerCase()
  if (!ext) return null
  if (ext === 'jpeg') return 'jpg'
  return ext
}

function pickExt(file: File, isVid: boolean): string {
  const fromMime = extFromMime(file.type || '')
  if (fromMime !== 'bin') return fromMime === 'jpeg' ? 'jpg' : fromMime
  const fromName = extOnlyFromFilename(file.name)
  if (!fromName) return isVid ? 'mp4' : 'jpg'
  return fromName
}

function guessContentTypeForUpload(file: File, ext: string, isVid: boolean): string {
  const t = file.type.trim()
  if (t) return t
  if (isVid) {
    if (ext === 'webm') return 'video/webm'
    if (ext === 'mov') return 'video/quicktime'
    return 'video/mp4'
  }
  if (ext === 'png') return 'image/png'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'heic' || ext === 'heif') return 'image/heic'
  return 'image/jpeg'
}

export type PublishFeedPostResult = { ok: true } | { ok: false; error: string }

/**
 * Upload chỉ diễn ra khi gọi API này (sau người dùng bấm đăng bài).
 */
export async function publishFamilyFeedPost(params: {
  treeId: string
  authorId: string
  bodyDraft: string
  files: File[]
  onProgress?: FeedPublishOnProgress
}): Promise<PublishFeedPostResult> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'offline' }

  const { onProgress } = params
  const emitUpload = rafThrottle(onProgress)

  const text = params.bodyDraft.trim()
  const hasParts = Boolean(text.length) || params.files.length > 0
  if (!hasParts) return { ok: false, error: 'empty' }

  onProgress?.({ phase: 'creating_post' })

  const { data: ins, error: ie } = await sb
    .from('family_feed_posts')
    .insert({
      family_tree_id: params.treeId,
      author_id: params.authorId,
      body: text.length ? text : null,
    })
    .select('id')
    .single()

  if (ie || !ins?.id) {
    return { ok: false, error: ie?.message ?? 'insert' }
  }

  const postId = ins.id as string
  const { treeId, authorId, files } = params
  let order = 0
  const failures: string[] = []

  const { data: sess } = await sb.auth.getSession()
  const accessToken = sess.session?.access_token
  const httpCfg = supabaseHttpConfig()
  const fileCount = files.length
  let fileIndex = 0

  for (const file of files) {
    const kind = guessFeedMediaKind(file)
    if (!kind) {
      failures.push(`${file.name}: định dạng không hỗ trợ`)
      fileIndex++
      continue
    }
    const isVid = kind === 'video'
    const ext = pickExt(file, isVid)
    const ct = guessContentTypeForUpload(file, ext, isVid)

    const storagePath = `${treeId}/${authorId}/${crypto.randomUUID()}.${ext}`
    const totalBytes = file.size > 0 ? file.size : 1

    try {
      if (accessToken && httpCfg) {
        await uploadFamilyFeedMediaXHR({
          supabaseUrl: httpCfg.url,
          anonKey: httpCfg.anonKey,
          accessToken,
          storagePath,
          file,
          contentType: ct,
          onProgress: (loaded, total) => {
            const t = total > 0 ? total : totalBytes
            emitUpload({
              phase: 'uploading',
              fileIndex,
              fileCount,
              fileName: file.name,
              loaded,
              total: t,
              overall: overallUploadRatio(fileIndex, fileCount, loaded, t),
            })
          },
        })
      } else {
        const { error: ue } = await sb.storage.from('family-feed-media').upload(storagePath, file, {
          upsert: true,
          contentType: ct,
        })
        if (ue) throw new Error(ue.message)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`${file.name}: ${msg}`)
      fileIndex++
      continue
    }

    onProgress?.({
      phase: 'saving_media',
      fileIndex,
      fileCount,
    })

    const { error: me } = await sb.from('family_feed_post_media').insert({
      post_id: postId,
      storage_path: storagePath,
      media_kind: isVid ? 'video' : 'image',
      sort_order: order++,
    })
    if (me) failures.push(`${file.name}: ${me.message}`)
    fileIndex++
  }

  if (files.length > 0 && order === 0) {
    await sb.from('family_feed_posts').delete().eq('id', postId)
    return { ok: false, error: failures.length ? failures.join(' · ') : 'Không đăng được file đính kèm.' }
  }

  return { ok: true }
}
