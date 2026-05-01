const BUCKET = 'family-feed-media'

/** POST `/storage/v1/object/{bucket}/{path}` — có tiến trình upload (XHR.upload). */
export async function uploadFamilyFeedMediaXHR(params: {
  supabaseUrl: string
  anonKey: string
  accessToken: string
  storagePath: string
  file: File
  contentType: string
  onProgress?: (loaded: number, total: number) => void
}): Promise<void> {
  const base = params.supabaseUrl.replace(/\/+$/, '')
  const encPath = params.storagePath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  const url = `${base}/storage/v1/object/${encodeURIComponent(BUCKET)}/${encPath}`

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Authorization', `Bearer ${params.accessToken}`)
    xhr.setRequestHeader('apikey', params.anonKey)
    xhr.setRequestHeader('Content-Type', params.contentType || 'application/octet-stream')
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('x-client-info', 'giapha-web-upload-xhr')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && params.onProgress) params.onProgress(e.loaded, e.total)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else {
        let msg = xhr.statusText || `HTTP ${xhr.status}`
        try {
          const j = JSON.parse(xhr.responseText || '{}') as { message?: string; error?: string }
          if (typeof j.message === 'string') msg = j.message
          else if (typeof j.error === 'string') msg = j.error
        } catch {
          /* ignore */
        }
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Không tải lên được — lỗi mạng.'))

    xhr.send(params.file)
  })
}
