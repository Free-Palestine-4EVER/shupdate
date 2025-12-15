"use client"

import { db } from "@/lib/firebase"
import { ref, remove, get, update, push, serverTimestamp } from "firebase/database"
import { clearAllKeys, getAdminUserId } from "@/lib/encryption"
import { signOut } from "firebase/auth"
import { auth } from "@/lib/firebase"

// Notify admin about a security incident
export async function notifyAdminOfSecurityIncident(
    userId: string,
    username: string,
    incidentType: "lockout" | "account_deleted"
): Promise<void> {
    const adminUserId = getAdminUserId()

    // Create a security incident record
    const incidentsRef = ref(db, `security_incidents`)
    const newIncidentRef = push(incidentsRef)

    await update(newIncidentRef, {
        id: newIncidentRef.key,
        userId,
        username,
        incidentType,
        message: incidentType === "lockout"
            ? `User "${username}" has been locked out after 5 failed passcode attempts.`
            : `User "${username}" account has been DELETED after 10 failed passcode attempts.`,
        timestamp: serverTimestamp(),
        read: false
    })

    // Also create a direct message to admin if they exist
    try {
        // Find or create a chat between the system and admin
        const adminNotificationRef = ref(db, `admin_notifications/${adminUserId}`)
        const notificationRef = push(adminNotificationRef)

        await update(notificationRef, {
            id: notificationRef.key,
            type: "security_incident",
            incidentType,
            userId,
            username,
            message: incidentType === "lockout"
                ? `⚠️ SECURITY ALERT: User "${username}" locked out after 5 failed attempts`
                : `🚨 CRITICAL: User "${username}" DELETED after 10 failed attempts`,
            timestamp: serverTimestamp(),
            read: false
        })
    } catch (error) {
        console.error("Error creating admin notification:", error)
    }
}

// Delete all user data from Firebase
export async function deleteUserAndAllData(userId: string): Promise<void> {
    try {
        // 1. Get user info for notification
        const userRef = ref(db, `users/${userId}`)
        const userSnapshot = await get(userRef)
        const username = userSnapshot.exists() ? userSnapshot.val().username : "Unknown"

        // 2. Notify admin BEFORE deletion
        await notifyAdminOfSecurityIncident(userId, username, "account_deleted")

        // 3. Delete user profile
        await remove(userRef)

        // 4. Delete user's payments
        const paymentsRef = ref(db, `payments`)
        const paymentsSnapshot = await get(paymentsRef)
        if (paymentsSnapshot.exists()) {
            const payments = paymentsSnapshot.val()
            for (const paymentId of Object.keys(payments)) {
                if (payments[paymentId].userId === userId) {
                    await remove(ref(db, `payments/${paymentId}`))
                }
            }
        }

        // 5. Delete user from chats (messages remain but are encrypted)
        const chatsRef = ref(db, `chats`)
        const chatsSnapshot = await get(chatsRef)
        if (chatsSnapshot.exists()) {
            const chats = chatsSnapshot.val()
            for (const chatId of Object.keys(chats)) {
                const chat = chats[chatId]
                if (chat.participants && chat.participants[userId]) {
                    // Remove user from participants
                    await remove(ref(db, `chats/${chatId}/participants/${userId}`))
                }
            }
        }

        // 6. Delete user from groups
        const groupsRef = ref(db, `groups`)
        const groupsSnapshot = await get(groupsRef)
        if (groupsSnapshot.exists()) {
            const groups = groupsSnapshot.val()
            for (const groupId of Object.keys(groups)) {
                const group = groups[groupId]
                if (group.participants && group.participants[userId]) {
                    await remove(ref(db, `groups/${groupId}/participants/${userId}`))
                }
            }
        }

        // 7. Delete presence/status
        await remove(ref(db, `presence/${userId}`))
        await remove(ref(db, `status/${userId}`))

        // 8. Clear local encryption keys
        await clearAllKeys()

        // 9. Sign out
        await signOut(auth)

    } catch (error) {
        console.error("Error deleting user data:", error)
        throw error
    }
}

// Lock user account (set lockout timestamp)
export async function lockUserAccount(userId: string, username: string): Promise<void> {
    const lockoutUntil = Date.now() + (60 * 60 * 1000) // 1 hour from now

    // Update user with lockout info
    const userRef = ref(db, `users/${userId}`)
    await update(userRef, {
        lockoutUntil,
        passcodeAttempts: 5
    })

    // Notify admin
    await notifyAdminOfSecurityIncident(userId, username, "lockout")
}

// Check if user is locked out
export async function checkLockoutStatus(userId: string): Promise<{
    isLockedOut: boolean
    lockoutUntil: number | null
    remainingAttempts: number
}> {
    try {
        const userRef = ref(db, `users/${userId}`)
        const snapshot = await get(userRef)

        if (!snapshot.exists()) {
            return { isLockedOut: false, lockoutUntil: null, remainingAttempts: 5 }
        }

        const userData = snapshot.val()
        const now = Date.now()

        // Check if lockout has expired
        if (userData.lockoutUntil && userData.lockoutUntil > now) {
            return {
                isLockedOut: true,
                lockoutUntil: userData.lockoutUntil,
                remainingAttempts: 0
            }
        }

        // If lockout expired, reset attempts after first lockout
        const attempts = userData.passcodeAttempts || 0
        const totalAttempts = userData.totalPasscodeAttempts || 0

        // After lockout, user has 5 more attempts before deletion (10 total)
        const remainingBeforeDeletion = 10 - totalAttempts
        const remainingBeforeLockout = 5 - (attempts % 5)

        return {
            isLockedOut: false,
            lockoutUntil: null,
            remainingAttempts: Math.min(remainingBeforeLockout, remainingBeforeDeletion)
        }
    } catch (error) {
        console.error("Error checking lockout status:", error)
        return { isLockedOut: false, lockoutUntil: null, remainingAttempts: 5 }
    }
}

// Record failed passcode attempt
export async function recordFailedAttempt(userId: string, username: string): Promise<{
    shouldLockout: boolean
    shouldDelete: boolean
    remainingAttempts: number
}> {
    try {
        const userRef = ref(db, `users/${userId}`)
        const snapshot = await get(userRef)

        let attempts = 1
        let totalAttempts = 1

        if (snapshot.exists()) {
            const userData = snapshot.val()
            attempts = (userData.passcodeAttempts || 0) + 1
            totalAttempts = (userData.totalPasscodeAttempts || 0) + 1
        }

        // Update attempt counts
        await update(userRef, {
            passcodeAttempts: attempts,
            totalPasscodeAttempts: totalAttempts,
            lastFailedAttempt: serverTimestamp()
        })

        // Check if should delete (10 total attempts)
        if (totalAttempts >= 10) {
            return { shouldLockout: false, shouldDelete: true, remainingAttempts: 0 }
        }

        // Check if should lockout (every 5 attempts)
        if (attempts >= 5) {
            return { shouldLockout: true, shouldDelete: false, remainingAttempts: 0 }
        }

        return {
            shouldLockout: false,
            shouldDelete: false,
            remainingAttempts: 5 - attempts
        }
    } catch (error) {
        console.error("Error recording failed attempt:", error)
        return { shouldLockout: false, shouldDelete: false, remainingAttempts: 5 }
    }
}

// Reset passcode attempts on successful login
export async function resetPasscodeAttempts(userId: string): Promise<void> {
    try {
        const userRef = ref(db, `users/${userId}`)
        await update(userRef, {
            passcodeAttempts: 0,
            lockoutUntil: null
        })
    } catch (error) {
        console.error("Error resetting passcode attempts:", error)
    }
}
