import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"

// OneSignal REST API endpoint
const ONE_SIGNAL_API_URL = "https://onesignal.com/api/v1/notifications"
const ONE_SIGNAL_APP_ID = "bf14367a-a8d6-4248-bd86-d074a56514af"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { userId, title, message, url, icon, data } = body

    console.log("Message notification request received:", {
      userId,
      title,
      message: message?.substring(0, 30) + (message?.length > 30 ? "..." : ""),
    })

    if (!userId || !title || !message) {
      console.error("Missing required fields in message notification request")
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify the user exists
    try {
      const userRef = ref(db, `users/${userId}`)
      const userSnapshot = await get(userRef)

      if (!userSnapshot.exists()) {
        console.error(`User not found: ${userId}`)
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
    } catch (error) {
      console.error("Error verifying user:", error)
      // Continue with notification even if user verification fails
    }

    // Prepare OneSignal notification payload
    const oneSignalPayload = {
      app_id: ONE_SIGNAL_APP_ID,
      include_external_user_ids: [userId],
      headings: { en: title },
      contents: { en: message },
      url: url || `https://www.shhhhh.chat`,
      chrome_web_icon: icon || "https://www.shhhhh.chat/logo.png", // Always use Shhhhh Chat icon
      firefox_icon: "https://www.shhhhh.chat/logo.png",
      chrome_web_image: "https://www.shhhhh.chat/logo.png",
      data: data || {},
      // Override app name for notifications
      name: "Shhhhh Chat", // Set app name to Shhhhh Chat for notifications
      // Add buttons to allow quick actions
      web_buttons: [
        {
          id: "view",
          text: "View",
          url: url || `https://www.shhhhh.chat`,
        },
      ],
      // Make notification more prominent
      priority: 10,
      ttl: 259200, // 3 days in seconds
    }

    console.log("Sending OneSignal notification payload:", JSON.stringify(oneSignalPayload))

    // Check if we have the API key
    if (!process.env.ONESIGNAL_REST_API_KEY) {
      console.error("OneSignal API key is missing")
      return NextResponse.json({ error: "OneSignal API key is missing" }, { status: 500 })
    }

    // Send notification via OneSignal REST API
    const response = await fetch(ONE_SIGNAL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(oneSignalPayload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("OneSignal API error:", errorData)
      return NextResponse.json(
        { error: "Failed to send OneSignal notification", details: errorData },
        { status: response.status },
      )
    }

    const responseData = await response.json()
    console.log("OneSignal notification sent successfully:", responseData)
    return NextResponse.json({ success: true, data: responseData })
  } catch (error) {
    console.error("Error sending message notification:", error)
    return NextResponse.json({ error: "Failed to send message notification", details: String(error) }, { status: 500 })
  }
}
