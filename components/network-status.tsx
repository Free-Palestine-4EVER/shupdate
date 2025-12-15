"use client"

import { useState, useEffect } from "react"

interface NetworkStatusProps {
  user?: any
}

export default function NetworkStatus({ user }: NetworkStatusProps) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    // Set initial state
    setIsOnline(navigator.onLine)

    // Add event listeners
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Clean up
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return (
    <span className={`text-xs ${isOnline ? "text-green-500" : "text-red-500"}`}>
      {/* Removed "Online" text and spacing */}
    </span>
  )
}
