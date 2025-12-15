"use client"

import { useEffect, useRef, useState } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { useToast } from "@/hooks/use-toast"

export default function OneSignalInitializer() {
  const { user } = useFirebase()
  const initialized = useRef(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Only initialize if user is logged in and not already initialized
    if (user && !initialized.current && window.OneSignal) {
      console.log("Initializing OneSignal for logged-in user:", user.uid)
      initialized.current = true

      const style = document.createElement("style")
      style.innerHTML = `
        /* Ensure OneSignal prompt is on top of all other elements */
        .onesignal-slidedown-container {
          z-index: 2147483647 !important;
          position: fixed !important;
          top: 0 !important;
          pointer-events: auto !important;
        }
        #onesignal-slidedown-dialog {
          z-index: 2147483647 !important;
          pointer-events: auto !important;
        }
        .onesignal-slidedown-dialog-backdrop {
          z-index: 2147483646 !important;
        }
        .onesignal-slidedown-button {
          position: relative !important;
          z-index: 2147483647 !important;
          pointer-events: auto !important;
        }
        .onesignal-slidedown-container *, 
        #onesignal-slidedown-dialog *,
        .onesignal-slidedown-button {
          pointer-events: auto !important;
        }
      `
      document.head.appendChild(style)

      window.OneSignal.push(() => {
        window.OneSignal.init({
          appId: "bf14367a-a8d6-4248-bd86-d074a56514af",
          safari_web_id: "web.onesignal.auto.0c986762-3fda-40b6-9b49-8bb3a17e3d8e",
          notifyButton: {
            enable: false,
          },
          allowLocalhostAsSecureOrigin: true,
          notificationClickHandlerMatch: "origin",
          notificationClickHandlerAction: "focus",
          promptOptions: {
            slidedown: {
              enabled: true,
              autoPrompt: false,
              timeDelay: 0,
              pageViews: 0,
              customizeTextEnabled: true,
              actionMessage: "Subscribe to Shhhhh Chat notifications for the latest updates.",
              acceptButtonText: "Subscribe",
              cancelButtonText: "Later",
            },
          },
          androidChannelId: "shhhhh-chat-channel",
          androidChannelName: "Shhhhh Chat",
          androidChannelDescription: "Notifications from Shhhhh Chat",
        })

        window.OneSignal.push(() => {
          window.OneSignal.setDefaultTitle("Shhhhh Chat")

          if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then((registration) => {
              console.log("Attempting to override notification display")
              registration.active?.postMessage({
                command: "setNotificationSettings",
                options: {
                  applicationName: "Shhhhh Chat",
                  applicationIcon: "https://www.shhhhh.chat/logo.png",
                },
              })
            })
          }
        })

        if (window.OneSignal.createNotificationChannel) {
          window.OneSignal.createNotificationChannel({
            id: "shhhhh-chat-channel",
            name: "Shhhhh Chat",
            description: "Notifications from Shhhhh Chat",
            importance: 4,
            vibration: true,
            sound: "default",
          })
        }

        window.OneSignal.setDefaultNotificationUrl("https://www.shhhhh.chat")
        window.OneSignal.setDefaultTitle("Shhhhh Chat")

        window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
          console.log("OneSignal Push Notifications are enabled:", isEnabled)
        })

        window.OneSignal.on("subscriptionChange", (isSubscribed: boolean) => {
          console.log("OneSignal subscription changed:", isSubscribed)

          if (isSubscribed) {
            window.OneSignal.getUserId((userId: string) => {
              console.log("OneSignal User ID:", userId)

              if (user && user.uid) {
                console.log("Setting external user ID:", user.uid)
                window.OneSignal.setExternalUserId(user.uid)
              }
            })
          }
        })

        if (user && user.uid) {
          window.OneSignal.setExternalUserId(user.uid)
        }

        setIsInitialized(true)

        setTimeout(() => {
          console.log("Showing OneSignal notification prompt")
          window.OneSignal.showSlidedownPrompt()
        }, 2000)
      })
    } else if (!window.OneSignal && user) {
      const checkInterval = setInterval(() => {
        if (window.OneSignal) {
          clearInterval(checkInterval)
          initialized.current = false
          console.log("OneSignal is now available, initializing...")
          setIsInitialized(false)
        }
      }, 1000)

      setTimeout(() => {
        clearInterval(checkInterval)
        if (!window.OneSignal) {
          console.error("OneSignal failed to load after 15 seconds")
          toast({
            title: "Notification Error",
            description: "Could not initialize notification system. Please refresh the page.",
            variant: "destructive",
          })
        }
      }, 15000)

      return () => clearInterval(checkInterval)
    }

    return () => {}
  }, [user, isInitialized, toast])

  return null
}
