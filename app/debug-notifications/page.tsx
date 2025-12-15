"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/components/firebase-provider"
import { AlertCircle, BellRing, RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function DebugNotificationsPage() {
  const [oneSignalStatus, setOneSignalStatus] = useState<any>({})
  const [isLoading, setIsLoading] = useState(false)
  const [testMessage, setTestMessage] = useState("This is a test notification")
  const [userId, setUserId] = useState("")
  const { toast } = useToast()
  const { user } = useAuth()

  useEffect(() => {
    if (user) {
      setUserId(user.uid)
    }
  }, [user])

  useEffect(() => {
    checkOneSignalStatus()
  }, [])

  const checkOneSignalStatus = async () => {
    setIsLoading(true)
    const status: any = {
      oneSignalAvailable: false,
      subscribed: false,
      oneSignalUserId: null,
      externalUserId: null,
      permission: null,
      serviceWorkerStatus: null,
    }

    try {
      // Check if OneSignal is available
      if (typeof window !== "undefined" && window.OneSignal) {
        status.oneSignalAvailable = true

        // Check subscription status
        await new Promise<void>((resolve) => {
          window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
            status.subscribed = isEnabled
            resolve()
          })
        })

        // Get OneSignal User ID
        if (status.subscribed) {
          await new Promise<void>((resolve) => {
            window.OneSignal.getUserId((userId: string) => {
              status.oneSignalUserId = userId
              resolve()
            })
          })

          // Get external user ID
          await new Promise<void>((resolve) => {
            window.OneSignal.getExternalUserId((externalUserId: string) => {
              status.externalUserId = externalUserId
              resolve()
            })
          })
        }

        // Check notification permission
        status.permission = Notification.permission
      }

      // Check service worker status
      if (navigator.serviceWorker) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        status.serviceWorkerStatus = {
          registered: registrations.length > 0,
          count: registrations.length,
          scopes: registrations.map((reg) => reg.scope),
        }
      } else {
        status.serviceWorkerStatus = {
          registered: false,
          error: "Service Worker API not available",
        }
      }
    } catch (error) {
      console.error("Error checking OneSignal status:", error)
      status.error = String(error)
    }

    setOneSignalStatus(status)
    setIsLoading(false)
  }

  const sendTestNotification = async () => {
    if (!userId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a user ID",
      })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch("/api/send-onesignal-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          title: "Test Notification",
          message: testMessage,
          url: window.location.origin,
        }),
      })

      const data = await response.json()
      console.log("Test notification response:", data)

      if (data.success) {
        toast({
          title: "Test notification sent",
          description: "Check your device for the notification",
        })
      } else if (data.warning === "User not subscribed to notifications") {
        toast({
          variant: "destructive",
          title: "User not subscribed",
          description: "The user is not subscribed to notifications",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to send test notification",
        })
      }
    } catch (error) {
      console.error("Error sending test notification:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: String(error),
      })
    } finally {
      setIsLoading(false)
    }
  }

  const promptForPermission = () => {
    if (window.OneSignal) {
      window.OneSignal.showSlidedownPrompt()
    } else {
      Notification.requestPermission().then((permission) => {
        toast({
          title: "Permission result",
          description: `Notification permission: ${permission}`,
        })
        checkOneSignalStatus()
      })
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Notification Debug</h1>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>OneSignal Status</CardTitle>
            <CardDescription>Current status of OneSignal integration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="font-medium">OneSignal Available:</div>
                <div>{oneSignalStatus.oneSignalAvailable ? "Yes" : "No"}</div>

                <div className="font-medium">Subscribed:</div>
                <div>{oneSignalStatus.subscribed ? "Yes" : "No"}</div>

                <div className="font-medium">OneSignal User ID:</div>
                <div>{oneSignalStatus.oneSignalUserId || "Not available"}</div>

                <div className="font-medium">External User ID:</div>
                <div>{oneSignalStatus.externalUserId || "Not set"}</div>

                <div className="font-medium">Notification Permission:</div>
                <div>{oneSignalStatus.permission || "Not checked"}</div>

                <div className="font-medium">Service Worker Status:</div>
                <div>
                  {oneSignalStatus.serviceWorkerStatus
                    ? oneSignalStatus.serviceWorkerStatus.registered
                      ? `Registered (${oneSignalStatus.serviceWorkerStatus.count} workers)`
                      : "Not registered"
                    : "Unknown"}
                </div>
              </div>

              {oneSignalStatus.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{oneSignalStatus.error}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={checkOneSignalStatus} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                "Refresh Status"
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Notification</CardTitle>
            <CardDescription>Send a test notification to a user</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Enter user ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Input
                  id="message"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  placeholder="Enter test message"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={promptForPermission}>
              <BellRing className="mr-2 h-4 w-4" />
              Request Permission
            </Button>
            <Button onClick={sendTestNotification} disabled={isLoading}>
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Test Notification"
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
