// Helper functions for OneSignal

// Send a notification to a specific user
export async function sendNotificationToUser(
  userId: string,
  title: string,
  message: string,
  url = "/",
  data: any = {},
) {
  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: "bf14367a-a8d6-4248-bd86-d074a56514af",
        include_external_user_ids: [userId],
        contents: { en: message },
        headings: { en: title },
        url,
        data,
      }),
    })

    const result = await response.json()
    console.log("OneSignal notification sent:", result)
    return result
  } catch (error) {
    console.error("Error sending OneSignal notification:", error)
    throw error
  }
}

// Send a notification to all subscribed users
export async function sendNotificationToAll(title: string, message: string, url = "/", data: any = {}) {
  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: "bf14367a-a8d6-4248-bd86-d074a56514af",
        included_segments: ["Subscribed Users"],
        contents: { en: message },
        headings: { en: title },
        url,
        data,
      }),
    })

    const result = await response.json()
    console.log("OneSignal notification sent to all:", result)
    return result
  } catch (error) {
    console.error("Error sending OneSignal notification to all:", error)
    throw error
  }
}
