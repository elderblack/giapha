/* eslint-disable no-restricted-globals */
/** Optional cache for Supabase Storage public objects — stale-while-revalidate style refresh. */
const CACHE = 'giapha-media-v1'

function isPublicSupabaseMedia(url) {
  try {
    const u = new URL(url)
    return (
      /supabase\.co$/i.test(u.hostname) &&
      u.pathname.includes('/storage/v1/object/public/') &&
      /\.(webp|jpg|jpeg|png|gif|mp4|webm)$/i.test(u.pathname)
    )
  } catch {
    return false
  }
}

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || !isPublicSupabaseMedia(req.url)) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      const net = fetch(req)
        .then((res) => {
          if (res.ok) void cache.put(req, res.clone())
          return res
        })
        .catch(() => null)
      if (cached) {
        void net
        return cached
      }
      const fresh = await net
      return fresh ?? Response.error()
    }),
  )
})
