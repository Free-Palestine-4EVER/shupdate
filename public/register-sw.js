// Register service worker for PWA functionality
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Check if running as iOS PWA
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    const isIOSPWA = isIOS && isStandalone

    if (isIOSPWA) {
      console.log("iOS PWA detected - special service worker handling")

      // For iOS PWA, we need to register both service workers
      navigator.serviceWorker
        .register("/OneSignalSDKWorker.js", { scope: "/" })
        .then((registration) => {
          console.log("iOS PWA: OneSignal Service Worker registered with scope:", registration.scope)
        })
        .catch((error) => {
          console.error("iOS PWA: OneSignal Service Worker registration failed:", error)
        })

      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("iOS PWA: App Service Worker registered with scope:", registration.scope)
        })
        .catch((error) => {
          console.error("iOS PWA: App Service Worker registration failed:", error)
        })
    } else {
      // Standard service worker registration for other platforms
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered with scope:", registration.scope)
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error)
        })
    }
  })
}

// Check notification permission
if ("Notification" in window) {
  console.log("Current notification permission:", Notification.permission)
}
