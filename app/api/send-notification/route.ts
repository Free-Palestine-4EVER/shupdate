import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"
import { sendPushpadNotification } from "@/lib/pushpad"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      token,
      title,
      body: messageBody,
      icon,
      clickAction,
      chatId,
      imageUrl,
      userId, // Target user ID for Pushpad
    } = body

    if (!title || !messageBody) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify the chat exists if chatId is provided
    if (chatId) {
      const chatRef = ref(db, `chats/${chatId}`)
      const chatSnapshot = await get(chatRef)

      if (!chatSnapshot.exists()) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 })
      }
    }

    // If userId is provided, send notification via Pushpad
    if (userId) {
      try {
        await sendPushpadNotification({
          title,
          body: messageBody,
          targetUsers: [userId],
          iconUrl: icon || "https://www.shhhhh.chat/icons/icon-192x192.png",
          imageUrl: imageUrl,
          url: clickAction || `https://www.shhhhh.chat${chatId ? `/?chat=${chatId}` : ""}`,
          chatId,
          requireInteraction: true,
        })

        return NextResponse.json({ success: true, provider: "pushpad" })
      } catch (pushpadError) {
        console.error("Error sending Pushpad notification:", pushpadError)
        // Fall back to FCM if Pushpad fails
      }
    }

    // If no userId or Pushpad fails, use the existing FCM implementation
    if (token) {
      // Prepare notification payload
      const message = {
        notification: {
          title,
          body: messageBody,
          icon: icon || "/icons/icon-192x192.png",
          click_action: clickAction || "/",
          image: imageUrl || undefined,
        },
        webpush: {
          fcm_options: {
            link: clickAction || "/",
          },
          notification: {
            icon: icon || "/icons/icon-192x192.png",
            badge: "/icons/icon-72x72.png",
            vibrate: [100, 50, 100],
            actions: [
              {
                action: "view",
                title: "View",
              },
            ],
            data: {
              chatId,
            },
          },
        },
        token,
      }

      // In a real implementation, you would use Firebase Admin SDK to send the notification
      // For this example, we'll simulate a successful response
      console.log("Would send notification:", message)

      return NextResponse.json({ success: true, provider: "fcm" })
    }

    return NextResponse.json({ error: "No valid notification method available" }, { status: 400 })
  } catch (error) {
    console.error("Error sending notification:", error)
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 })
  }
}
