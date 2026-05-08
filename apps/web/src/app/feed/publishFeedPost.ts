import { getSupabase } from '../../lib/supabase'
import { createImageVariants } from '../../lib/media/createImageVariants'
import { createVideoPosterBlob } from '../../lib/media/createVideoPoster'
import { assertFeedImageSize, assertFeedVideoSize } from '../../lib/media/mediaLimits'
import { logMediaUploadMetric } from '../../lib/media/telemetry'
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

async function uploadFamilyFeedObject(params: {
  sb: ReturnType<typeof getSupabase>
  storagePath: string
  body: Blob
  fileLabel: string
  contentType: string
  accessToken: string | undefined
  httpCfg: ReturnType<typeof supabaseHttpConfig>
  onProgress?: (loaded: number, total: number) => void
}): Promise<void> {
  const { sb, storagePath, body, fileLabel, contentType, accessToken, httpCfg, onProgress } = params
  if (!sb) throw new Error('offline')

  logMediaUploadMetric({
    context: 'family-feed-media',
    variant: storagePath,
    bytes: body.size,
    mime: contentType,
  })

  if (accessToken && httpCfg) {
    await uploadFamilyFeedMediaXHR({
      supabaseUrl: httpCfg.url,
      anonKey: httpCfg.anonKey,
      accessToken,
      storagePath,
      file: body,
      fileName: fileLabel,
      contentType,
      cacheControl: '31536000',
      onProgress,
    })
    return
  }

  const file = new File([body], fileLabel, { type: contentType })
  const { error: ue } = await sb.storage.from('family-feed-media').upload(storagePath, file, {
    upsert: true,
    contentType,
    cacheControl: '31536000',
  })
  if (ue) throw new Error(ue.message)
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

    const sizeErr = isVid ? assertFeedVideoSize(file) : assertFeedImageSize(file)
    if (sizeErr) {
      failures.push(`${file.name}: ${sizeErr}`)
      fileIndex++
      continue
    }

    const baseId = crypto.randomUUID()
    const prefix = `${treeId}/${authorId}/${baseId}`

    try {
      if (isVid) {
        const storagePath = `${prefix}.${ext}`
        const totalBytes = file.size > 0 ? file.size : 1

        await uploadFamilyFeedObject({
          sb,
          storagePath,
          body: file,
          fileLabel: file.name || `video.${ext}`,
          contentType: ct,
          accessToken,
          httpCfg,
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

        let posterPath: string | null = null
        const posterBlob = await createVideoPosterBlob(file)
        if (posterBlob && posterBlob.size > 0) {
          posterPath = `${prefix}_poster.jpg`
          await uploadFamilyFeedObject({
            sb,
            storagePath: posterPath,
            body: posterBlob,
            fileLabel: 'poster.jpg',
            contentType: 'image/jpeg',
            accessToken,
            httpCfg,
          })
        }

        onProgress?.({ phase: 'saving_media', fileIndex, fileCount })

        const { error: me } = await sb.from('family_feed_post_media').insert({
          post_id: postId,
          storage_path: storagePath,
          storage_bucket: 'family-feed-media',
          thumb_path: posterPath,
          medium_path: posterPath,
          poster_path: posterPath,
          media_kind: 'video',
          sort_order: order++,
        })
        if (me) failures.push(`${file.name}: ${me.message}`)
      } else {
        try {
          const variants = await createImageVariants(file)
          if (variants.kind === 'passthrough') {
            const storagePath = `${prefix}.${variants.ext}`
            const totalBytes = variants.blob.size > 0 ? variants.blob.size : 1
            await uploadFamilyFeedObject({
              sb,
              storagePath,
              body: variants.blob,
              fileLabel: file.name || `image.${variants.ext}`,
              contentType: variants.mime || ct,
              accessToken,
              httpCfg,
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
            onProgress?.({ phase: 'saving_media', fileIndex, fileCount })
            const { error: me } = await sb.from('family_feed_post_media').insert({
              post_id: postId,
              storage_path: storagePath,
              storage_bucket: 'family-feed-media',
              thumb_path: storagePath,
              medium_path: storagePath,
              media_kind: 'image',
              sort_order: order++,
              media_width: variants.width || null,
              media_height: variants.height || null,
            })
            if (me) failures.push(`${file.name}: ${me.message}`)
          } else {
            const tp = `${prefix}_t.${variants.ext}`
            const mp = `${prefix}_m.${variants.ext}`
            const op = `${prefix}.${variants.ext}`
            const parts: { path: string; blob: Blob; label: string; mime: string }[] = [
              { path: tp, blob: variants.thumb, label: `thumb.${variants.ext}`, mime: variants.mime },
              { path: mp, blob: variants.medium, label: `medium.${variants.ext}`, mime: variants.mime },
              { path: op, blob: variants.original, label: `full.${variants.ext}`, mime: variants.mime },
            ]
            const grandTotal = parts.reduce((s, p) => s + p.blob.size, 0) || 1
            let done = 0
            for (const part of parts) {
              await uploadFamilyFeedObject({
                sb,
                storagePath: part.path,
                body: part.blob,
                fileLabel: part.label,
                contentType: part.mime,
                accessToken,
                httpCfg,
                onProgress: (loaded, total) => {
                  const t = total > 0 ? total : part.blob.size
                  emitUpload({
                    phase: 'uploading',
                    fileIndex,
                    fileCount,
                    fileName: file.name,
                    loaded: done + loaded,
                    total: grandTotal,
                    overall: overallUploadRatio(fileIndex, fileCount, done + loaded, grandTotal),
                  })
                },
              })
              done += part.blob.size
            }
            onProgress?.({ phase: 'saving_media', fileIndex, fileCount })
            const { error: me } = await sb.from('family_feed_post_media').insert({
              post_id: postId,
              storage_path: op,
              storage_bucket: 'family-feed-media',
              thumb_path: tp,
              medium_path: mp,
              media_kind: 'image',
              sort_order: order++,
              media_width: variants.width,
              media_height: variants.height,
            })
            if (me) failures.push(`${file.name}: ${me.message}`)
          }
        } catch {
          const storagePath = `${prefix}.${ext}`
          const totalBytes = file.size > 0 ? file.size : 1
          await uploadFamilyFeedObject({
            sb,
            storagePath,
            body: file,
            fileLabel: file.name || `image.${ext}`,
            contentType: ct,
            accessToken,
            httpCfg,
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
          onProgress?.({ phase: 'saving_media', fileIndex, fileCount })
          const { error: me } = await sb.from('family_feed_post_media').insert({
            post_id: postId,
            storage_path: storagePath,
            storage_bucket: 'family-feed-media',
            thumb_path: storagePath,
            medium_path: storagePath,
            media_kind: 'image',
            sort_order: order++,
          })
          if (me) failures.push(`${file.name}: ${me.message}`)
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      failures.push(`${file.name}: ${msg}`)
    }
    fileIndex++
  }

  if (files.length > 0 && order === 0) {
    await sb.from('family_feed_posts').delete().eq('id', postId)
    return { ok: false, error: failures.length ? failures.join(' · ') : 'Không đăng được file đính kèm.' }
  }

  return { ok: true }
}
