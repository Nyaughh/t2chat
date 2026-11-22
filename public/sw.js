const SHELL_CACHE = 't2chat-offline-shell-v2'

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    // Only the anonymous shell is safe to keep across account changes.
    const cache = await caches.open(SHELL_CACHE)
    await cache.add(new Request('/', { credentials: 'omit', cache: 'reload' }))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await caches.delete('t2chat-cache-v1')
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.mode !== 'navigate' || request.url !== new URL('/', self.location.origin).href) return

  // Online visits need the current build and this request's account settings.
  event.respondWith(fetch(request).catch(async (error) => {
    const cache = await caches.open(SHELL_CACHE)
    const shell = await cache.match('/')
    if (shell) return shell
    throw error
  }))
})
