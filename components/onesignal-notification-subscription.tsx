"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BellRing, BellOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/firebase-provider"
import { ref, set } from "firebase/database"
import { db } from "@/lib/firebase"

// Declare global OneSignal type
declare global {
  interface Window {
    OneSignal: any
  }
}

export default function OneSignalNotificationSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isOneSignalReady, setIsOneSignalReady] = useState(false)
  const [isIOSPWA, setIsIOSPWA] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

  // Check if running as iOS PWA
  useEffect(() => {
    const checkIOSPWA = () => {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      const isPWA = isIOS && isStandalone
      setIsIOSPWA(isPWA)
      console.log("Is iOS PWA:", isPWA)
    }

    checkIOSPWA()
  }, [])

  // Check if OneSignal is ready
  useEffect(() => {
    if (!user) return // Don't initialize if user is not logged in

    const checkOneSignalStatus = () => {
      if (window.OneSignal) {
        console.log("OneSignal is available in subscription component")
        setIsOneSignalReady(true)

        // Check subscription status
        window.OneSignal.push(() => {
          window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
            console.log("OneSignal subscription status:", isEnabled)
            setIsSubscribed(isEnabled)

            // If subscribed, mark notifications as allowed
            if (isEnabled) {
              localStorage.setItem("notifications_allowed", "true")

              // Update user record in database
              if (user) {
                const userRef = ref(db, `users/${user.uid}/notificationsAllowed`)
                set(userRef, true)
              }

              window.OneSignal.getUserId((userId: string) => {
                console.log("OneSignal User ID:", userId)

                // Set external user ID if Firebase user is available
                if (user) {
                  console.log("Setting OneSignal external user ID:", user.uid)
                  window.OneSignal.setExternalUserId(user.uid)
                }
              })
            }
          })
        })

        // Set external user ID if available
        if (user) {
          window.OneSignal.push(() => {
            console.log("Setting OneSignal external user ID:", user.uid)
            window.OneSignal.setExternalUserId(user.uid)
          })
        }
      } else {
        console.log("OneSignal not available yet in subscription component, checking again in 1 second")
        setTimeout(checkOneSignalStatus, 1000)
      }
    }

    // Initialize OneSignal check
    setTimeout(checkOneSignalStatus, 2000)

    // Set up subscription change listener
    if (window.OneSignal) {
      window.OneSignal.push(() => {
        window.OneSignal.on("subscriptionChange", (isSubscribed: boolean) => {
          console.log("Subscription changed:", isSubscribed)
          setIsSubscribed(isSubscribed)

          if (isSubscribed) {
            // Mark notifications as allowed
            localStorage.setItem("notifications_allowed", "true")

            // Update user record in database
            if (user) {
              const userRef = ref(db, `users/${user.uid}/notificationsAllowed`)
              set(userRef, true)
            }

            if (user) {
              window.OneSignal.getUserId((userId: string) => {
                console.log("OneSignal User ID after subscription change:", userId)
                window.OneSignal.setExternalUserId(user.uid)
              })
            }
          }
        })
      })
    }
  }, [user])

  // Update external user ID when user changes
  useEffect(() => {
    if (user && isSubscribed && window.OneSignal) {
      window.OneSignal.push(() => {
        console.log("Updating external user ID for user:", user.uid)
        window.OneSignal.setExternalUserId(user.uid)
      })
    }
  }, [user, isSubscribed])

  const subscribeUser = async () => {
    setIsLoading(true)
    console.log("Subscribe button clicked")

    try {
      if (window.OneSignal) {
        window.OneSignal.push(() => {
          // Special handling for iOS PWA
          if (isIOSPWA) {
            console.log("Using iOS PWA specific subscription flow")

            // For iOS PWA, we need to show the slidedown prompt
            window.OneSignal.showSlidedownPrompt()

            // iOS PWA requires explicit permission request
            Notification.requestPermission().then((permission) => {
              console.log("iOS PWA Notification permission:", permission)

              if (permission === "granted") {
                // Force registration for iOS PWA
                window.OneSignal.registerForPushNotifications({
                  modalPrompt: false,
                  httpPermissionRequest: true,
                })

                // Mark notifications as allowed
                localStorage.setItem("notifications_allowed", "true")

                // Update user record in database
                if (user) {
                  const userRef = ref(db, `users/${user.uid}/notificationsAllowed`)
                  set(userRef, true)
                }
              }
            })
          } else {
            // Standard flow for other platforms
            console.log("Showing OneSignal slidedown prompt")
            window.OneSignal.showSlidedownPrompt()

            // Also register for push notifications
            window.OneSignal.registerForPushNotifications()
          }

          // Check if subscribed after a short delay
          setTimeout(() => {
            window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
              setIsSubscribed(isEnabled)

              if (isEnabled) {
                // Mark notifications as allowed
                localStorage.setItem("notifications_allowed", "true")

                // Update user record in database
                if (user) {
                  const userRef = ref(db, `users/${user.uid}/notificationsAllowed`)
                  set(userRef, true)
                }

                // Get OneSignal User ID
                window.OneSignal.getUserId((userId: string) => {
                  console.log("OneSignal User ID after subscription:", userId)

                  // Set external user ID if Firebase user is available
                  if (user) {
                    console.log("Setting OneSignal external user ID after subscription:", user.uid)
                    window.OneSignal.setExternalUserId(user.uid)
                  }
                })

                toast({
                  title: "Notifications enabled",
                  description: "You'll now receive notifications for new messages.",
                })
              } else {
                toast({
                  variant: "destructive",
                  title: "Notifications not enabled",
                  description: "Please allow notifications in your browser settings.",
                })
              }

              setIsLoading(false)
              setIsDialogOpen(false)
            })
          }, 3000)
        })
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Notification system not initialized. Please refresh the page and try again.",
        })
        setIsLoading(false)
        setIsDialogOpen(false)
      }
    } catch (error) {
      console.error("Failed to subscribe:", error)
      toast({
        variant: "destructive",
        title: "Subscription failed",
        description: "Could not enable notifications. Please check your browser settings.",
      })
      setIsLoading(false)
      setIsDialogOpen(false)
    }
  }

  const unsubscribeUser = async () => {
    setIsLoading(true)

    try {
      if (window.OneSignal) {
        window.OneSignal.push(() => {
          window.OneSignal.setSubscription(false)

          // Check if unsubscribed after a short delay
          setTimeout(() => {
            window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
              setIsSubscribed(isEnabled)

              if (!isEnabled) {
                // Remove notifications allowed flag
                localStorage.removeItem("notifications_allowed")

                // Update user record in database
                if (user) {
                  const userRef = ref(db, `users/${user.uid}/notificationsAllowed`)
                  set(userRef, false)
                }

                toast({
                  title: "Notifications disabled",
                  description: "You won't receive notifications anymore.",
                })
              }

              setIsLoading(false)
            })
          }, 1000)
        })
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Notification system not initialized. Please refresh the page and try again.",
        })
        setIsLoading(false)
      }
    } catch (error) {
      console.error("Error unsubscribing:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not disable notifications. Please try again.",
      })
      setIsLoading(false)
    }
  }

  // Don't render anything if user is not logged in
  if (!user) return null

  return (
    <>
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={() => {
          console.log("Notification button clicked, isSubscribed:", isSubscribed)
          isSubscribed ? unsubscribeUser() : setIsDialogOpen(true)
        }}
        disabled={isLoading || !isOneSignalReady}
        className="flex items-center gap-1"
      >
        {isSubscribed ? (
          <>
            <BellOff className="h-4 w-4" />
            <span>Disable Notifications</span>
          </>
        ) : (
          <>
            <BellRing className="h-4 w-4" />
            <span>Always Allow Notification</span>
          </>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Notifications</DialogTitle>
            <DialogDescription>
              Get notified when you receive new messages, even when you're not using the app.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-4">
              <BellRing className="h-10 w-10 text-primary" />
              <div>
                <p className="font-medium">Stay connected</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Never miss important messages from your contacts.
                </p>
              </div>
            </div>

            {isIOSPWA && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md flex items-start gap-2">
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">iOS PWA Detected</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    After allowing notifications, you may need to restart the app for notifications to work properly.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="text-black dark:text-white">
              Cancel
            </Button>
            <Button onClick={subscribeUser} disabled={isLoading} className="text-black">
              {isLoading ? "Enabling..." : "Enable Notifications"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
