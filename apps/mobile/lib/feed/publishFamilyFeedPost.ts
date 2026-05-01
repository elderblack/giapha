import { manipulateAsync, SaveFormat } from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'

import { getSupabase } from '@/lib/supabase'

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

    dbg('asset BEGIN', { uriTail: uriTail(uri), kind, order })
    const isVid = kind === 'video'
    const extOriginal = extFromPickerAsset(asset)
    const prepared = !isVid
      ? await normalizeStillImageForUpload(asset, extOriginal)
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
                  : pathExt === 'jpg' || pathExt === 'jpeg'
                    ? 'image/jpeg'
                    : 'image/jpeg')) || 'application/octet-stream'

    /** Content-Type upload — không phụ thuộc Blob (ưu tiên native upload không đọc hết file vào RAM). */
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
                : pathExt === 'jpg' || pathExt === 'jpeg'
                  ? 'image/jpeg'
                  : 'image/jpeg')

    const storagePath = `${params.treeId}/${params.authorId}/${randomUuid()}.${pathExt}`

    let storageOk = false
    const localUri = readUri.trim()
    const canNativeUpload =
      Boolean(accessToken && supabaseUrl && anonKey && /^file:\/\//i.test(localUri))

    if (canNativeUpload) {
      dbg('storage upload TRY native (uploadAsync)', {
        storagePath,
        contentType: ct,
        readTail: uriTail(readUri),
        media_kind: isVid ? 'video' : 'image',
      })
      const nat = await uploadFamilyFeedMediaNative({
        supabaseUrl,
        anonKey,
        accessToken,
        storagePath,
        fileUri: localUri,
        contentType: ct,
      })
      if (nat.ok) {
        dbg('storage upload OK (native)', { storagePath })
        storageOk = true
      } else {
        dbg('storage native FAIL → blob path', { message: nat.message })
      }
    }

    if (!storageOk) {
      let blob: Blob | null = null
      try {
        blob = await readLocalUriIntoBlob(readUri, mimeHintForRead)
      } catch {
        blob = null
      }
      if (!blob) {
        dbg('asset FAIL no blob', { uriTail: uriTail(readUri), mimeHintForRead })
        failNotes.push(isVid ? 'Không đọc được file video.' : 'Không đọc được file ảnh.')
        continue
      }

      if (blob.size === 0) {
        dbg('asset FAIL blob size 0', { uriTail: uriTail(readUri) })
        failNotes.push(isVid ? 'File video rỗng.' : 'File ảnh rỗng.')
        continue
      }

      const uploadCt =
        jpegFromConversion
          ? 'image/jpeg'
          : blob.type?.trim() || ct

      dbg('storage upload (supabase blob)', {
        storagePath,
        contentType: uploadCt,
        bytes: blob.size,
        media_kind: isVid ? 'video' : 'image',
      })

      const { error: ue } = await sb.storage.from('family-feed-media').upload(storagePath, blob, {
        upsert: true,
        contentType: uploadCt,
      })

      if (ue) {
        dbg('storage upload FAIL', { message: ue.message, storagePath })
        failNotes.push(ue.message)
        continue
      }

      dbg('storage upload OK (blob)', { storagePath })
      storageOk = true
    }

    if (!storageOk) continue

    const { error: me } = await sb.from('family_feed_post_media').insert({
      post_id: postId,
      storage_path: storagePath,
      media_kind: isVid ? 'video' : 'image',
      sort_order: order,
    })

    if (me) {
      dbg('family_feed_post_media insert FAIL', { message: me.message, postId, storagePath })
      failNotes.push(me.message)
      continue
    }

    dbg('asset DONE', { storagePath, sort_order: order })
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
