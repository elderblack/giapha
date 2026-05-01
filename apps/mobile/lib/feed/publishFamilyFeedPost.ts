import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'

import { getSupabase } from '@/lib/supabase'

import { guessMediaKindFromPickerAsset } from './guessFeedMedia'

export type PublishFeedPostResult = { ok: true } | { ok: false; error: string }

function extFromMime(mime: string): string {
  const m = mime.toLowerCase()
  if (!m) return 'jpg'
  if (m.includes('webp')) return 'webp'
  if (m.includes('png')) return 'png'
  if (m.includes('gif')) return 'gif'
  if (m.includes('jpeg') || m.endsWith('/jpg')) return 'jpg'
  if (m.includes('heic')) return 'heic'
  if (m.includes('heif')) return 'heif'
  if (m.includes('quicktime') || m.includes('mov')) return 'mov'
  if (m.includes('webm')) return 'webm'
  if (m.includes('mp4')) return 'mp4'
  return 'jpg'
}

function extFromPickerAsset(asset: {
  mimeType?: string | null
  uri: string
  fileName?: string | null
  type?: unknown
}): string {
  if (asset.mimeType) return extFromMime(asset.mimeType)
  const name = (asset.fileName ?? asset.uri).split(/[/\\]/).pop() ?? ''
  const dot = name.lastIndexOf('.')
  if (dot >= 0) {
    const e = name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
    if (e) return e.slice(0, 8)
  }
  const kind = guessMediaKindFromPickerAsset(asset as { uri: string; mimeType?: string | null; type?: 'image' | 'video' })
  return kind === 'video' ? 'mp4' : 'jpg'
}

function randomUuid(): string {
  const g = globalThis.crypto as Crypto | undefined
  if (g?.randomUUID) return g.randomUUID()
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function isHeifLike(ext: string, mime: string | null | undefined): boolean {
  const e = ext.toLowerCase()
  if (e === 'heic' || e === 'heif') return true
  const m = (mime ?? '').toLowerCase()
  return m.includes('heic') || m.includes('heif')
}

/** HEIC/HEIF không hiển thị ổn với <Image> từ URL trên nhiều thiết bị — chuyển JPEG trước khi tải lên. */
async function prepareStillImageUri(asset: PublishFeedAsset, ext: string): Promise<{ readUri: string; storageExt: string }> {
  const uri = asset.uri.trim()
  if (!isHeifLike(ext, asset.mimeType)) {
    return { readUri: uri, storageExt: ext }
  }
  try {
    const out = await manipulateAsync(uri, [], { compress: 0.88, format: SaveFormat.JPEG })
    return { readUri: out.uri, storageExt: 'jpg' }
  } catch {
    return { readUri: uri, storageExt: ext }
  }
}

export type PublishFeedAsset = {
  uri: string
  mimeType?: string | null
  /** Expo ImagePicker */
  type?: 'image' | 'video'
  fileName?: string | null
}

/** Ảnh / video cục bộ (Expo picker) đồng bộ luồng web: bucket `family-feed-media`. */
export async function publishFamilyFeedPostMobile(params: {
  treeId: string
  authorId: string
  bodyDraft: string
  assets: PublishFeedAsset[]
}): Promise<PublishFeedPostResult> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'Chưa kết nối được máy chủ.' }

  const text = params.bodyDraft.trim()
  const assets = params.assets.filter((a) => a.uri?.trim())
  const hasParts = Boolean(text.length) || assets.length > 0
  if (!hasParts) return { ok: false, error: 'Nhập chữ hoặc chọn ảnh/video.' }

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
    return { ok: false, error: ie?.message ?? 'Không tạo được bài viết.' }
  }

  const postId = ins.id as string
  let order = 0
  let uploaded = 0
  const failNotes: string[] = []

  for (const asset of assets) {
    const uri = asset.uri.trim()
    if (!uri.length) continue

    const kind = guessMediaKindFromPickerAsset(asset)
    if (!kind) {
      failNotes.push('Không nhận dạng được định dạng (chỉ hỗ trợ ảnh và video thông dụng).')
      continue
    }

    const isVid = kind === 'video'
    const extOriginal = extFromPickerAsset(asset)
    const prepared = !isVid
      ? await prepareStillImageUri(asset, extOriginal)
      : { readUri: uri, storageExt: extOriginal }
    const readUri = prepared.readUri
    const pathExt = prepared.storageExt

    let blob: Blob
    try {
      const response = await fetch(readUri)
      if (!response.ok) {
        failNotes.push(isVid ? 'Không đọc được file video.' : 'Không đọc được file ảnh.')
        continue
      }
      blob = await response.blob()
    } catch {
      failNotes.push(isVid ? 'Lỗi khi đọc video (thử chọn clip ngắn hơn hoặc định dạng MP4).' : 'Lỗi khi đọc ảnh.')
      continue
    }

    if (blob.size === 0) {
      failNotes.push(isVid ? 'File video rỗng.' : 'File ảnh rỗng.')
      continue
    }

    const jpegFromConversion =
      !isVid && pathExt === 'jpg' && !['jpg', 'jpeg'].includes(extOriginal.toLowerCase())

    const ct =
      jpegFromConversion
        ? 'image/jpeg'
        : blob.type ||
          asset.mimeType ||
          (isVid
            ? pathExt === 'webm'
              ? 'video/webm'
              : pathExt === 'mov'
                ? 'video/quicktime'
                : 'video/mp4'
            : pathExt === 'png'
              ? 'image/png'
              : pathExt === 'webp'
                ? 'image/webp'
                : pathExt === 'jpg' || pathExt === 'jpeg'
                  ? 'image/jpeg'
                  : `image/jpeg`)

    const storagePath = `${params.treeId}/${params.authorId}/${randomUuid()}.${pathExt}`

    const { error: ue } = await sb.storage.from('family-feed-media').upload(storagePath, blob, {
      upsert: true,
      contentType: ct,
    })

    if (ue) {
      failNotes.push(ue.message)
      continue
    }

    const { error: me } = await sb.from('family_feed_post_media').insert({
      post_id: postId,
      storage_path: storagePath,
      media_kind: isVid ? 'video' : 'image',
      sort_order: order,
    })

    if (me) {
      failNotes.push(me.message)
      continue
    }

    uploaded++
    order++
  }

  const wantedMedia = assets.length > 0
  if (wantedMedia && uploaded === 0) {
    await sb.from('family_feed_posts').delete().eq('id', postId)
    return {
      ok: false,
      error: failNotes[0] ?? 'Không tải được media lên máy chủ. Kiểm tra mạng và quyền Storage (bucket family-feed-media).',
    }
  }

  if (!text.length && uploaded === 0) {
    await sb.from('family_feed_posts').delete().eq('id', postId)
    return { ok: false, error: 'Bài không có nội dung hợp lệ.' }
  }

  return { ok: true }
}
