import { NextResponse } from "next/server"
import crypto from "crypto"

// Pushpad authentication token
const PUSHPAD_AUTH_TOKEN = "cLieW18bqphPKqNURKKtrSGSNmyNZmacSKpiNTTE"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { uid } = body

    if (!uid) {
      return NextResponse.json({ error: "Missing user ID" }, { status: 400 })
    }

    // Generate HMAC signature using SHA256
    const signature = crypto.createHmac("sha256", PUSHPAD_AUTH_TOKEN).update(uid).digest("hex")

    return NextResponse.json({ signature })
  } catch (error) {
    console.error("Error generating Pushpad signature:", error)
    return NextResponse.json({ error: "Failed to generate signature" }, { status: 500 })
  }
}
