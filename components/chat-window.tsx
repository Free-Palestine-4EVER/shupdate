"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import type { User, Message, Chat } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { Paperclip, Send, Trash2, RefreshCw, Heart, ArrowLeft, Mic, X, Maximize, Users, Sparkles, Timer } from "lucide-react"
import { db, storage } from "@/lib/firebase"
import { ref as dbRef, onValue, push, set, update, remove, get, serverTimestamp } from "firebase/database"
import { ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage"
import { Alert, AlertDescription } from "@/components/ui/alert"
import VoiceMessage from "@/components/voice-message"
import VoiceRecorder from "@/components/voice-recorder"

import TypingIndicator from "@/components/typing-indicator"
import { formatMessagePreview, sendMessageNotification } from "@/lib/onesignal-utils"
import GroupMembersModal from "@/components/group-members-modal"
import { encryptMessage, decryptMessage, getPrivateKey, getAdminUserId } from "@/lib/encryption"

interface ChatWindowProps {
  currentUser: User | null
  selectedChat: string | null
  selectedUser: User | null
  users: User[]
  setSelectedChat: React.Dispatch<React.SetStateAction<string | null>>
  isMobileView?: boolean
  onBackClick?: () => void
  isGroup?: boolean
}

// Add this function after the imports and before the ChatWindow component
async function compressVideo(videoFile: File): Promise<Blob> {
  console.log("Starting video compression...")

  try {
    // Create a video element to get video dimensions
    const videoEl = document.createElement("video")
    const videoUrl = URL.createObjectURL(videoFile)

    // Set up video element
    videoEl.src = videoUrl
    videoEl.muted = true

    // Wait for video metadata to load
    await new Promise<void>((resolve) => {
      videoEl.onloadedmetadata = () => resolve()
    })

    // Get video dimensions
    const originalWidth = videoEl.videoWidth
    const originalHeight = videoEl.videoHeight

    // Calculate new dimensions (max 720p)
    const maxHeight = 720
    const aspectRatio = originalWidth / originalHeight
    const newHeight = Math.min(maxHeight, originalHeight)
    const newWidth = Math.round(newHeight * aspectRatio)

    console.log(`Original dimensions: ${originalWidth}x${originalHeight}`)
    console.log(`New dimensions: ${newWidth}x${newHeight}`)

    // Create canvas for compression
    const canvas = document.createElement("canvas")
    canvas.width = newWidth
    canvas.height = newHeight
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      throw new Error("Could not get canvas context")
    }

    // Play the video (needed for some browsers)
    videoEl.play()

    // Create a MediaRecorder to capture the canvas
    const stream = canvas.captureStream(30) // 30 FPS
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9", // Use VP9 for better compression
      videoBitsPerSecond: 1000000, // 1 Mbps
    })

    const chunks: Blob[] = []
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    // Create a promise that resolves when recording is stopped
    const recordingPromise = new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" })
        resolve(blob)

        // Clean up
        URL.revokeObjectURL(videoUrl)
        videoEl.remove()
        canvas.remove()
      }
    })

    // Start recording
    mediaRecorder.start()

    // Draw video frames to canvas
    const drawFrame = () => {
      if (videoEl.ended || videoEl.paused) {
        mediaRecorder.stop()
        return
      }

      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      requestAnimationFrame(drawFrame)
    }

    drawFrame()

    // Set up video end event
    videoEl.onended = () => {
      mediaRecorder.stop()
    }

    // If video doesn't end naturally after 60 seconds, stop recording
    // This is a safety measure
    setTimeout(() => {
      if (mediaRecorder.state === "recording") {
        videoEl.pause()
        mediaRecorder.stop()
      }
    }, 60000)

    // Return the compressed video blob
    const compressedBlob = await recordingPromise
    console.log(
      `Compression complete. Original size: ${videoFile.size / 1024 / 1024}MB, Compressed size: ${compressedBlob.size / 1024 / 1024}MB`,
    )

    return compressedBlob
  } catch (error) {
    console.error("Error during video compression:", error)
    throw error
  }
}

// Helper function to safely format dates
const safeFormatDistanceToNow = (date: any): string => {
  if (!date) return "Offline"

  try {
    // Check if date is a string and convert it to Date object
    const dateObj = typeof date === "string" ? new Date(date) : date

    // Validate the date is valid
    if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
      return "Offline"
    }

    // Check if the date is too old (more than 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    if (dateObj < thirtyDaysAgo) {
      return "Offline"
    }

    return formatDistanceToNow(dateObj, { addSuffix: true })
  } catch (error) {
    console.error("Error formatting date:", error, date)
    return "Offline"
  }
}

