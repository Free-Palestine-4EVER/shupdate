// Pushpad API utility functions
import type { User } from "./types"

const PUSHPAD_PROJECT_ID = 8920
const PUSHPAD_AUTH_TOKEN = "cLieW18bqphPKqNURKKtrSGSNmyNZmacSKpiNTTE"
const PUSHPAD_API_URL = "https://pushpad.xyz/api/v1"

// Function to send a notification via Pushpad API
export async function sendPushpadNotification({
  title,
  body,
  targetUsers,
  url,
  iconUrl,
  imageUrl,
  ttl,
  requireInteraction,
  chatId,
}: {
  title: string
  body: string
  targetUsers: string[]
  url?: string
  iconUrl?: string
  imageUrl?: string
  ttl?: number
  requireInteraction?: boolean
  chatId?: string
}) {
  try {
    const payload = {
      project_id: PUSHPAD_PROJECT_ID,
      title,
      body,
      target_url: url || `https://www.shhhhh.chat${chatId ? `/?chat=${chatId}` : ""}`,
      icon_url: iconUrl,
      image_url: imageUrl,
      ttl: ttl || 604800, // Default: 1 week in seconds
      require_interaction: requireInteraction || false,
      custom_data: chatId ? { chatId } : undefined,
      uids: targetUsers,
    }

    const response = await fetch(`${PUSHPAD_API_URL}/notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PUSHPAD_AUTH_TOKEN}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Pushpad API error: ${errorData.error || response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error sending Pushpad notification:", error)
    throw error
  }
}

// Function to associate a user with their Pushpad UID
export async function signPushpadUser(user: User) {
  if (!user || !user.id) return null

  try {
    const uid = user.id
    const data = { uid }

    const signature = await generateSignature(data)
    return { uid, signature }
  } catch (error) {
    console.error("Error signing Pushpad user:", error)
    return null
  }
}

// Helper function to generate signature for Pushpad authentication
// In a real implementation, this should be done server-side
async function generateSignature(data: any) {
  // This is a placeholder - in production, you would call your backend
  // to generate a proper HMAC signature using your Pushpad auth token
  // For security reasons, this should NOT be done client-side

  // Example server endpoint call:
  try {
    const response = await fetch("/api/pushpad-signature", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error("Failed to generate signature")
    }

    const result = await response.json()
    return result.signature
  } catch (error) {
    console.error("Error generating signature:", error)
    return ""
  }
}
