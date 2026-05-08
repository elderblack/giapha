import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import * as VideoThumbnails from 'expo-video-thumbnails'

import { getSupabase } from '@/lib/supabase'

import {
  assertFeedImageSizeBytes,
  assertFeedVideoSizeBytes,
} from '@/lib/media/mediaLimits'
import { logMediaUploadMetric } from '@/lib/media/telemetry'

import { guessMediaKindFromPickerAsset } from './guessFeedMedia'
import { uploadFamilyFeedMediaNative } from '@/lib/feed/uploadFamilyFeedMediaNative'

export type PublishFeedPostResult = { ok: true; postId: string } | { ok: false; error: string }

function dbg(phase: string, data?: Record<string, unknown>): void {
  if (!__DEV__) return
  if (data === undefined) console.log(`[feed-publish] ${phase}`)
  else console.log(`[feed-publish] ${phase}`, data)
}

function uriTail(uri: string, max = 56): string {
  const u = uri.trim()
  const tail = u.split(/[/\\]/).pop() ?? u
  return tail.length <= max ? tail : `${tail.slice(0, max)}…`
}

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

/**
 * Ưu tiên ép mọi ảnh tin lên thành JPEG (bucket chỉ whitelist jpeg/png/webp/gif; AVIF/HEIC/lệch MIME hay làm RN Image hỏng).
 * Fallback: chỉ HEIC như cũ nếu manipulator lỗi.
 */
