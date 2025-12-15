"use client"

import { useEffect, useRef } from "react"
import { db } from "@/lib/firebase"
import { ref, onDisconnect, set, serverTimestamp } from "firebase/database"

interface OnlinePresenceProps {
  userId: string
}

export default function OnlinePresence({ userId }: OnlinePresenceProps) {
  const isSetupComplete = useRef(false)

  useEffect(() => {
    if (!userId || !db || isSetupComplete.current) return

    try {
      // Set up presence system
      const userStatusRef = ref(db, `status/${userId}`)
      const userPresenceRef = ref(db, `presence/${userId}`)

      // When this device disconnects, update the status to offline
      onDisconnect(userStatusRef).set({
        state: "offline",
        lastChanged: serverTimestamp(),
      })

      onDisconnect(userPresenceRef).set({
        online: false,
        lastSeen: serverTimestamp(),
      })

      // Set the status to online
      set(userStatusRef, {
        state: "online",
        lastChanged: serverTimestamp(),
      })

      set(userPresenceRef, {
        online: true,
        lastSeen: serverTimestamp(),
      })

      isSetupComplete.current = true
    } catch (error) {
      console.error("Error setting up presence:", error)
    }

    return () => {
      // No need to clean up as onDisconnect handles it
    }
  }, [userId])

  // Return null - no visible UI
  return null
}
