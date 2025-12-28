import { NextResponse } from "next/server"
import { Resend } from "resend"

// Initialize Resend with API key from environment variables
// Use a dummy key during build if not available
const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder")

// Admin OneSignal player ID (external user ID)
const ADMIN_USER_ID = "zzzz"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, username, email, userId, timestamp, message } = body

    // Handle device access request notification


    // Handle user registration notification (existing functionality)
    const formattedDate = new Date(timestamp).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      timeZoneName: "short",
    })

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev", // Using Resend's default domain
      to: "zzeidnaser@gmail.com", // Your email address
      subject: `New User Registration: ${username}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h1 style="color: #f4427e; text-align: center; margin-bottom: 20px;">New User Registration</h1>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>User ID:</strong> ${userId}</p>
            <p style="margin: 5px 0;"><strong>Registration Time:</strong> ${formattedDate}</p>
          </div>
          <div style="text-align: center; margin-top: 20px;">
            <a href="${process.env.NEXT_PUBLIC_VERCEL_URL || "https://your-app-url.com"}/payment-verify" 
               style="background-color: #f4427e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Verify User
            </a>
          </div>
          <p style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
            This is an automated notification from your chat application.
          </p>
        </div>
      `,
    })

    if (error) {
      console.error("Error sending email:", error)
      return NextResponse.json({ error: "Failed to send email notification" }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: data?.id })
  } catch (error) {
    console.error("Error in notify-admin API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
