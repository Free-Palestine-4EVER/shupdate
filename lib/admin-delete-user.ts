"use client"

import { db, storage } from "@/lib/firebase"
import { ref, remove, get, update } from "firebase/database"
import { ref as storageRef, deleteObject, listAll } from "firebase/storage"

export interface DeleteUserResult {
    success: boolean
    deletedChats: number
    deletedMessages: number
    deletedGroups: number
    error?: string
}

/**
 * Completely deletes a user and all their associated data from Firebase.
 * This includes:
 * - User profile
 * - All chats where the user is a participant (and their messages)
 * - User's participation in groups
 * - Payments
 * - Presence/status data
 * - Security incidents
 * - Admin notifications
 * - userChats references for both deleted user and other participants
 */
export async function adminDeleteUserCompletely(userId: string): Promise<DeleteUserResult> {
    let deletedChats = 0
    let deletedMessages = 0
    let deletedGroups = 0

    try {
        // 1. Find all chats where user is a participant
        const chatsRef = ref(db, "chats")
        const chatsSnapshot = await get(chatsRef)
        const chatsToDelete: string[] = []
        const otherParticipants: Set<string> = new Set()

        if (chatsSnapshot.exists()) {
            const chats = chatsSnapshot.val()
            for (const chatId of Object.keys(chats)) {
                const chat = chats[chatId]
                const participants = chat.participants

                // Check if user is a participant (handle both array and object formats)
                let isParticipant = false
                if (Array.isArray(participants)) {
                    isParticipant = participants.includes(userId)
                    if (isParticipant) {
                        participants.forEach((p: string) => {
                            if (p !== userId) otherParticipants.add(p)
                        })
                    }
                } else if (typeof participants === "object" && participants !== null) {
                    isParticipant = userId in participants
                    if (isParticipant) {
                        Object.keys(participants).forEach((p) => {
                            if (p !== userId) otherParticipants.add(p)
                        })
                    }
                }

                if (isParticipant) {
                    chatsToDelete.push(chatId)
                }
            }
        }

        // 2. Delete all messages for each chat and the chat itself
        for (const chatId of chatsToDelete) {
            // Count and delete messages
            const messagesRef = ref(db, `messages/${chatId}`)
            const messagesSnapshot = await get(messagesRef)
            if (messagesSnapshot.exists()) {
                const messages = messagesSnapshot.val()
                deletedMessages += Object.keys(messages).length

                // Try to delete media files from storage for each message
                for (const messageId of Object.keys(messages)) {
                    const message = messages[messageId]
                    await deleteMessageMedia(message)
                }
            }

            // Delete messages node for this chat
            await remove(messagesRef)

            // Delete the chat itself
            await remove(ref(db, `chats/${chatId}`))
            deletedChats++
        }

        // 3. Clean up userChats references for the deleted user
        await remove(ref(db, `userChats/${userId}`))

        // 4. Clean up userChats references for other participants (remove deleted chats)
        for (const participantId of otherParticipants) {
            for (const chatId of chatsToDelete) {
                await remove(ref(db, `userChats/${participantId}/${chatId}`))
            }
        }

        // 5. Handle groups - remove user from groups or delete if they're the only member
        const groupsRef = ref(db, "groups")
        const groupsSnapshot = await get(groupsRef)

        if (groupsSnapshot.exists()) {
            const groups = groupsSnapshot.val()
            for (const groupId of Object.keys(groups)) {
                const group = groups[groupId]
                const participants = group.participants

                let isParticipant = false
                let participantCount = 0

                if (Array.isArray(participants)) {
                    isParticipant = participants.includes(userId)
                    participantCount = participants.length
                } else if (typeof participants === "object" && participants !== null) {
                    isParticipant = userId in participants
                    participantCount = Object.keys(participants).length
                }

                if (isParticipant) {
                    if (participantCount <= 1) {
                        // User is the only participant, delete the group entirely
                        await remove(ref(db, `groups/${groupId}`))
                        await remove(ref(db, `messages/${groupId}`))
                        deletedGroups++
                    } else {
                        // Remove user from participants
                        if (Array.isArray(participants)) {
                            const newParticipants = participants.filter((p: string) => p !== userId)
                            await update(ref(db, `groups/${groupId}`), { participants: newParticipants })
                        } else {
                            await remove(ref(db, `groups/${groupId}/participants/${userId}`))
                        }

                        // Also remove from admins if present
                        if (group.admins) {
                            if (Array.isArray(group.admins)) {
                                const newAdmins = group.admins.filter((a: string) => a !== userId)
                                await update(ref(db, `groups/${groupId}`), { admins: newAdmins })
                            } else if (typeof group.admins === "object") {
                                await remove(ref(db, `groups/${groupId}/admins/${userId}`))
                            }
                        }
                    }
                }
            }
        }

        // 6. Delete payments associated with user
        const paymentsRef = ref(db, "payments")
        const paymentsSnapshot = await get(paymentsRef)
        if (paymentsSnapshot.exists()) {
            const payments = paymentsSnapshot.val()
            for (const paymentId of Object.keys(payments)) {
                if (payments[paymentId].userId === userId) {
                    await remove(ref(db, `payments/${paymentId}`))
                }
            }
        }

        // 7. Delete presence and status
        await remove(ref(db, `presence/${userId}`))
        await remove(ref(db, `status/${userId}`))

        // 8. Delete security incidents related to user
        const incidentsRef = ref(db, "security_incidents")
        const incidentsSnapshot = await get(incidentsRef)
        if (incidentsSnapshot.exists()) {
            const incidents = incidentsSnapshot.val()
            for (const incidentId of Object.keys(incidents)) {
                if (incidents[incidentId].userId === userId) {
                    await remove(ref(db, `security_incidents/${incidentId}`))
                }
            }
        }

        // 9. Delete admin notifications related to user
        const adminNotificationsRef = ref(db, "admin_notifications")
        const adminNotificationsSnapshot = await get(adminNotificationsRef)
        if (adminNotificationsSnapshot.exists()) {
            const adminNotifications = adminNotificationsSnapshot.val()
            for (const adminId of Object.keys(adminNotifications)) {
                const notifications = adminNotifications[adminId]
                if (typeof notifications === "object") {
                    for (const notificationId of Object.keys(notifications)) {
                        if (notifications[notificationId].userId === userId) {
                            await remove(ref(db, `admin_notifications/${adminId}/${notificationId}`))
                        }
                    }
                }
            }
        }

        // 10. Delete device requests
        await remove(ref(db, `device_requests/${userId}`))

        // 11. Finally, delete the user profile
        await remove(ref(db, `users/${userId}`))

        return {
            success: true,
            deletedChats,
            deletedMessages,
            deletedGroups,
        }
    } catch (error: any) {
        console.error("Error deleting user completely:", error)
        return {
            success: false,
            deletedChats,
            deletedMessages,
            deletedGroups,
            error: error.message || "Unknown error occurred",
        }
    }
}

