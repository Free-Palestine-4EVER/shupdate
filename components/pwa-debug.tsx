"use client"

import { useEffect, useState } from "react"

export default function PWADebug() {
  const [debugInfo, setDebugInfo] = useState({
    userAgent: "",
    isIOS: false,
    isStandalone: false,
    matchMedia: false,
    navigatorStandalone: false,
  })

  useEffect(() => {
    // Get debug information
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    const matchMediaStandalone = window.matchMedia("(display-mode: standalone)").matches
    const navigatorStandalone = (window.navigator as any).standalone === true

    setDebugInfo({
      userAgent: navigator.userAgent,
      isIOS,
      isStandalone: matchMediaStandalone || navigatorStandalone,
      matchMedia: matchMediaStandalone,
      navigatorStandalone,
    })

    // Log debug info
    console.log("PWA Debug Info:", {
      userAgent: navigator.userAgent,
      isIOS,
      isStandalone: matchMediaStandalone || navigatorStandalone,
      matchMedia: matchMediaStandalone,
      navigatorStandalone,
    })
  }, [])

  // Hidden component, just for debugging
  return null
}
