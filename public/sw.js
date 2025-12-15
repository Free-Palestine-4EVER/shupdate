// Import Pushpad service worker
importScripts("https://pushpad.xyz/service-worker.js")

// Keep existing service worker functionality
self.addEventListener("install", (event) => {
  console.log("Service Worker installed")
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated")
  return self.clients.claim()
})

// Handle push notifications
self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json()
    const options = {
      body: data.body,
      icon: data.icon || "/icon.png",
      badge: "/badge.png",
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: "2",
        chatId: data.chatId,
      },
    }
    event.waitUntil(self.registration.showNotification(data.title, options))
  }
})

self.addEventListener("notificationclick", (event) => {
  console.log("Notification click received.")
  event.notification.close()

  // Get the chat ID from the notification data
  const chatId = event.notification.data?.chatId
  const urlToOpen = chatId ? `https://www.shhhhh.chat/?chat=${chatId}` : "https://www.shhhhh.chat"

  event.waitUntil(clients.openWindow(urlToOpen))
})
