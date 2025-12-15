"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function TestNotificationsPage() {
  const [title, setTitle] = useState("Test Notification")
  const [message, setMessage] = useState("This is a test notification")
  const [status, setStatus] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const checkPermission = async () => {
    setStatus("Checking notification permission...")

    if (!("Notification" in window)) {
      setStatus("This browser does not support notifications")
      return
    }

    const permission = await Notification.requestPermission()
    setStatus(`Notification permission: ${permission}`)
  }

  const checkPushpad = () => {
    setStatus("Checking Pushpad status...")

    if (window.pushpad) {
      window.pushpad("status", (isSubscribed: boolean) => {
        setStatus(`Pushpad subscription status: ${isSubscribed ? "Subscribed" : "Not subscribed"}`)
      })
    } else {
      setStatus("Pushpad is not available")
    }
  }

  const subscribeToPushpad = () => {
    setStatus("Attempting to subscribe to Pushpad...")

    if (window.subscribeToPushpad) {
      window.subscribeToPushpad()
      setTimeout(() => {
        checkPushpad()
      }, 2000)
    } else {
      setStatus("subscribeToPushpad function not available")
    }
  }

  const sendTestNotification = async () => {
    setIsLoading(true)
    setStatus("Sending test notification...")

    try {
      // First try to show a local notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body: message,
          icon: "/android-chrome-192x192.png",
        })
        setStatus("Local notification sent")
      } else {
        setStatus("Cannot send local notification - permission not granted")
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Error sending notification:", error)
      setStatus(`Error: ${error.message}`)
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Test Notifications</CardTitle>
          <CardDescription>Use this page to test if notifications are working correctly</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Notification Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter notification title" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notification Message</label>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter notification message"
            />
          </div>

          <div className="pt-2 space-y-2">
            <Button onClick={checkPermission} variant="outline" className="w-full">
              Check Notification Permission
            </Button>

            <Button onClick={checkPushpad} variant="outline" className="w-full">
              Check Pushpad Status
            </Button>

            <Button onClick={subscribeToPushpad} variant="outline" className="w-full">
              Subscribe to Pushpad
            </Button>

            <Button onClick={sendTestNotification} disabled={isLoading} className="w-full">
              {isLoading ? "Sending..." : "Send Test Notification"}
            </Button>
          </div>

          {status && (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
              <p className="text-sm">{status}</p>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <p className="text-xs text-gray-500">Note: You must allow notifications in your browser settings</p>
        </CardFooter>
      </Card>
    </div>
  )
}
