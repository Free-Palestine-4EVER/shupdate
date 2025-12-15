// Helper functions for OneSignal

/**
 * Formats a message preview for notifications
 * @param message The full message text
 * @param maxLength Maximum length of the preview
 * @returns Formatted message preview
 */
export function formatMessagePreview(message: string | null, maxLength = 50): string {
  if (!message) return "Sent you a message"

  // For media messages that might have placeholder text
  if (message === "Sent an image") return "Sent you an image"
  if (message === "Sent a video") return "Sent you a video"
  if (message === "Sent a voice message") return "Sent you a voice message"

  // Truncate long messages
  if (message.length > maxLength) {
    return message.substring(0, maxLength - 3) + "..."
  }

  return message
}

/**
 * Checks if a user is subscribed to notifications
 * @param userId The user ID to check
 * @returns Promise resolving to true if the user is subscribed
 */
export async function isUserSubscribed(userId: string): Promise<boolean> {
  try {
    // Check if we're in the browser
    if (typeof window === "undefined") return false

    // Check if OneSignal is available
    if (!window.OneSignal) return false

    // Get the current user's OneSignal ID
    return new Promise((resolve) => {
      window.OneSignal.getExternalUserId((externalUserId: string) => {
        if (externalUserId === userId) {
          window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
            resolve(isEnabled)
          })
        } else {
          resolve(false)
        }
      })
    })
  } catch (error) {
    console.error("Error checking if user is subscribed:", error)
    return false
  }
}

/**
 * Sends a notification to a user about a new message
 * @param recipientId The user ID of the recipient
 * @param senderName The name of the message sender
 * @param messagePreview A preview of the message content
 * @param chatId The chat ID where the message was sent
 * @param senderAvatar URL to the sender's avatar (optional)
 */
export async function sendMessageNotification(
  recipientId: string,
  senderName: string,
  messagePreview: string,
  chatId: string,
  senderAvatar?: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    console.log(`Sending message notification to user ${recipientId} from ${senderName}`)

    // Format the message preview
    const formattedMessage = formatMessagePreview(messagePreview)

    // Get the current origin
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.shhhhh.chat"

    // Prepare the notification payload
    const payload = {
      userId: recipientId,
      title: `New message from ${senderName}`,
      message: formattedMessage,
      url: `${origin}/?chat=${chatId}`,
      icon: senderAvatar || `${origin}/logo.png`,
      data: {
        chatId,
        type: "new_message",
        senderId: senderName,
      },
    }

    console.log("Sending notification payload:", JSON.stringify(payload))

    // Send the notification
    const response = await fetch("/api/send-message-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch (e) {
        errorData = { message: errorText }
      }

      console.error("Failed to send message notification:", errorData)
      return {
        success: false,
        error: errorData.error || `Failed to send notification: ${response.status} ${response.statusText}`,
      }
    }

    const data = await response.json()

    // Check for warning about unsubscribed user
    if (data.warning === "User not subscribed to notifications") {
      console.warn("Recipient not subscribed to notifications:", recipientId)
      return {
        success: false,
        error: "Recipient not subscribed to notifications",
        data,
      }
    }

    return { success: true, data }
  } catch (error) {
    console.error("Error sending message notification:", error)
    return { success: false, error: String(error) }
  }
}

// Send a notification to a specific user
export async function sendNotificationToUser(
  userId: string,
  title: string,
  message: string,
  url = "/",
  data: any = {},
) {
  try {
    const response = await fetch("/api/send-onesignal-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        title,
        message,
        url,
        data,
        // Override app name and icon for notifications
        name: "Shhhhh Chat",
        chrome_web_icon: "https://www.shhhhh.chat/logo.png",
        firefox_icon: "https://www.shhhhh.chat/logo.png",
        chrome_web_image: "https://www.shhhhh.chat/logo.png",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to send notification: ${response.status} ${response.statusText} - ${errorText}`)
    }

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
    const response = await fetch("/api/send-onesignal-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        segment: "All",
        title,
        message,
        url,
        data,
        // Override app name and icon for notifications
        name: "Shhhhh Chat",
        chrome_web_icon: "https://www.shhhhh.chat/logo.png",
        firefox_icon: "https://www.shhhhh.chat/logo.png",
        chrome_web_image: "https://www.shhhhh.chat/logo.png",
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to send notification: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()
    console.log("OneSignal notification sent to all:", result)
    return result
  } catch (error) {
    console.error("Error sending OneSignal notification to all:", error)
    throw error
  }
}