/**
 * Helper function to delete media files associated with a message
 */
async function deleteMessageMedia(message: any): Promise<void> {
    const mediaUrls = [message.imageUrl, message.videoUrl, message.audioUrl].filter(Boolean)

    for (const url of mediaUrls) {
        try {
            // Extract path from Firebase Storage URL
            const urlPath = url.split("?")[0].split("/o/")[1]
            if (urlPath) {
                const decodedPath = decodeURIComponent(urlPath)
                const mediaRef = storageRef(storage, decodedPath)
                await deleteObject(mediaRef)
            }
        } catch (storageError) {
            // Log but don't fail - media might already be deleted or URL might be external
            console.warn("Could not delete media file:", storageError)
        }
    }
}

/**
 * Reset only passcodes without clearing encryption keys.
 * This allows users to still decrypt their old messages.
 * Only clears: passcodes, device IDs, and security counters.
 */
export async function resetPasscodesOnly(): Promise<{
    success: boolean
    resetCount: number
    error?: string
}> {
    try {
        const usersRef = ref(db, "users")
        const usersSnapshot = await get(usersRef)

        if (!usersSnapshot.exists()) {
            return { success: true, resetCount: 0 }
        }

        const users = usersSnapshot.val()
        const userIds = Object.keys(users)
        let resetCount = 0
        const updates: Record<string, null> = {}

        for (const userId of userIds) {
            const user = users[userId]
            let needsUpdate = false

            // Clear passcode
            if (user.passcode) {
                updates[`users/${userId}/passcode`] = null
                needsUpdate = true
            }

            // Clear device ID (force re-registration)
            if (user.deviceId) {
                updates[`users/${userId}/deviceId`] = null
                needsUpdate = true
            }

            // Clear device version
            if (user.deviceVersion) {
                updates[`users/${userId}/deviceVersion`] = null
                needsUpdate = true
            }

            // NOTE: We DO NOT clear encryptedPrivateKey or publicKey
            // This preserves the ability to decrypt old messages

            // Clear passcode attempts
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

        // Apply all updates at once
        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates)
        }

        return { success: true, resetCount }
    } catch (error: any) {
        console.error("Error resetting passcodes:", error)
        return {
            success: false,
            resetCount: 0,
            error: error.message || "Unknown error occurred",
        }
    }
}

/**
 * Reset all user passcodes for a fresh start.
 * This clears passcodes, device IDs, and encryption keys.
 */
export async function resetAllPasscodesForFreshStart(): Promise<{
    success: boolean
    resetCount: number
    error?: string
}> {
    try {
        const usersRef = ref(db, "users")
        const usersSnapshot = await get(usersRef)

        if (!usersSnapshot.exists()) {
            return { success: true, resetCount: 0 }
        }

        const users = usersSnapshot.val()
        const userIds = Object.keys(users)
        let resetCount = 0
        const updates: Record<string, null> = {}

        for (const userId of userIds) {
            const user = users[userId]
            let needsUpdate = false

            // Clear passcode
            if (user.passcode) {
                updates[`users/${userId}/passcode`] = null
                needsUpdate = true
            }

            // Clear device ID (force re-registration)
            if (user.deviceId) {
                updates[`users/${userId}/deviceId`] = null
                needsUpdate = true
            }

            // Clear device version
            if (user.deviceVersion) {
                updates[`users/${userId}/deviceVersion`] = null
                needsUpdate = true
            }

            // Clear encrypted private key (force new key generation)
            if (user.encryptedPrivateKey) {
                updates[`users/${userId}/encryptedPrivateKey`] = null
                needsUpdate = true
            }

            // Clear public key
            if (user.publicKey) {
                updates[`users/${userId}/publicKey`] = null
                needsUpdate = true
            }

            // Clear passcode attempts
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

        // Apply all updates at once
        if (Object.keys(updates).length > 0) {
            await update(ref(db), updates)
        }

        return { success: true, resetCount }
    } catch (error: any) {
        console.error("Error resetting passcodes:", error)
        return {
            success: false,
            resetCount: 0,
            error: error.message || "Unknown error occurred",
        }
    }
}
