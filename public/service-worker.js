// Import OneSignal service worker
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js")

// Service Worker for Shhhh Chat App
const CACHE_NAME = "shhhh-chat-v2"

// Install event - cache assets
self.addEventListener("install", (event) => {
  // Skip the cache addAll operation that's causing errors
  // Instead, we'll cache resources as they're fetched

  // Ensure the new service worker activates immediately
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  // Take control of all clients immediately
  return self.clients.claim()
})

// Fetch event - serve from cache if available, otherwise fetch from network
self.addEventListener("fetch", (event) => {
  // Only cache GET requests
  if (event.request.method !== "GET") return

  // Skip caching for certain URLs
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("firebaseio.com") ||
    event.request.url.includes("googleapis.com") ||
    event.request.url.includes("onesignal.com")
  ) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response
        }

        // Clone the response
        const responseToCache = response.clone()

        caches
          .open(CACHE_NAME)
          .then((cache) => {
            cache.put(event.request, responseToCache)
          })
          .catch((err) => console.error("Cache error:", err))

        return response
      })
      .catch(() => {
        // If fetch fails, try to get from cache
        return caches.match(event.request)
      }),
  )
})

// Note: We don't need to handle push and notificationclick events manually
// as OneSignal will handle these events for us
