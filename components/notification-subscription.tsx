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

// Declare global functions
declare global {
  interface Window {
    pushpad: any
    requestNotificationPermission: () => Promise<boolean>
    subscribeToPushpad: () => void
    swRegistration: ServiceWorkerRegistration
  }
}

export default function NotificationSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isPushpadReady, setIsPushpadReady] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()

  // Check if Pushpad is ready
  useEffect(() => {
    const checkPushpadStatus = () => {
      if (window.pushpad) {
        console.log("Pushpad is available")
        setIsPushpadReady(true)

        // Check subscription status
        window.pushpad("status", (isSubscribed: boolean) => {
          console.log("Pushpad subscription status:", isSubscribed)
          setIsSubscribed(isSubscribed)
        })

        // Set user ID if available
        if (user) {
          console.log("Setting Pushpad UID:", user.uid || user.id)
          window.pushpad("uid", user.uid || user.id)
        }
      } else {
        console.log("Pushpad not available yet, checking again in 1 second")
        setTimeout(checkPushpadStatus, 1000)
      }
    }

    checkPushpadStatus()
  }, [user])

  const subscribeUser = async () => {
    setIsLoading(true)
    console.log("Subscribe button clicked")

    try {
      if (window.subscribeToPushpad) {
        window.subscribeToPushpad()

        // Check subscription status after a delay
        setTimeout(() => {
          if (window.pushpad) {
            window.pushpad("status", (isSubscribed: boolean) => {
              setIsSubscribed(isSubscribed)
              setIsLoading(false)
              setIsDialogOpen(false)
            })
          } else {
            setIsLoading(false)
            setIsDialogOpen(false)
          }
        }, 2000)
      } else {
        console.error("subscribeToPushpad function not available")
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
      if (window.pushpad) {
        window.pushpad("unsubscribe", () => {
          setIsSubscribed(false)
          toast({
            title: "Notifications disabled",
            description: "You won't receive notifications anymore.",
          })
          setIsLoading(false)
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

  return (
    <>
      <Button
        variant={isSubscribed ? "outline" : "default"}
        size="sm"
        onClick={() => {
          console.log("Notification button clicked, isSubscribed:", isSubscribed)
          isSubscribed ? unsubscribeUser() : setIsDialogOpen(true)
        }}
        disabled={isLoading || !isPushpadReady}
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
            <span>Enable Notifications</span>
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
