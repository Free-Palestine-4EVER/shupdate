// Import the OneSignal service worker script
importScripts("https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js")

// Intercept ALL push events to customize notifications
self.addEventListener("push", (event) => {
  // Stop the default OneSignal notification
  event.stopImmediatePropagation()

  if (event.data) {
    let data
    try {
      data = event.data.json()
    } catch (e) {
      data = {
        title: "Shhhhh Chat",
        message: "You have a new message",
      }
    }

    // Extract content from OneSignal format if available
    const title = "Shhhhh Chat"
    let message = "You have a new message"
    let url = "/"
    const icon = "https://www.shhhhh.chat/logo.png"

    if (data.custom && data.custom.data) {
      message = data.notification?.body || message
      url = data.custom.data.url || url
    } else if (data.message) {
      message = data.message
    }

    // Always show our custom notification
    event.waitUntil(
      self.registration.showNotification(title, {
        body: message,
        icon: icon,
        badge: icon,
        data: {
          url: url,
        },
      }),
    )
  }
})

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked:", event)

  // Close the notification
  event.notification.close()

  // Extract the URL from the notification data
  let url = "/"
  if (event.notification.data && event.notification.data.url) {
    url = event.notification.data.url
  }

  // Focus on existing tab or open new one
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i]
        if (client.url === url && "focus" in client) {
          return client.focus()
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    }),
  )
})

// Add custom event listeners for iOS PWA
self.addEventListener("install", (event) => {
  console.log("Custom Service Worker installed")
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  console.log("Custom Service Worker activated")
  event.waitUntil(self.clients.claim())
})
