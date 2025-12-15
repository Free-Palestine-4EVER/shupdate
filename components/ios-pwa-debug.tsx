"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/firebase-provider"

export default function IOSPWADebug() {
  const [isIOSPWA, setIsIOSPWA] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState("")
  const [oneSignalStatus, setOneSignalStatus] = useState("")
  const [oneSignalUserId, setOneSignalUserId] = useState("")
  const [externalUserId, setExternalUserId] = useState("")
  const { user } = useAuth()

  useEffect(() => {
    // Check if running as iOS PWA
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    setIsIOSPWA(isIOS && isStandalone)

    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
    }

    // Check OneSignal status
    if (window.OneSignal) {
      window.OneSignal.push(() => {
        window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
          setOneSignalStatus(isEnabled ? "Enabled" : "Disabled")

          if (isEnabled) {
            window.OneSignal.getUserId((userId: string) => {
              setOneSignalUserId(userId)
            })

            window.OneSignal.getExternalUserId((userId: string) => {
              setExternalUserId(userId)
            })
          }
        })
      })
    }
  }, [])

  const requestPermission = () => {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setNotificationPermission(permission)
      })
    }
  }

  const registerOneSignal = () => {
    if (window.OneSignal) {
      window.OneSignal.push(() => {
        window.OneSignal.registerForPushNotifications()

        setTimeout(() => {
          window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
            setOneSignalStatus(isEnabled ? "Enabled" : "Disabled")

            if (isEnabled) {
              window.OneSignal.getUserId((userId: string) => {
                setOneSignalUserId(userId)
              })
            }
          })
        }, 2000)
      })
    }
  }

  const setExternalId = () => {
    if (window.OneSignal && user) {
      window.OneSignal.push(() => {
        window.OneSignal.setExternalUserId(user.uid)

        setTimeout(() => {
          window.OneSignal.getExternalUserId((userId: string) => {
            setExternalUserId(userId)
          })
        }, 1000)
      })
    }
  }

  if (!isIOSPWA) return null

  // Return the component with hidden UI
  return (
    <div className="hidden">
      <div className="font-bold">iOS PWA Debug</div>
      <div>Notification Permission: {notificationPermission}</div>
      <div>OneSignal Status: {oneSignalStatus}</div>
      <div>OneSignal User ID: {oneSignalUserId || "None"}</div>
      <div>External User ID: {externalUserId || "None"}</div>
      <div className="flex gap-1 mt-1">
        <Button size="sm" variant="outline" onClick={requestPermission} className="text-xs h-6">
          Request Permission
        </Button>
        <Button size="sm" variant="outline" onClick={registerOneSignal} className="text-xs h-6">
          Register OneSignal
        </Button>
        <Button size="sm" variant="outline" onClick={setExternalId} className="text-xs h-6">
          Set External ID
        </Button>
      </div>
    </div>
  )
}
