import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, message, userId, url, data } = body

    if (!title || !message) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const payload = {
      app_id: "bf14367a-a8d6-4248-bd86-d074a56514af",
      headings: { en: title },
      contents: { en: message },
      url: url || "https://www.shhhhh.chat",
      chrome_web_icon: "https://www.shhhhh.chat/logo.png", // Always use Shhhhh Chat icon
      firefox_icon: "https://www.shhhhh.chat/logo.png",
      chrome_web_image: "https://www.shhhhh.chat/logo.png",
      // These are the correct parameters to override the app name in notifications
      android_channel_id: "shhhhh-chat-channel",
      android_group: "shhhhh-chat",
      android_group_message: { en: "New messages from Shhhhh Chat" },
      existing_android_channel_id: "shhhhh-chat-channel",
      android_accent_color: "FF00FF00",
      // For iOS
      ios_badgeType: "Increase",
      ios_badgeCount: 1,
      // Custom data to identify this as a Shhhhh Chat notification
      data: {
        ...(data || {}),
        appName: "Shhhhh Chat",
        notificationSource: "shhhhh-chat",
      },
    }

    // If userId is provided, target the notification to that user
    if (userId) {
      payload["include_external_user_ids"] = [userId]
    } else {
      payload["included_segments"] = ["Subscribed Users"]
    }

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json(
        { error: "Failed to send notification", details: errorData },
        { status: response.status },
      )
    }

    const result = await response.json()
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error("Error sending notification:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