async function normalizeStillImageForUpload(
  asset: PublishFeedAsset,
  extOriginal: string,
): Promise<{ readUri: string; storageExt: string }> {
  try {
    const out = await manipulateAsync(asset.uri.trim(), [], { compress: 0.88, format: SaveFormat.JPEG })
    dbg('image→JPEG OK', { readTail: uriTail(out.uri), extOriginal })
    return { readUri: out.uri, storageExt: 'jpg' }
  } catch (e) {
    dbg('image→JPEG FAIL, fallback HEIC/raw', {
      message: e instanceof Error ? e.message : String(e),
      extOriginal,
      uriTail: uriTail(asset.uri),
    })
    return prepareStillImageUri(asset, extOriginal)
  }
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
  duration?: number | null
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = globalThis.atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/** RN: `fetch(file://)` hay trả blob size 0 — đọc base64 qua FileSystem (bucket giống web: cần bytes thật). */
export async function readLocalUriIntoBlob(readUri: string, contentType: string): Promise<Blob | null> {
  try {
    const res = await fetch(readUri)
    if (res.ok) {
      const fromFetch = await res.blob()
      if (fromFetch.size > 0) {
        dbg('blob via fetch', { size: fromFetch.size, type: fromFetch.type || contentType, readTail: uriTail(readUri) })
        return fromFetch
      }
      dbg('fetch blob empty → try FileSystem', { readTail: uriTail(readUri), status: res.status })
    }
  } catch (e) {
    dbg('fetch FAIL → try FileSystem', {
      readTail: uriTail(readUri),
      message: e instanceof Error ? e.message : String(e),
    })
  }

  try {
    const info = await FileSystem.getInfoAsync(readUri)
    if (!info.exists || info.isDirectory) {
      dbg('FileSystem skip', {
        readTail: uriTail(readUri),
        exists: info.exists,
        isDirectory: info.exists ? info.isDirectory : undefined,
      })
      return null
    }
    if (info.size < 1) {
      dbg('FileSystem empty file', { readTail: uriTail(readUri) })
      return null
    }
    const b64 = await FileSystem.readAsStringAsync(readUri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    if (!b64) {
      dbg('FileSystem base64 empty', { readTail: uriTail(readUri) })
      return null
    }
    const blob = base64ToBlob(b64, contentType || 'application/octet-stream')
    dbg('blob via FileSystem', { size: blob.size, type: blob.type || contentType, readTail: uriTail(readUri) })
    return blob
  } catch (e) {
    dbg('FileSystem FAIL', {
      readTail: uriTail(readUri),
      message: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

async function tryUploadLocalToFeedBucket(params: {
  sb: NonNullable<ReturnType<typeof getSupabase>>
  readUri: string
  storagePath: string
  ct: string
  mimeHintForRead: string
  accessToken: string | null
  supabaseUrl: string
  anonKey: string
  jpegFromConversion: boolean
}): Promise<boolean> {
  const localUri = params.readUri.trim()
  const canNativeUpload =
    Boolean(params.accessToken && params.supabaseUrl && params.anonKey && /^file:\/\//i.test(localUri))

  if (canNativeUpload) {
    dbg('storage upload TRY native', { storagePath: params.storagePath, readTail: uriTail(localUri) })
    const nat = await uploadFamilyFeedMediaNative({
      supabaseUrl: params.supabaseUrl,
      anonKey: params.anonKey,
      accessToken: params.accessToken!,
      storagePath: params.storagePath,
      fileUri: localUri,
      contentType: params.ct,
    })
    if (nat.ok) {
      dbg('storage upload OK (native)', { storagePath: params.storagePath })
      return true
    }
    dbg('storage native FAIL → blob', { message: nat.message })
  }

  let blob: Blob | null = null
  try {
    blob = await readLocalUriIntoBlob(localUri, params.mimeHintForRead)
  } catch {
    blob = null
  }
  if (!blob || blob.size === 0) {
    dbg('upload FAIL no blob', { storagePath: params.storagePath })
    return false
  }

  const uploadCt =
    params.jpegFromConversion ? 'image/jpeg' : blob.type?.trim() || params.ct

  logMediaUploadMetric({
    context: 'family-feed-media',
    variant: params.storagePath,
    bytes: blob.size,
    mime: uploadCt,
  })

  const { error: ue } = await params.sb.storage.from('family-feed-media').upload(params.storagePath, blob, {
    upsert: true,
    contentType: uploadCt,
    cacheControl: '31536000',
  })

  if (ue) {
    dbg('storage upload FAIL blob', { message: ue.message, storagePath: params.storagePath })
    return false
  }
  dbg('storage upload OK (blob)', { storagePath: params.storagePath })
  return true
}

/** Ảnh / video cục bộ (Expo picker) đồng bộ luồng web: bucket `family-feed-media`. */
export async function publishFamilyFeedPostMobile(params: {
  treeId: string
  authorId: string
  bodyDraft: string
  assets: PublishFeedAsset[]
}): Promise<PublishFeedPostResult> {
  const sb = getSupabase()
  if (!sb) {
    dbg('ABORT no Supabase client')
    return { ok: false, error: 'Chưa kết nối được máy chủ.' }
  }

  const text = params.bodyDraft.trim()
  const assets = params.assets.filter((a) => a.uri?.trim())
  const hasParts = Boolean(text.length) || assets.length > 0
  if (!hasParts) {
    dbg('ABORT empty draft + no assets')
    return { ok: false, error: 'Nhập chữ hoặc chọn ảnh/video.' }
  }

  dbg('START', {
    treeId: params.treeId,
    authorShort: `${params.authorId.slice(0, 8)}…`,
    bodyLen: text.length,
    assetCount: assets.length,
    assets: assets.map((a, i) => ({
      i,
      kind: guessMediaKindFromPickerAsset(a),
      pickerType: a.type,
      mimeType: a.mimeType ?? null,
      duration: a.duration ?? null,
      uriTail: uriTail(a.uri),
    })),
  })

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
    dbg('post insert FAIL', { message: ie?.message ?? 'no row' })
    return { ok: false, error: ie?.message ?? 'Không tạo được bài viết.' }
  }

  const postId = ins.id as string
  dbg('post insert OK', { postId })
  let order = 0
  let uploaded = 0
  const failNotes: string[] = []

  const { data: sessWrap } = await sb.auth.getSession()
  const accessToken = sessWrap.session?.access_token ?? null
  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim()
  const anonKey = (
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    ''
  ).trim()

  for (const asset of assets) {
    const uri = asset.uri.trim()
    if (!uri.length) continue

    const kind = guessMediaKindFromPickerAsset(asset)
    if (!kind) {
      dbg('asset SKIP unknown kind', { uriTail: uriTail(uri) })
      failNotes.push('Không nhận dạng được định dạng (chỉ hỗ trợ ảnh và video thông dụng).')
      continue
    }

    try {
      const finfo = await FileSystem.getInfoAsync(uri)
      if (finfo.exists && !finfo.isDirectory && 'size' in finfo && typeof finfo.size === 'number') {
        if (kind === 'video') {
          const es = assertFeedVideoSizeBytes(finfo.size)
          if (es) {
            failNotes.push(es)
            continue
          }
        } else {
          const es = assertFeedImageSizeBytes(finfo.size)
          if (es) {
            failNotes.push(es)
            continue
          }
        }
      }
    } catch {
      /* bỏ qua giới hạn nếu không đọc được size */
    }

    dbg('asset BEGIN', { uriTail: uriTail(uri), kind, order })
    const isVid = kind === 'video'
    const extOriginal = extFromPickerAsset(asset)
    const isGif =
      !isVid &&
      (extOriginal.toLowerCase() === 'gif' ||
        asset.mimeType?.toLowerCase() === 'image/gif' ||
        (asset.fileName ?? '').toLowerCase().endsWith('.gif'))

    const prepared = !isVid
      ? isGif
        ? { readUri: uri, storageExt: 'gif' as const }
        : await normalizeStillImageForUpload(asset, extOriginal)
      : { readUri: uri, storageExt: extOriginal }
    const readUri = prepared.readUri
    const pathExt = prepared.storageExt
    dbg('prepared readUri', { readTail: uriTail(readUri), pathExt, isVideo: isVid })

    const jpegFromConversion =
      !isVid && pathExt === 'jpg' && !['jpg', 'jpeg'].includes(extOriginal.toLowerCase())

    const mimeHintForRead =
      jpegFromConversion
        ? 'image/jpeg'
        : (asset.mimeType?.trim() ||
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
                  : pathExt === 'gif'
                    ? 'image/gif'
                    : pathExt === 'jpg' || pathExt === 'jpeg'
                      ? 'image/jpeg'
                      : 'image/jpeg')) || 'application/octet-stream'

    const ct =
      jpegFromConversion
        ? 'image/jpeg'
        : asset.mimeType?.trim() ||
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
                : pathExt === 'gif'
                  ? 'image/gif'
                  : pathExt === 'jpg' || pathExt === 'jpeg'
                    ? 'image/jpeg'
                    : 'image/jpeg')

    const commonUpload = (localUri: string, storagePath: string, contentType: string, mimeHint: string, jConv: boolean) =>
      tryUploadLocalToFeedBucket({
        sb,
        readUri: localUri,
        storagePath,
        ct: contentType,
        mimeHintForRead: mimeHint,
        accessToken,
        supabaseUrl,
        anonKey,
        jpegFromConversion: jConv,
      })

    if (isVid) {
      const videoPath = `${params.treeId}/${params.authorId}/${randomUuid()}.${pathExt}`
      const vOk = await commonUpload(readUri, videoPath, ct, mimeHintForRead, false)
      if (!vOk) {
        failNotes.push('Không tải lên được video.')
        continue
      }

      let posterPath: string | null = null
      try {
        const { uri: thUri } = await VideoThumbnails.getThumbnailAsync(readUri, {
          time: 150,
          quality: 0.72,
        })
        posterPath = `${params.treeId}/${params.authorId}/${randomUuid()}_poster.jpg`
        const pOk = await commonUpload(thUri, posterPath, 'image/jpeg', 'image/jpeg', true)
        if (!pOk) posterPath = null
      } catch {
        posterPath = null
      }

      const { error: me } = await sb.from('family_feed_post_media').insert({
        post_id: postId,
        storage_path: videoPath,
        storage_bucket: 'family-feed-media',
        thumb_path: posterPath,
        medium_path: posterPath,
        poster_path: posterPath,
        media_kind: 'video',
        sort_order: order,
      })

      if (me) {
        dbg('family_feed_post_media insert FAIL', { message: me.message, postId })
        failNotes.push(me.message)
        continue
      }
      dbg('asset DONE video', { videoPath, posterPath })
      uploaded++
      order++
      continue
    }

    if (pathExt === 'gif') {
      const gifPath = `${params.treeId}/${params.authorId}/${randomUuid()}.gif`
      const gOk = await commonUpload(readUri, gifPath, 'image/gif', 'image/gif', false)
      if (!gOk) {
        failNotes.push('Không tải lên được ảnh GIF.')
        continue
      }
      const { error: me } = await sb.from('family_feed_post_media').insert({
        post_id: postId,
        storage_path: gifPath,
        storage_bucket: 'family-feed-media',
        thumb_path: gifPath,
        medium_path: gifPath,
        media_kind: 'image',
        sort_order: order,
      })
      if (me) {
        failNotes.push(me.message)
        continue
      }
      uploaded++
      order++
      continue
    }

    let thumbUri: string
    let medUri: string
    let fullUri: string
    try {
      thumbUri = (await manipulateAsync(readUri, [{ resize: { width: 320 } }], { compress: 0.82, format: SaveFormat.JPEG }))
        .uri
      medUri = (await manipulateAsync(readUri, [{ resize: { width: 1080 } }], { compress: 0.82, format: SaveFormat.JPEG }))
        .uri
      fullUri = (await manipulateAsync(readUri, [{ resize: { width: 1920 } }], { compress: 0.85, format: SaveFormat.JPEG }))
        .uri
    } catch (e) {
      dbg('manipulate variants FAIL', { message: e instanceof Error ? e.message : String(e) })
      failNotes.push('Không xử lý được ảnh.')
      continue
    }

    const idBase = randomUuid()
    const tp = `${params.treeId}/${params.authorId}/${idBase}_t.jpg`
    const mp = `${params.treeId}/${params.authorId}/${idBase}_m.jpg`
    const op = `${params.treeId}/${params.authorId}/${idBase}.jpg`

    const okT = await commonUpload(thumbUri, tp, 'image/jpeg', 'image/jpeg', true)
    const okM = await commonUpload(medUri, mp, 'image/jpeg', 'image/jpeg', true)
    const okO = await commonUpload(fullUri, op, 'image/jpeg', 'image/jpeg', true)
    if (!okT || !okM || !okO) {
      failNotes.push('Không tải lên được ảnh (biến thể).')
      continue
    }

    const { error: me } = await sb.from('family_feed_post_media').insert({
      post_id: postId,
      storage_path: op,
      storage_bucket: 'family-feed-media',
      thumb_path: tp,
      medium_path: mp,
      media_kind: 'image',
      sort_order: order,
    })

    if (me) {
      failNotes.push(me.message)
      continue
    }

    dbg('asset DONE image variants', { op })
    uploaded++
    order++
  }

  const wantedMedia = assets.length > 0
  if (wantedMedia && uploaded === 0) {
    dbg('ROLLBACK post (no media uploaded)', { postId, failNotes })
    await sb.from('family_feed_posts').delete().eq('id', postId)
    return {
      ok: false,
      error: failNotes[0] ?? 'Không tải được media lên máy chủ. Kiểm tra mạng và quyền Storage (bucket family-feed-media).',
    }
  }

  if (!text.length && uploaded === 0) {
    dbg('ROLLBACK post (no text no media)', { postId })
    await sb.from('family_feed_posts').delete().eq('id', postId)
    return { ok: false, error: 'Bài không có nội dung hợp lệ.' }
  }

  dbg('COMPLETE OK', { postId, uploaded, hadText: text.length > 0 })
  return { ok: true, postId }
}
