import { NextRequest, NextResponse } from "next/server"

// Secret key to protect this endpoint
const ADMIN_SECRET = process.env.ADMIN_RESET_SECRET || "reset-all-pins-secret-key"

// Firebase REST API base URL
const DATABASE_URL = `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`

export async function POST(req: NextRequest) {
    try {
        // Check for admin secret in header
        const authHeader = req.headers.get("x-admin-secret")

        if (authHeader !== ADMIN_SECRET) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        // Get all users via REST API
        const usersResponse = await fetch(`${DATABASE_URL}/users.json`)
        if (!usersResponse.ok) {
            throw new Error(`Failed to fetch users: ${usersResponse.statusText}`)
        }

        const users = await usersResponse.json()

        if (!users) {
            return NextResponse.json({ message: "No users found", resetCount: 0 })
        }

        const userIds = Object.keys(users)
        let resetCount = 0
        const updates: Record<string, null> = {}

        for (const userId of userIds) {
            const user = users[userId]
            let needsUpdate = false

            // Remove passcode data
            if (user.passcode) {
                updates[`users/${userId}/passcode`] = null
                needsUpdate = true
            }

            // Reset passcode attempts
            if (user.passcodeAttempts) {
                updates[`users/${userId}/passcodeAttempts`] = null
                needsUpdate = true
            }

            if (user.totalPasscodeAttempts) {
                updates[`users/${userId}/totalPasscodeAttempts`] = null
                needsUpdate = true
            }

            if (user.lockoutUntil) {
                updates[`users/${userId}/lockoutUntil`] = null
                needsUpdate = true
            }

            if (user.lastFailedAttempt) {
                updates[`users/${userId}/lastFailedAttempt`] = null
                needsUpdate = true
            }

            if (needsUpdate) {
                resetCount++
            }
        }

        // Apply all updates at once via REST API PATCH
        if (Object.keys(updates).length > 0) {
            const updateResponse = await fetch(`${DATABASE_URL}/.json`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates)
            })

            if (!updateResponse.ok) {
                throw new Error(`Failed to update: ${updateResponse.statusText}`)
            }
        }

        return NextResponse.json({
            success: true,
            message: `Reset passcodes for ${resetCount} users`,
            resetCount,
            totalUsers: userIds.length
        })

    } catch (error) {
        console.error("Error resetting passcodes:", error)
        return NextResponse.json(
            { error: "Failed to reset passcodes", details: String(error) },
            { status: 500 }
        )
    }
}
