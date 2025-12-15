import { NextResponse } from "next/server"
import crypto from "crypto"

// Pushpad notification sending function
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const { title, body, userId, chatId, senderId } = data

    if (!title || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Pushpad project ID and auth token
    const projectId = 8920
    const authToken = "cLieW18bqphPKqNURKKtrSGSNmyNZmacSKpiNTTE"

    // Create notification payload
    const notificationPayload = {
      body: body,
      title: title,
      target_url: `https://www.shhhhh.chat/?chat=${chatId}`,
      icon_url: "https://www.shhhhh.chat/logo.png",
      image_url: null,
      ttl: 604800, // 1 week in seconds
      require_interaction: true,
      silent: false,
      urgent: true,
      data: {
        chatId: chatId,
        senderId: senderId,
      },
    }

    // If userId is provided, target the notification to that user
    const endpoint = userId
      ? `https://pushpad.xyz/projects/${projectId}/notifications`
      : `https://pushpad.xyz/projects/${projectId}/broadcasts`

    // Generate signature if targeting a specific user
    let signature = null
    if (userId) {
      const hmac = crypto.createHmac("sha1", authToken)
      hmac.update(userId)
      signature = hmac.digest("hex")

      // Add uid to payload
      notificationPayload["uids"] = [userId]
    }

    // Send notification via Pushpad API
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token token="${authToken}"`,
      },
      body: JSON.stringify({
        notification: notificationPayload,
        signature: signature,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Pushpad API error:", errorText)
      return NextResponse.json(
        { error: "Failed to send notification", details: errorText },
        { status: response.status },
      )
    }

    const result = await response.json()
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Error sending notification:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
