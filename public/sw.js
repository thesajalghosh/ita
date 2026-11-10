const CACHE_NAME = 'ita-app-shell-v2'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/index.html']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  const isNavigation = request.mode === 'navigate'
  const isStaticAsset = ['script', 'style', 'image', 'font', 'worker'].includes(request.destination)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (!isNavigation && !isStaticAsset) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) =>
              cache.put(isNavigation ? '/index.html' : request, copy)
            )
          )
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(isNavigation ? '/index.html' : request)
        if (cached) return cached
        throw new Error('The app shell is not available offline')
      })
  )
})