export default function ChatWindow({
  currentUser,
  selectedChat,
  selectedUser,
  users,
  setSelectedChat,
  isMobileView = false,
  onBackClick,
  isGroup = false,
}: ChatWindowProps) {
  // Add a state variable for tracking online status at the top of the component with other state variables
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const [pendingVoiceMessages, setPendingVoiceMessages] = useState<Record<string, boolean>>({})
  const [isMobileBrowser, setIsMobileBrowser] = useState(false)
  const [deletingMessages, setDeletingMessages] = useState<Record<string, boolean>>({})
  const [expandedImage, setExpandedImage] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [groupData, setGroupData] = useState<Chat | null>(null)
  const [showGroupMembers, setShowGroupMembers] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false) // New state for delete confirmation dialog
  const [autoDeleteSetting, setAutoDeleteSetting] = useState<string>("never")

  // Enhanced scroll to bottom function with retry mechanism
  const scrollToBottom = () => {
    const scrollToBottomImmediate = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    }

    // Immediate scroll
    scrollToBottomImmediate()

    // Retry after a short delay to ensure DOM is fully rendered
    setTimeout(() => {
      scrollToBottomImmediate()
    }, 50)

    // Final retry to ensure we're at the bottom
    setTimeout(() => {
      scrollToBottomImmediate()
    }, 150)
  }

  // Detect mobile browser
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      return /android|iPad|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    }

    setIsMobileBrowser(checkMobile())
  }, [])

  // Reset initial load flag when chat changes
  useEffect(() => {
    setIsInitialLoad(true)
  }, [selectedChat])

  // Fetch group data if this is a group chat
  useEffect(() => {
    if (!selectedChat) {
      setGroupData(null)
      setAutoDeleteSetting("never")
      return
    }

    const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
    const unsubscribe = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        if (isGroup) {
          setGroupData({
            id: selectedChat,
            ...data,
            isGroup: true,
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
          })
        }
        // Update auto-delete setting for both groups and direct chats
        setAutoDeleteSetting(data.autoDeleteAfter || "never")
      }
    })

    return () => unsubscribe()
  }, [selectedChat, isGroup])

  // Add this useEffect to listen for status changes
  useEffect(() => {
    if (!db) return

    // Listen to both status and presence nodes for redundancy
    const statusRef = dbRef(db, "status")
    const presenceRef = dbRef(db, "presence")

    const statusUnsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const presenceData: Record<string, boolean> = {}

        snapshot.forEach((childSnapshot) => {
          const userId = childSnapshot.key || ""
          const userData = childSnapshot.val()

          // Check if the user is online based on their state
          presenceData[userId] = userData?.state === "online"
        })

        setOnlineUsers((prev) => ({ ...prev, ...presenceData }))
      }
    })

    const presenceUnsubscribe = onValue(presenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const presenceData: Record<string, boolean> = {}

        snapshot.forEach((childSnapshot) => {
          const userId = childSnapshot.key || ""
          const userData = childSnapshot.val()

          // Check if the user is online based on their online property
          presenceData[userId] = userData?.online === true
        })

        setOnlineUsers((prev) => ({ ...prev, ...presenceData }))
      }
    })

    return () => {
      statusUnsubscribe()
      presenceUnsubscribe()
    }
  }, [db])

  // Add this function to check if a user is online
  const isUserOnline = (userId: string) => {
    // Special case for Al sinwar user - always show as offline
    if (userId.toLowerCase().includes("sinwar")) {
      return false
    }

    // If the user is the current user, they're definitely online
    if (currentUser && userId === currentUser.id) {
      return true
    }

    // ONLY consider a user online if they have an explicit online status in the presence data
    // This is the most strict check to avoid false positives
    return onlineUsers[userId] === true
  }

  // Function to get read count for group messages
  const getReadCount = (message: Message) => {
    if (!isGroup || !message.readBy) return 0
    return Object.keys(message.readBy).length
  }

  // Function to get total participants count
  const getTotalParticipants = () => {
    if (!isGroup || !groupData) return 0
    return Array.isArray(groupData.participants)
      ? groupData.participants.length
      : Object.keys(groupData.participants || {}).length
  }

  // Fetch messages for selected chat - WITH SELECTIVE AUTO SCROLL
  useEffect(() => {
    if (!selectedChat) {
      setMessages([])
      return
    }

    // Reset delete dialog state when changing chats
    setShowDeleteDialog(false)

    setMessagesError(null)
    setIsLoadingMessages(true)

    try {
      const messagesRef = dbRef(db, `messages/${selectedChat}`)

      const unsubscribe = onValue(
        messagesRef,
        async (snapshot) => {
          if (snapshot.exists()) {
            const rawMessages: any[] = []

            snapshot.forEach((childSnapshot) => {
              const messageData = childSnapshot.val()

              // Safely handle timestamp conversion
              let timestamp: Date
              try {
                timestamp = messageData.timestamp ? new Date(messageData.timestamp) : new Date()
                // Validate the date
                if (isNaN(timestamp.getTime())) {
                  timestamp = new Date()
                }
              } catch (error) {
                console.error("Invalid timestamp:", messageData.timestamp)
                timestamp = new Date()
              }

              rawMessages.push({
                id: childSnapshot.key || "",
                ...messageData,
                timestamp: timestamp,
                reactions: messageData.reactions || {},
              })
            })

            // Decrypt messages if needed
            const messagesData: Message[] = []
            const adminUserId = getAdminUserId()
            const isAdmin = currentUser?.id === adminUserId
            const privateKey = currentUser ? await getPrivateKey(currentUser.id) : null

            for (const msg of rawMessages) {
              let decryptedText = msg.text

              // Check if message is encrypted
              if (msg.encryptedText && msg.encryptedKey && msg.iv) {
                try {
                  // Admin uses admin-encrypted version if available
                  if (isAdmin && msg.encryptedTextAdmin && msg.encryptedKeyAdmin && msg.ivAdmin) {
                    if (privateKey) {
                      decryptedText = await decryptMessage(
                        msg.encryptedTextAdmin,
                        msg.encryptedKeyAdmin,
                        msg.ivAdmin,
                        privateKey
                      )
                    } else {
                      decryptedText = "[Encryption key not found]"
                    }
                  } else if (privateKey) {
                    // Regular user decrypts with their key
                    decryptedText = await decryptMessage(
                      msg.encryptedText,
                      msg.encryptedKey,
                      msg.iv,
                      privateKey
                    )
                  } else {
                    decryptedText = "[Encryption key not found]"
                  }
                } catch (decryptError) {
                  console.error("Decryption failed:", decryptError)
                  decryptedText = "[Unable to decrypt]"
                }
              }

              messagesData.push({
                ...msg,
                text: decryptedText,
              })
            }

            // Sort messages by timestamp
            messagesData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

            // Filter out expired messages from display
            const now = Date.now()
            const visibleMessages = messagesData.filter(msg => !msg.expiresAt || msg.expiresAt > now)

            // Check if this is a new message (not initial load)
            const isNewMessage = messages.length > 0 && visibleMessages.length > messages.length

            setMessages(visibleMessages)
            setIsLoadingMessages(false)

            // Auto-scroll in two cases:
            // 1. Initial load of chat (when opening a chat)
            // 2. New message received/sent
            if (isInitialLoad || isNewMessage) {
              // Use requestAnimationFrame to ensure DOM is updated
              requestAnimationFrame(() => {
                scrollToBottom()
              })

              // Mark as no longer initial load after first scroll
              if (isInitialLoad) {
                setIsInitialLoad(false)
              }
            }

            // Mark messages as read and set auto-delete timer
            if (currentUser) {
              // Get chat's auto-delete setting
              const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
              get(chatRef).then((chatSnapshot) => {
                const chatData = chatSnapshot.val()
                const autoDeleteAfter = chatData?.autoDeleteAfter || "never"

                // Calculate expiration time based on setting
                const getExpirationMs = (setting: string): number | null => {
                  switch (setting) {
                    case "1m": return 60 * 1000
                    case "5m": return 5 * 60 * 1000
                    case "1h": return 60 * 60 * 1000
                    case "24h": return 24 * 60 * 60 * 1000
                    default: return null
                  }
                }

                const expirationMs = getExpirationMs(autoDeleteAfter)

                messagesData.forEach((message) => {
                  if (isGroup) {
                    // For groups, verify readBy
                    if (!message.readBy || !message.readBy[currentUser.id]) {
                      const messageRef = dbRef(db, `messages/${selectedChat}/${message.id}`)
                      const updateData: any = {
                        [`readBy.${currentUser.id}`]: true,
                      }

                      // Set readAt and expiresAt if auto-delete is enabled and message hasn't been read before
                      if (expirationMs && !message.readAt) {
                        const now = Date.now()
                        updateData.readAt = now
                        updateData.expiresAt = now + expirationMs
                      }

                      update(messageRef, updateData).catch((err) => console.error("Error marking group message as read:", err))
                    }
                  } else {
                    // For direct chats, use the read flag
                    if (message.receiverId === currentUser.id && !message.read) {
                      const messageRef = dbRef(db, `messages/${selectedChat}/${message.id}`)
                      const updateData: any = { read: true }

                      // Set readAt and expiresAt if auto-delete is enabled
                      if (expirationMs && !message.readAt) {
                        const now = Date.now()
                        updateData.readAt = now
                        updateData.expiresAt = now + expirationMs
                      }

                      update(messageRef, updateData).catch((err) =>
                        console.error("Error marking message as read:", err),
                      )
                    }
                  }

                  // Delete expired messages
                  if (message.expiresAt && message.expiresAt < Date.now()) {
                    const messageRef = dbRef(db, `messages/${selectedChat}/${message.id}`)
                    remove(messageRef).catch((err) => console.error("Error deleting expired message:", err))
                  }
                })
              }).catch((err) => console.error("Error getting chat settings:", err))
            }
          } else {
            setMessages([])
            setIsLoadingMessages(false)
            setIsInitialLoad(false)
          }
        },
        (error) => {
          console.error("Error fetching messages:", error)
          setMessagesError(`Failed to load messages: ${error.message}`)
          setIsLoadingMessages(false)
          setIsInitialLoad(false)
        },
      )

      return () => unsubscribe()
    } catch (error: any) {
      console.error("Error setting up messages listener:", error)
      setMessagesError(`Failed to set up messages listener: ${error.message}`)
      setIsLoadingMessages(false)
      setIsInitialLoad(false)
    }
  }, [selectedChat, currentUser, isGroup, messages.length, isInitialLoad])

  // Handle typing status
  useEffect(() => {
    if (!currentUser || !selectedChat) return

    // Clear typing status when leaving the chat
    return () => {
      if (currentUser && selectedChat) {
        const typingRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}/typingUsers/${currentUser.id}`)
        set(typingRef, false).catch((err) => console.error("Error clearing typing status:", err))

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current)
        }
      }
    }
  }, [currentUser, selectedChat, isGroup])

  // Listen for auto-delete setting changes
  useEffect(() => {
    if (!selectedChat) return

    const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}/autoDeleteAfter`)
    const unsubscribe = onValue(chatRef, async (snapshot) => {
      const setting = snapshot.val() || "never"

      // Calculate expiration time based on setting
      const getExpirationMs = (setting: string): number | null => {
        switch (setting) {
          case "1m": return 60 * 1000
          case "5m": return 5 * 60 * 1000
          case "1h": return 60 * 60 * 1000
          case "24h": return 24 * 60 * 60 * 1000
          default: return null
        }
      }

      const expirationMs = getExpirationMs(setting)

      // Update existing messages if needed
      // FIXED: Messages are stored at root level messages/{chatId}
      const messagesRef = dbRef(db, `messages/${selectedChat}`)
      const messagesSnapshot = await get(messagesRef)

      if (messagesSnapshot.exists()) {
        const messagesData = messagesSnapshot.val()
        const updates: any = {}
        const now = Date.now()

        Object.entries(messagesData).forEach(([msgId, msg]: [string, any]) => {
          // Rule: Auto-delete ONLY applies to SEEN messages
          // Check if message is read/seen
          let isRead = false
          let readTime = msg.readAt

          if (isGroup) {
            // For groups, check if seen by current user or anyone (logic choice: usually anyone seen triggers for everyone in simple mode,
            // but strict mode might be per-user. The prompt implies global auto-delete for the chat.
            // Existing logic uses msg.readBy property. 
            // If we assume "seen" means "readAt" is set. 
            if (msg.readAt) isRead = true
          } else {
            if (msg.read || msg.readAt) isRead = true
          }

          if (isRead) {
            // If we have a timer
            if (expirationMs) {
              // Calculate correct expiry based on when it was READ
              // If readAt is missing but read is true (legacy), use current time or msg timestamp? 
              // Safer to use execution time if readAt missing to avoid immediate deletion of old messages 
              // or just keep existing readAt if available.
              const effectiveReadTime = readTime || now

              const newExpiresAt = effectiveReadTime + expirationMs

              // Only update if significantly different (avoid loops)
              if (!msg.expiresAt || Math.abs(msg.expiresAt - newExpiresAt) > 1000) {
                updates[`${msgId}/expiresAt`] = newExpiresAt
                // Ensure readAt is set if missing
                if (!msg.readAt) updates[`${msgId}/readAt`] = effectiveReadTime
              }

              // If already expired according to NEW timer, delete immediately?
              // The update logic above sets the expiry. separate cleanup process or simultaneous check?
              // Let's delete immediately if expired to provide instant feedback
              if (newExpiresAt < now) {
                updates[msgId] = null // Delete
              }
            } else {
              // If setting is "never", remove expiry
              if (msg.expiresAt) {
                updates[`${msgId}/expiresAt`] = null
              }
            }
          }
        })

        if (Object.keys(updates).length > 0) {
          await update(messagesRef, updates)
        }
      }
    })

    return () => unsubscribe()
  }, [selectedChat, isGroup])

  // Periodic cleanup for expired messages (runs every 5 seconds)
  useEffect(() => {
    if (!currentUser || !selectedChat) return

    const cleanupExpiredMessages = async () => {
      try {
        // FIXED: Messages are stored at root level messages/{chatId}, not nested under chats/groups
        const messagesRef = dbRef(db, `messages/${selectedChat}`)
        const snapshot = await get(messagesRef)

        if (snapshot.exists()) {
          const now = Date.now()
          const messagesData = snapshot.val()
          let deletedCount = 0

          for (const [messageId, message] of Object.entries(messagesData)) {
            const msg = message as any
            if (msg.expiresAt && msg.expiresAt < now) {
              const messageRef = dbRef(db, `messages/${selectedChat}/${messageId}`)
              await remove(messageRef)
              deletedCount++
              console.log(`Auto-deleted expired message ${messageId} (expired at: ${new Date(msg.expiresAt).toISOString()}, now: ${new Date(now).toISOString()})`)
            }
          }

          // Check if all messages were deleted
          if (deletedCount > 0) {
            const remainingSnapshot = await get(messagesRef)

            if (!remainingSnapshot.exists() || Object.keys(remainingSnapshot.val() || {}).length === 0) {
              // No messages left - delete the entire chat
              console.log(`All messages deleted, removing chat ${selectedChat}`)

              const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
              await remove(chatRef)

              // Also remove the messages node
              await remove(messagesRef)

              console.log(`Chat ${selectedChat} completely removed`)
            }
          }
        }
      } catch (error) {
        console.error("Error cleaning up expired messages:", error)
      }
    }

    // Run cleanup every 5 seconds (faster cleanup)
    const interval = setInterval(cleanupExpiredMessages, 5000)

    // Also run immediately on mount
    cleanupExpiredMessages()

    return () => clearInterval(interval)
  }, [currentUser, selectedChat, isGroup])


  // Update typing status when user types
  const handleTyping = () => {
    if (!currentUser || !selectedChat) return

    // Only update if not already set to typing
    if (!isTyping) {
      setIsTyping(true)
      const typingRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}/typingUsers/${currentUser.id}`)
      set(typingRef, true).catch((err) => console.error("Error updating typing status:", err))
    }

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set timeout to clear typing status after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (currentUser && selectedChat) {
        setIsTyping(false)
        const typingRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}/typingUsers/${currentUser.id}`)
        set(typingRef, false).catch((err) => console.error("Error clearing typing status:", err))
      }
    }, 3000)
  }

  const handleAutoDeleteChange = async (setting: string) => {
    if (!selectedChat) return

    console.log("Setting auto-delete to:", setting) // Debug log
    try {
      const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
      await update(chatRef, {
        autoDeleteAfter: setting
      })
      setAutoDeleteSetting(setting) // Optimistic update
    } catch (error) {
      console.error("Error updating auto-delete setting:", error)
    }
  }

  const handleSendMessage = async () => {
    if (!currentUser || !selectedChat || !newMessage.trim()) return

    // Store message and clear input IMMEDIATELY to prevent delay
    const messageToSend = newMessage.trim()
    setNewMessage("")

    try {
      // Clear typing status
      setIsTyping(false)
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      const typingRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}/typingUsers/${currentUser.id}`)
      await set(typingRef, false)

      // Create a new message in the Realtime Database
      // Optimization: Messages are stored in root 'messages' node
      const messagesRef = dbRef(db, `messages/${selectedChat}`)
      const newMessageRef = push(messagesRef)

      // Prepare message data with encryption for 1-on-1 chats
      let messageData: any = {
        senderId: currentUser.id,
        timestamp: serverTimestamp(),
        reactions: {},
      }

      // Prepare message data with encryption for 1-on-1 chats
      // ENCRYPTION DISABLED FOR NOW - causing key mismatch issues
      // Always send as plaintext for reliability
      messageData.text = messageToSend

      /* ENCRYPTION DISABLED - Uncomment when ready to re-enable
      if (!isGroup && selectedUser?.publicKey) {
        try {
          // Get admin's public key for dual encryption
          const adminUserId = getAdminUserId()
          const adminUser = users.find(u => u.id === adminUserId)
          const adminPublicKey = adminUser?.publicKey

          // Encrypt message for recipient and optionally for admin
          const encryptedData = await encryptMessage(
            messageToSend,
            selectedUser.publicKey,
            adminPublicKey
          )

          messageData.text = null // Don't store plaintext
          messageData.encryptedText = encryptedData.encryptedText
          messageData.encryptedKey = encryptedData.encryptedKey
          messageData.iv = encryptedData.iv

          // Add admin encryption data if available
          if (encryptedData.encryptedTextAdmin) {
            messageData.encryptedTextAdmin = encryptedData.encryptedTextAdmin
            messageData.encryptedKeyAdmin = encryptedData.encryptedKeyAdmin
            messageData.ivAdmin = encryptedData.ivAdmin
          }
        } catch (encryptError) {
          console.error("Encryption failed, sending unencrypted:", encryptError)
          messageData.text = messageToSend
        }
      } else {
        // For groups or users without public keys, send unencrypted for now
        messageData.text = messageToSend
      }
      */

      if (isGroup) {
        // For groups, initialize readBy with current user
        messageData.readBy = { [currentUser.id]: true }
      } else {
        // For direct chats, set receiverId and read status
        messageData.receiverId = selectedUser?.id
        messageData.read = false
      }

      await set(newMessageRef, messageData)

      // Update last message in chat/group - FIXED: Don't include receiverId for groups
      const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
      const lastMessageData: any = {
        id: newMessageRef.key,
        text: messageToSend,
        senderId: currentUser.id,
        timestamp: new Date().toISOString(),
        read: false,
      }

      // Only add receiverId for direct chats, NOT for groups
      if (!isGroup && selectedUser) {
        lastMessageData.receiverId = selectedUser.id
      }

      // Add readBy for groups
      if (isGroup) {
        lastMessageData.readBy = { [currentUser.id]: true }
      }

      await update(chatRef, {
        lastMessage: lastMessageData,
        updatedAt: serverTimestamp(),
      })

      // Send push notification
      if (isGroup && groupData) {
        // For groups, notify all members except the sender
        const participantIds = Array.isArray(groupData.participants)
          ? groupData.participants
          : Object.keys(groupData.participants || {})

        participantIds.forEach(async (participantId) => {
          if (participantId !== currentUser.id && !isUserOnline(participantId)) {
            try {
              const preview = formatMessagePreview(messageToSend)
              await sendMessageNotification(
                participantId,
                `${currentUser.username} in ${groupData.name}`,
                preview,
                selectedChat,
                currentUser.photoURL,
              )
            } catch (error) {
              console.error("Error sending group notification:", error)
            }
          }
        })
      } else if (selectedUser && !isUserOnline(selectedUser.id)) {
        // For direct chats, notify the other user if they're offline
        try {
          const preview = formatMessagePreview(messageToSend)
          await sendMessageNotification(
            selectedUser.id,
            currentUser.username,
            preview,
            selectedChat,
            currentUser.photoURL,
          )
        } catch (error) {
          console.error("Error sending notification:", error)
        }
      }
    } catch (error: any) {
      console.error("Error sending message:", error)
      alert(`Failed to send message: ${error.message}`)
      // Restore message on error
      setNewMessage(messageToSend)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Get sender info for group messages
  const getSenderInfo = (senderId: string) => {
    if (senderId === currentUser?.id) {
      return currentUser
    }
    return (
      users.find((u) => u.id === senderId) || {
        id: senderId,
        username: "Unknown User",
        photoURL: "/placeholder.svg",
      }
    )
  }

  // Modify the handleFileUpload function to use compression for videos
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser || !selectedChat || (!selectedUser && !isGroup)) return

    setIsUploading(true)
    setUploadProgress(0)

    const isVideo = file.type.startsWith("video/")
    const isImage = file.type.startsWith("image/")
    const fileType = isImage ? "images" : "videos"

    let fileToUpload = file

    // Compress video before uploading
    if (isVideo) {
      try {
        console.log("Compressing video before upload...")
        setUploadProgress(5) // Show some initial progress
        const compressedVideo = await compressVideo(file)
        fileToUpload = new File([compressedVideo], file.name, { type: "video/webm" })
        console.log(
          `Video compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`,
        )
        setUploadProgress(20) // Show progress after compression
      } catch (error) {
        console.error("Error compressing video:", error)
        console.log("Continuing with original video file")
        // Continue with the original file if compression fails
      }
    }

    const fileRef = storageRef(storage, `${fileType}/${selectedChat}/${Date.now()}_${file.name}`)

    const uploadTask = uploadBytesResumable(fileRef, fileToUpload)

    uploadTask.on(
      "state_changed",
      (snapshot) => {
        // For videos, start from 20% (after compression) to 100%
        // For images, start from 0% to 100%
        const baseProgress = isVideo ? 20 : 0
        const uploadProgress = baseProgress + (snapshot.bytesTransferred / snapshot.totalBytes) * (100 - baseProgress)
        setUploadProgress(uploadProgress)
      },
      (error) => {
        console.error("Error uploading file:", error)
        alert(`Failed to upload file: ${error.message}`)
        setIsUploading(false)
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

        try {
          // Create a new message with the file URL
          const messagesRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}/messages`)
          const newMessageRef = push(messagesRef)

          const messageData: any = {
            text: null, // Remove the text for both image and video
            senderId: currentUser.id,
            timestamp: serverTimestamp(),
            reactions: {},
            ...(isImage ? { imageUrl: downloadURL } : { videoUrl: downloadURL }),
          }

          if (isGroup) {
            // For groups, initialize readBy with current user
            messageData.readBy = { [currentUser.id]: true }
          } else {
            // For direct chats, set receiverId and read status
            messageData.receiverId = selectedUser?.id
            messageData.read = false
          }

          await set(newMessageRef, messageData)

          // Update last message in chat - FIXED: Don't include receiverId for groups
          const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
          const lastMessageData: any = {
            id: newMessageRef.key,
            text: isImage ? "Sent an image" : "Sent a video", // Keep text for sidebar preview only
            senderId: currentUser.id,
            timestamp: new Date().toISOString(),
            read: false,
            ...(isImage ? { imageUrl: downloadURL } : { videoUrl: downloadURL }),
          }

          // Only add receiverId for direct chats, NOT for groups
          if (!isGroup && selectedUser) {
            lastMessageData.receiverId = selectedUser.id
          }

          // Add readBy for groups
          if (isGroup) {
            lastMessageData.readBy = { [currentUser.id]: true }
          }

          await update(chatRef, {
            lastMessage: lastMessageData,
            updatedAt: serverTimestamp(),
          })

          // Send push notification
          if (isGroup && groupData) {
            // For groups, notify all members except the sender
            const participantIds = Array.isArray(groupData.participants)
              ? groupData.participants
              : Object.keys(groupData.participants || {})

            participantIds.forEach(async (participantId) => {
              if (participantId !== currentUser.id && !isUserOnline(participantId)) {
                try {
                  await sendMessageNotification(
                    participantId,
                    `${currentUser.username} in ${groupData.name}`,
                    isImage ? "Sent you an image" : "Sent you a video",
                    selectedChat,
                    currentUser.photoURL,
                  )
                } catch (error) {
                  console.error("Error sending group notification:", error)
                }
              }
            })
          } else if (selectedUser && !isUserOnline(selectedUser.id)) {
            // For direct chats, notify the other user if they're offline
            try {
              await sendMessageNotification(
                selectedUser.id,
                currentUser.username,
                isImage ? "Sent you an image" : "Sent you a video",
                selectedChat,
                currentUser.photoURL,
              )
            } catch (error) {
              console.error("Error sending notification:", error)
            }
          }

          setIsUploading(false)
        } catch (error: any) {
          console.error("Error sending file message:", error)
          alert(`Failed to send file message: ${error.message}`)
          setIsUploading(false)
        }
      },
    )
  }

  // Updated voice recording handler
  const handleVoiceRecorded = async (audioBlob: Blob, duration: number) => {
    if (!currentUser || !selectedChat || (!selectedUser && !isGroup)) return

    try {
      console.log("Processing voice message, blob type:", audioBlob.type, "size:", audioBlob.size)

      // Generate a temporary local URL for immediate display
      const localAudioUrl = URL.createObjectURL(audioBlob)

      // Create a temporary message ID
      const tempMessageId = `temp_${Date.now()}`

      // Add to pending voice messages
      setPendingVoiceMessages((prev) => ({ ...prev, [tempMessageId]: true }))

      // Add temporary message to the UI immediately
      const tempMessage: Message = {
        id: tempMessageId,
        text: "Sent a voice message",
        senderId: currentUser.id,
        timestamp: new Date(),
        read: false,
        reactions: {},
        audioUrl: localAudioUrl,
        audioDuration: duration,
        isPending: true,
      }

      // Add to messages array for immediate display
      setMessages((prev) => [...prev, tempMessage])

      // Determine file extension based on MIME type
      let fileExtension = ".mp3"
      if (audioBlob.type.includes("webm")) {
        fileExtension = ".webm"
      } else if (audioBlob.type.includes("ogg")) {
        fileExtension = ".ogg"
      } else if (audioBlob.type.includes("wav")) {
        fileExtension = ".wav"
      }

      // Create a unique filename
      const filename = `voice_${Date.now()}${fileExtension}`
      const audioRef = storageRef(storage, `voice_messages/${selectedChat}/${filename}`)
      console.log("Uploading to:", audioRef.fullPath, "with type:", audioBlob.type)

      const uploadTask = uploadBytesResumable(audioRef, audioBlob)

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          console.log(`Upload progress: ${progress.toFixed(1)}%`)
        },
        (error) => {
          console.error("Error uploading voice message:", error)
          // Remove the temporary message on error
          setMessages((prev) => prev.filter((msg) => msg.id !== tempMessageId))
          setPendingVoiceMessages((prev) => {
            const newState = { ...prev }
            delete newState[tempMessageId]
            return newState
          })
          alert(`Failed to upload voice message: ${error.message}`)
        },
        async () => {
          try {
            // Upload completed successfully
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            console.log("Voice message uploaded successfully, URL:", downloadURL)

            // Create a permanent message in Firebase
            const messagesRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}/messages`)
            const newMessageRef = push(messagesRef)

            const messageData: any = {
              text: "Sent a voice message",
              senderId: currentUser.id,
              timestamp: serverTimestamp(),
              reactions: {},
              audioUrl: downloadURL,
              audioDuration: duration,
            }

            if (isGroup) {
              // For groups, initialize readBy with current user
              messageData.readBy = { [currentUser.id]: true }
            } else {
              // For direct chats, set receiverId and read status
              messageData.receiverId = selectedUser?.id
              messageData.read = false
            }

            await set(newMessageRef, messageData)

            // Update last message in chat - FIXED: Don't include receiverId for groups
            const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
            const lastMessageData: any = {
              id: newMessageRef.key,
              text: "Sent a voice message",
              senderId: currentUser.id,
              timestamp: new Date().toISOString(),
              read: false,
              audioUrl: downloadURL,
              audioDuration: duration,
            }

            // Only add receiverId for direct chats, NOT for groups
            if (!isGroup && selectedUser) {
              lastMessageData.receiverId = selectedUser.id
            }

            // Add readBy for groups
            if (isGroup) {
              lastMessageData.readBy = { [currentUser.id]: true }
            }

            await update(chatRef, {
              lastMessage: lastMessageData,
              updatedAt: serverTimestamp(),
            })

            // Send push notification
            if (isGroup && groupData) {
              // For groups, notify all members except the sender
              const participantIds = Array.isArray(groupData.participants)
                ? groupData.participants
                : Object.keys(groupData.participants || {})

              participantIds.forEach(async (participantId) => {
                if (participantId !== currentUser.id && !isUserOnline(participantId)) {
                  try {
                    await sendMessageNotification(
                      participantId,
                      `${currentUser.username} in ${groupData.name}`,
                      "Sent you a voice message",
                      selectedChat,
                      currentUser.photoURL,
                    )
                  } catch (error) {
                    console.error("Error sending group notification:", error)
                  }
                }
              })
            } else if (selectedUser && !isUserOnline(selectedUser.id)) {
              // For direct chats, notify the other user if they're offline
              try {
                await sendMessageNotification(
                  selectedUser.id,
                  currentUser.username,
                  "Sent you a voice message",
                  selectedChat,
                  currentUser.photoURL,
                )
              } catch (error) {
                console.error("Error sending notification:", error)
              }
            }

            // Remove the temporary message from our pending list
            setPendingVoiceMessages((prev) => {
              const newState = { ...prev }
              delete newState[tempMessageId]
              return newState
            })

            // The real message will be added via the Firebase listener
            // We can revoke the temporary URL to free memory
            URL.revokeObjectURL(localAudioUrl)
          } catch (error) {
            console.error("Error finalizing voice message:", error)
          }
        },
      )

      // Close the voice recorder
      setIsRecordingVoice(false)
    } catch (error: any) {
      console.error("Error handling voice message:", error)
      alert(`Failed to process voice message: ${error.message}`)
      setIsRecordingVoice(false)
    }
  }

  const handleDeleteChat = async () => {
    if (!selectedChat) return

    try {
      // Delete the chat document in Realtime Database
      const chatRef = dbRef(db, `chats/${selectedChat}`)
      await remove(chatRef)

      // Close dialog first
      setShowDeleteDialog(false)

      // Clear selected chat
      setSelectedChat(null)

      // Go back to sidebar on mobile
      if (isMobileView && onBackClick) {
        onBackClick()
      }
    } catch (error: any) {
      console.error("Error deleting chat:", error)
      alert(`Failed to delete chat: ${error.message}`)
      setShowDeleteDialog(false)
    }
  }

  const handleAddReaction = async (messageId: string) => {
    if (!currentUser || !selectedChat) return

    try {
      // Fixed: Use correct path for both direct chats and groups
      const messageRef = dbRef(
        db,
        `${isGroup ? "groups" : "chats"}/${selectedChat}/messages/${messageId}/reactions/${currentUser.id}`,
      )
      await set(messageRef, "❤️")
    } catch (error) {
      console.error("Error adding reaction:", error)
    }
  }

  // New function to delete a single message
  const handleDeleteMessage = async (message: Message) => {
    if (!currentUser || !selectedChat) return

    // Only allow users to delete their own messages
    if (message.senderId !== currentUser.id) return

    if (!window.confirm("Are you sure you want to delete this message?")) return

    try {
      setDeletingMessages((prev) => ({ ...prev, [message.id]: true }))

      // Delete the message from Firebase
      const messageRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}/messages/${message.id}`)

      // If this message has media, delete it from storage first
      if (message.imageUrl) {
        try {
          // Extract the path from the URL
          const urlPath = message.imageUrl.split("?")[0].split("/o/")[1]
          if (urlPath) {
            const decodedPath = decodeURIComponent(urlPath)
            const imageRef = storageRef(storage, decodedPath)
            await deleteObject(imageRef)
          }
        } catch (storageError) {
          console.error("Error deleting image from storage:", storageError)
          // Continue with message deletion even if storage deletion fails
        }
      }

      if (message.videoUrl) {
        try {
          const urlPath = message.videoUrl.split("?")[0].split("/o/")[1]
          if (urlPath) {
            const decodedPath = decodeURIComponent(urlPath)
            const videoRef = storageRef(storage, decodedPath)
            await deleteObject(videoRef)
          }
        } catch (storageError) {
          console.error("Error deleting video from storage:", storageError)
        }
      }

      if (message.audioUrl) {
        try {
          const urlPath = message.audioUrl.split("?")[0].split("/o/")[1]
          if (urlPath) {
            const decodedPath = decodeURIComponent(urlPath)
            const audioRef = storageRef(storage, decodedPath)
            await deleteObject(audioRef)
          }
        } catch (storageError) {
          console.error("Error deleting audio from storage:", storageError)
        }
      }

      // Delete the message from the database
      const msgRef = dbRef(db, `messages/${selectedChat}/${message.id}`)
      await remove(msgRef)

      // If this was the last message in the chat, update the last message
      const chatRef = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
      const lastMessage = messages[messages.length - 1]

      if (lastMessage && lastMessage.id === message.id) {
        // Find the new last message (second to last)
        const newLastMessage = messages.length > 1 ? messages[messages.length - 2] : null

        if (newLastMessage) {
          // Update the last message in the chat - FIXED: Don't include receiverId for groups
          const lastMessageData: any = {
            id: newLastMessage.id,
            text: newLastMessage.text,
            senderId: newLastMessage.senderId,
            timestamp: newLastMessage.timestamp.toISOString(),
            read: newLastMessage.read,
            ...(newLastMessage.imageUrl ? { imageUrl: newLastMessage.imageUrl } : {}),
            ...(newLastMessage.videoUrl ? { videoUrl: newLastMessage.videoUrl } : {}),
            ...(newLastMessage.audioUrl
              ? { audioUrl: newLastMessage.audioUrl, audioDuration: newLastMessage.audioDuration }
              : {}),
          }

          // Only add receiverId for direct chats, NOT for groups
          if (!isGroup) {
            lastMessageData.receiverId = newLastMessage.receiverId
          }

          // Add readBy for groups
          if (isGroup) {
            lastMessageData.readBy = newLastMessage.readBy || {}
          }

          await update(chatRef, {
            lastMessage: lastMessageData,
            updatedAt: serverTimestamp(),
          })
        } else {
          // If there are no more messages, remove the lastMessage field
          // CHECK: If no messsages left at all, user wants to DELETE the chat completely
          // Check the extracted messages node
          const messagesAfterDeleteRef = dbRef(db, `messages/${selectedChat}`)
          const snapshot = await get(messagesAfterDeleteRef)

          if (!snapshot.exists() || snapshot.size === 0) {
            console.log("Chat is empty after deletion. Removing chat...")
            const chatRefFull = dbRef(db, `${isGroup ? "groups" : "chats"}/${selectedChat}`)
            await remove(chatRefFull)

            // If it's a direct chat, we should also clean up userChats references if we want to be thorough,
            // but normally the Sidebar handles "orphaned" chats by checking if they exist.
            // For now, removing the chat node is the key request.
            setSelectedChat(null)
            if (isMobileView && onBackClick) onBackClick()
          } else {
            await update(chatRef, {
              lastMessage: null,
              updatedAt: serverTimestamp(),
            })
          }
        }
      }

      setDeletingMessages((prev) => {
        const newState = { ...prev }
        delete newState[message.id]
        return newState
      })
    } catch (error: any) {
      console.error("Error deleting message:", error)
      alert(`Failed to delete message: ${error.message}`)
      setDeletingMessages((prev) => {
        const newState = { ...prev }
        delete newState[message.id]
        return newState
      })
    }
  }

  // Check if the current user has reacted to a message
  const hasUserReacted = (message: Message) => {
    return currentUser && message.reactions && message.reactions[currentUser.id] === "❤️"
  }

  // Format time as mm:ss
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  if (!selectedChat) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(to bottom right, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))",
          backdropFilter: "blur(24px)",
          position: "relative",
        }}
        className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl relative"
      >
        {/* Floating Elements */}
        <div className="absolute top-10 left-10 w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-30 animate-pulse"></div>
        <div className="absolute top-32 right-16 w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-40 animate-ping"></div>
        <div className="absolute bottom-20 left-20 w-1 h-1 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full opacity-50 animate-bounce"></div>

        <div style={{ textAlign: "center" }} className="text-center space-y-4">
          <div
            style={{
              width: "80px",
              height: "80px",
              background: "linear-gradient(to right, #3b82f6, #9333ea)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
              boxShadow: "0 10px 25px rgba(59, 130, 246, 0.25)",
            }}
            className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25 animate-pulse"
          >
            <Sparkles className="h-8 w-8 text-white animate-spin" style={{ animationDuration: "3s", color: "white" }} />
          </div>
          <h3
            style={{
              fontSize: "20px",
              fontWeight: "bold",
              color: "white",
              background: "linear-gradient(to right, #60a5fa, #a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
            className="text-xl font-bold text-white bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
          >
            Select a chat to start messaging
          </h3>
          <p style={{ color: "#94a3b8" }} className="text-slate-400">
            Or search for a user to start a new conversation
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background:
          "linear-gradient(to bottom right, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))",
        backdropFilter: "blur(24px)",
        position: "relative",
      }}
      className="flex-1 flex flex-col bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl relative"
    >
      {/* Floating Elements */}
      <div className="absolute top-4 right-4 w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-40 animate-ping"></div>
      <div className="absolute top-20 right-8 w-1 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-30 animate-pulse"></div>

      {/* Chat Header */}
      <div
        style={{
          padding: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "linear-gradient(to right, rgba(30, 41, 59, 0.5), rgba(51, 65, 85, 0.5))",
          borderBottom: "1px solid rgba(51, 65, 85, 0.5)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Back button for mobile */}
          {isMobileView && onBackClick && (
            <button
              onClick={onBackClick}
              style={{
                marginRight: "4px",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: "rgb(148, 163, 184)",
                cursor: "pointer",
                borderRadius: "8px",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "white"
                e.currentTarget.style.background = "linear-gradient(to right, rgb(51, 65, 85), rgb(71, 85, 105))"
                e.currentTarget.style.transform = "scale(1.1)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgb(148, 163, 184)"
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.transform = "scale(1)"
              }}
            >
              <ArrowLeft style={{ height: "20px", width: "20px" }} />
            </button>
          )}

          {isGroup && groupData ? (
            <>
              <div
                style={{
                  position: "relative",
                  width: "48px",
                  height: "48px",
                  overflow: "hidden",
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: "linear-gradient(to right, rgb(59, 130, 246), rgb(168, 85, 247))",
                  padding: "2px",
                  boxShadow: "0 0 15px rgba(59, 130, 246, 0.25)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "rgb(30, 41, 59)",
                  }}
                >
                  <Image
                    src={groupData.photoURL || "/placeholder.svg"}
                    alt={groupData.name || "Group"}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    background: "linear-gradient(to right, rgb(168, 85, 247), rgb(236, 72, 153))",
                    borderRadius: "50%",
                    padding: "4px",
                  }}
                >
                  <Users style={{ height: "12px", width: "12px", color: "white" }} />
                </div>
              </div>
              <div>
                <h2 style={{ fontWeight: 600, color: "white", fontSize: "18px", margin: 0 }}>{groupData.name}</h2>
                <p style={{ fontSize: "12px", color: "rgb(148, 163, 184)", margin: 0 }}>
                  {Array.isArray(groupData.participants)
                    ? `${groupData.participants.length} members`
                    : `${Object.keys(groupData.participants || {}).length} members`}
                </p>
              </div>
            </>
          ) : selectedUser ? (
            <>
              <div
                style={{
                  position: "relative",
                  width: "48px",
                  height: "48px",
                  overflow: "hidden",
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: "linear-gradient(to right, rgb(59, 130, 246), rgb(168, 85, 247))",
                  padding: "2px",
                  boxShadow: "0 0 15px rgba(59, 130, 246, 0.25)",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "rgb(30, 41, 59)",
                  }}
                >
                  <Image
                    src={selectedUser.photoURL || "/placeholder.svg"}
                    alt={selectedUser.username}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
                {isUserOnline(selectedUser.id) && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "-4px",
                      right: "-4px",
                      width: "16px",
                      height: "16px",
                      background: "linear-gradient(to right, rgb(74, 222, 128), rgb(16, 185, 129))",
                      borderRadius: "50%",
                      border: "2px solid rgb(15, 23, 42)",
                      boxShadow: "0 0 15px rgba(74, 222, 128, 0.25)",
                      animation: "pulse 2s infinite",
                    }}
                  ></div>
                )}
              </div>
              <div>
                <h2 style={{ fontWeight: 600, color: "white", fontSize: "18px", margin: 0 }}>
                  {selectedUser.username}
                </h2>
                <p style={{ fontSize: "12px", color: "rgb(148, 163, 184)", margin: 0 }}>
                  {isUserOnline(selectedUser.id) ? (
                    <span style={{ color: "rgb(52, 211, 153)", fontWeight: 500 }}>Online</span>
                  ) : selectedUser.lastSeen ? (
                    `Last seen ${safeFormatDistanceToNow(selectedUser.lastSeen)}`
                  ) : (
                    "Offline"
                  )}
                </p>
              </div>
            </>
          ) : null}
        </div>

        {/* Header actions */}
        {selectedChat && (
          <button
            onClick={() => setShowDeleteDialog(true)}
            style={{
              width: "40px",
              height: "40px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "8px",
              color: "rgb(248, 113, 113)",
              cursor: "pointer",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"
              e.currentTarget.style.transform = "scale(1.1)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"
              e.currentTarget.style.transform = "scale(1)"
            }}
          >
            <Trash2 style={{ height: "18px", width: "18px" }} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 p-4 overflow-y-auto"
        style={{
          background: "#000000"
        }}
      >
        {messagesError ? (
          <div className="flex flex-col items-center justify-center h-full">
            <Alert
              variant="destructive"
              className="mb-4 max-w-md bg-gradient-to-r from-red-900/30 to-red-800/30 border-red-700/50 backdrop-blur-sm"
            >
              <AlertDescription className="text-red-200">{messagesError}</AlertDescription>
            </Alert>
            <Button
              onClick={() => {
                // Force refresh the messages
                setMessagesError(null)
                // This will trigger the useEffect again
                const chatId = selectedChat
                setSelectedChat(null)
                setTimeout(() => setSelectedChat(chatId), 100)
              }}
              className="mt-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25 animate-pulse">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-500/25 animate-pulse">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <p className="text-slate-400">No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isCurrentUser = message.senderId === currentUser?.id
              const sender = getSenderInfo(message.senderId)
              const reactionCount = message.reactions ? Object.keys(message.reactions).length : 0
              const isPending = pendingVoiceMessages[message.id] || message.isPending
              const isDeleting = deletingMessages[message.id]
              const readCount = getReadCount(message)
              const totalParticipants = getTotalParticipants()

              return (
                <div key={message.id} className={`mb-4 flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex items-start space-x-2 ${isCurrentUser ? "w-[70%] flex-row-reverse space-x-reverse" : "w-[70%]"}`}
                  >
                    {/* Show avatar for group messages from other users */}
                    {isGroup && !isCurrentUser && (
                      <div className="relative w-8 h-8 overflow-hidden rounded-full flex-shrink-0 bg-gradient-to-r from-blue-500 to-purple-500 p-0.5">
                        <div className="w-full h-full rounded-full overflow-hidden bg-slate-800">
                          <Image
                            src={sender.photoURL || "/placeholder.svg"}
                            alt={sender.username || "User"}
                            fill
                            className="object-cover"
                          />
                        </div>
                      </div>
                    )}

                    <div
                      className={`message-bubble relative w-full ${isPending ? "opacity-70" : ""} ${isDeleting ? "opacity-50" : ""}`}
                    >
                      {/* Show sender name for group messages */}
                      {isGroup && !isCurrentUser && (
                        <div className="text-xs text-slate-400 mb-1 px-3 pt-2 font-medium">{sender.username}</div>
                      )}

                      {/* Delete button - Always visible for current user's messages */}
                      {isCurrentUser && !isPending && !isDeleting && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMessage(message)}
                          className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-full z-10 shadow-lg shadow-red-500/25 transition-all duration-300 hover:scale-110"
                          title="Delete message"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}

                      {message.imageUrl && (
                        <div className="p-2 w-full">
                          <div
                            className="image-container cursor-pointer relative w-full group"
                            onClick={() => setExpandedImage(message.imageUrl || null)}
                          >
                            <img
                              src={message.imageUrl || "/placeholder.svg"}
                              alt="Image"
                              className="message-image w-full max-h-[300px] object-contain rounded-xl shadow-lg transition-all duration-300 group-hover:scale-[1.02]"
                            />
                            <div className="absolute top-3 right-3 bg-gradient-to-r from-black/60 to-black/40 rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm">
                              <Maximize className="h-4 w-4 text-white" />
                            </div>
                          </div>

                          <div
                            className={`text-xs mt-2 flex items-center justify-between ${isCurrentUser ? "text-white/70" : "text-slate-400"
                              }`}
                          >
                            <div className="flex items-center space-x-2">
                              {!hasUserReacted(message) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddReaction(message.id)}
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 hover:scale-110"
                                >
                                  <Heart className="h-3 w-3" />
                                </Button>
                              )}
                              {reactionCount > 0 && (
                                <span className="flex items-center text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
                                  <Heart className="h-3 w-3 mr-1 fill-current" />
                                  {reactionCount}
                                </span>
                              )}
                            </div>
                            <span className="font-medium">
                              {message.timestamp && (
                                <span>
                                  {new Date(message.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="ml-2">
                                  {isPending
                                    ? "..."
                                    : isGroup
                                      ? readCount > 1
                                        ? `Seen by ${readCount}/${totalParticipants}`
                                        : "✓"
                                      : message.read
                                        ? "✓✓"
                                        : "✓"}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      {message.videoUrl && (
                        <div className="p-2 w-full">
                          <video
                            src={message.videoUrl}
                            controls
                            className="message-video w-full max-h-[300px] rounded-xl shadow-lg"
                          />

                          <div
                            className={`text-xs mt-2 flex items-center justify-between ${isCurrentUser ? "text-white/70" : "text-slate-400"
                              }`}
                          >
                            <div className="flex items-center space-x-2">
                              {!hasUserReacted(message) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddReaction(message.id)}
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 hover:scale-110"
                                >
                                  <Heart className="h-3 w-3" />
                                </Button>
                              )}
                              {reactionCount > 0 && (
                                <span className="flex items-center text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
                                  <Heart className="h-3 w-3 mr-1 fill-current" />
                                  {reactionCount}
                                </span>
                              )}
                            </div>
                            <span className="font-medium">
                              {message.timestamp && (
                                <span>
                                  {new Date(message.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="ml-2">
                                  {isPending
                                    ? "..."
                                    : isGroup
                                      ? readCount > 1
                                        ? `Seen by ${readCount}/${totalParticipants}`
                                        : "✓"
                                      : message.read
                                        ? "✓✓"
                                        : "✓"}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      {message.audioUrl && (
                        <div className="voice-message-wrapper w-full">
                          <VoiceMessage
                            audioUrl={message.audioUrl}
                            duration={message.audioDuration || 0}
                            isCurrentUser={isCurrentUser}
                          />

                          <div
                            className={`text-xs px-2 pb-2 flex items-center justify-between ${isCurrentUser ? "text-white/70" : "text-slate-400"
                              }`}
                          >
                            <div className="flex items-center space-x-2">
                              {!hasUserReacted(message) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddReaction(message.id)}
                                  className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 hover:scale-110"
                                >
                                  <Heart className="h-3 w-3" />
                                </Button>
                              )}
                              {reactionCount > 0 && (
                                <span className="flex items-center text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
                                  <Heart className="h-3 w-3 mr-1 fill-current" />
                                  {reactionCount}
                                </span>
                              )}
                            </div>
                            <span className="font-medium">
                              {message.timestamp && (
                                <span>
                                  {new Date(message.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="ml-2">
                                  {isPending
                                    ? "..."
                                    : isGroup
                                      ? readCount > 1
                                        ? `Seen by ${readCount}/${totalParticipants}`
                                        : "✓"
                                      : message.read
                                        ? "✓✓"
                                        : "✓"}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      {message.text && !message.audioUrl && !message.imageUrl && !message.videoUrl && (
                        <div
                          className={`px-6 py-4 ${isCurrentUser
                            ? "bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25"
                            : "bg-gradient-to-r from-slate-700 to-slate-600 shadow-lg shadow-slate-700/25"
                            } rounded-xl w-full backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]`}
                        >
                          <p className="text-white break-words whitespace-pre-wrap text-base leading-relaxed font-medium">
                            {message.text}
                          </p>

                          <div
                            className={`text-xs mt-3 flex items-center justify-between ${isCurrentUser ? "text-white/70" : "text-slate-300"
                              }`}
                          >
                            <div className="flex items-center space-x-2">
                              {!hasUserReacted(message) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddReaction(message.id)}
                                  className="h-6 w-6 p-0 text-slate-300 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 hover:scale-110"
                                >
                                  <Heart className="h-3 w-3" />
                                </Button>
                              )}
                              {reactionCount > 0 && (
                                <span className="flex items-center text-red-400 bg-red-500/10 px-2 py-1 rounded-full">
                                  <Heart className="h-3 w-3 mr-1 fill-current" />
                                  {reactionCount}
                                </span>
                              )}
                            </div>
                            <span className="ml-4 font-medium">
                              {message.timestamp && (
                                <span>
                                  {new Date(message.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                              {isCurrentUser && (
                                <span className="ml-2">
                                  {isPending
                                    ? "..."
                                    : isGroup
                                      ? readCount > 1
                                        ? `Seen by ${readCount}/${totalParticipants}`
                                        : "✓"
                                      : message.read
                                        ? "✓✓"
                                        : "✓"}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {selectedChat && currentUser && !isGroup && (
        <TypingIndicator chatId={selectedChat} currentUserId={currentUser.id} />
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-slate-700/50 backdrop-blur-sm" style={{
        background: 'linear-gradient(135deg, rgba(30, 30, 30, 0.95) 0%, rgba(20, 20, 20, 0.98) 100%)'
      }}>
        {isUploading && !isRecordingVoice && (
          <div className="mb-3">
            <div className="h-2 rounded-xl overflow-hidden" style={{
              background: 'linear-gradient(90deg, rgba(40, 40, 40, 0.8) 0%, rgba(30, 30, 30, 0.8) 100%)'
            }}>
              <div
                className="h-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl transition-all duration-300"
                style={{
                  width: `${uploadProgress}%`,
                  boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                }}
              ></div>
            </div>
            <p className="text-xs text-slate-400 mt-2 font-medium">Uploading... {Math.round(uploadProgress)}%</p>
          </div>
        )}

        <div className="relative">
          {isRecordingVoice ? (
            <VoiceRecorder onVoiceRecorded={handleVoiceRecorded} onCancel={() => setIsRecordingVoice(false)} />
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-xl h-11 w-11 p-0 flex-shrink-0 transition-all duration-300 border-none"
                style={{
                  background: 'linear-gradient(180deg, rgb(56, 56, 56) 0%, rgb(36, 36, 36) 66%, rgb(41, 41, 41) 100%)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)'
                }}
              >
                <Paperclip className="h-4 w-4 text-slate-300" />
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*,video/*"
                  className="hidden"
                />
              </Button>

              <div className="flex-1 relative">
                <Textarea
                  placeholder={`Message${isGroup ? " group" : ""}...`}
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    handleTyping()
                  }}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-xl border text-white placeholder-slate-400 min-h-[44px] max-h-[100px] py-3 px-4 resize-none transition-all duration-300 text-base"
                  style={{
                    background: 'rgba(30, 30, 30, 0.6)',
                    borderColor: 'rgba(255, 255, 255, 0.08)',
                    backdropFilter: 'blur(10px)'
                  }}
                  rows={1}
                  disabled={isUploading}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`rounded-xl h-11 w-11 p-0 flex-shrink-0 transition-all duration-300 border-none ${autoDeleteSetting !== "never"
                      ? "text-white"
                      : "text-slate-300"
                      }`}
                    style={{
                      background: autoDeleteSetting !== "never"
                        ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(249, 115, 22, 0.9) 100%)'
                        : 'linear-gradient(180deg, rgb(56, 56, 56) 0%, rgb(36, 36, 36) 66%, rgb(41, 41, 41) 100%)',
                      boxShadow: autoDeleteSetting !== "never"
                        ? '0 4px 12px rgba(239, 68, 68, 0.3)'
                        : '0 2px 8px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    <Timer className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl border" style={{
                  background: 'rgba(30, 30, 30, 0.95)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  backdropFilter: 'blur(20px)'
                }}>
                  <DropdownMenuItem onClick={() => handleAutoDeleteChange("never")} className="focus:bg-slate-700/50 text-slate-200 cursor-pointer rounded-lg">
                    Off {autoDeleteSetting === "never" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAutoDeleteChange("1m")} className="focus:bg-slate-700/50 text-slate-200 cursor-pointer rounded-lg">
                    1 min {autoDeleteSetting === "1m" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAutoDeleteChange("5m")} className="focus:bg-slate-700/50 text-slate-200 cursor-pointer rounded-lg">
                    5 min {autoDeleteSetting === "5m" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAutoDeleteChange("1h")} className="focus:bg-slate-700/50 text-slate-200 cursor-pointer rounded-lg">
                    1 hour {autoDeleteSetting === "1h" && "✓"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAutoDeleteChange("24h")} className="focus:bg-slate-700/50 text-slate-200 cursor-pointer rounded-lg">
                    24 hours {autoDeleteSetting === "24h" && "✓"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || isUploading}
                className="rounded-xl h-11 w-11 p-0 flex-shrink-0 transition-all duration-300 disabled:opacity-40 border-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%)',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                }}
              >
                <Send className="h-4 w-4 text-white" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Image Viewer Dialog */}
      <Dialog open={!!expandedImage} onOpenChange={(open) => !open && setExpandedImage(null)}>
        <DialogContent className="max-w-4xl bg-gradient-to-br from-black/95 to-slate-900/95 border-slate-700/50 backdrop-blur-xl">
          <div className="relative">
            <Button
              className="absolute top-2 right-2 bg-gradient-to-r from-black/60 to-black/40 hover:from-black/80 hover:to-black/60 rounded-full p-2 transition-all duration-300 hover:scale-110 backdrop-blur-sm"
              size="icon"
              onClick={() => setExpandedImage(null)}
            >
              <X className="h-5 w-5 text-white" />
            </Button>
            {expandedImage && (
              <img
                src={expandedImage || "/placeholder.svg"}
                alt="Expanded image"
                className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Members Modal */}
      {isGroup && (
        <GroupMembersModal
          isOpen={showGroupMembers}
          onClose={() => setShowGroupMembers(false)}
          group={groupData}
          currentUser={currentUser}
          users={users}
        />
      )}

      {/* Delete Chat Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px] bg-gradient-to-br from-slate-900/95 to-slate-800/95 border-slate-700/50 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Chat</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete this {isGroup ? "group" : "chat"}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeleteDialog(false)}
              className="hover:bg-slate-700/30 hover:text-white"
            >
              Cancel
            </Button>
            <Button onClick={handleDeleteChat} className="bg-red-600 hover:bg-red-700 focus:ring-red-500">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
