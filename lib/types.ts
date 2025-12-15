export interface User {
  id: string
  username: string
  email: string
  photoURL: string
  publicKey?: string // Base64 encoded public key for E2E encryption
  lastSeen: Date | null
  createdAt: Date
  online?: boolean
  isTyping?: Record<string, boolean> // Track typing status per chat
  isBanned?: boolean
  role?: "user" | "admin" | "moderator"
  payment?: {
    status: "pending" | "verified" | "rejected"
    plan: string
    planName: string
    duration: number
    expiresAt: string
    startedAt?: Date
    updatedAt: Date
  }
  notificationToken?: string // For push notifications
  passcode?: {
    hash: string
    salt: string
    isEnabled: boolean
  }
  // Security lockout fields
  passcodeAttempts?: number
  totalPasscodeAttempts?: number
  lockoutUntil?: number // Unix timestamp
  lastFailedAttempt?: Date
}

export interface Message {
  id: string
  text: string | null
  encryptedText?: string // Encrypted message content
  encryptedKey?: string // AES key encrypted with recipient's RSA public key
  iv?: string // Initialization vector for AES
  encryptedTextAdmin?: string // Encrypted for admin
  encryptedKeyAdmin?: string // AES key encrypted with admin's RSA public key
  ivAdmin?: string // IV for admin decryption
  senderId: string
  receiverId?: string // Optional for group chats
  timestamp: Date
  read: boolean
  readBy?: Record<string, boolean> // For group chats - tracks who has read the message
  readAt?: number // Unix timestamp when message was read (for auto-delete timer)
  expiresAt?: number // Unix timestamp when message should be deleted
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
  audioDuration?: number
  reactions?: Record<string, string>
  isPending?: boolean
  isPinned?: boolean
}

export interface Chat {
  id: string
  participants: string[] | Record<string, boolean> // Updated to handle both array and object formats
  lastMessage?: Message
  createdAt: Date
  updatedAt: Date
  typingUsers?: Record<string, boolean> // Track who is typing in this chat
  isGroup?: boolean // Flag to distinguish between direct chats and group chats
  name?: string // Group name (only for groups)
  description?: string // Group description (only for groups)
  photoURL?: string // Group photo (only for groups)
  createdBy?: string // Who created the group (only for groups)
  admins?: string[] | Record<string, boolean> // Group admins (only for groups)
  // Auto-delete settings
  autoDeleteAfter?: "never" | "1m" | "5m" | "1h" | "24h" // Timer starts after message is read
}

export interface Payment {
  userId: string
  plan: string
  planName: string
  amount: number
  duration: number
  method: "xbon" | "crypto"
  code?: string
  status: "pending" | "verified" | "rejected"
  createdAt: Date
  verifiedAt?: Date
}

export interface Announcement {
  id: string
  title: string
  content: string
  createdAt: Date
  expiresAt?: Date
  isPinned: boolean
  targetUsers: string[] | null // null means all users
  createdBy: string
  readBy: Record<string, boolean>
}

export interface NotificationSubscription {
  userId: string
  token: string
  device: string
  createdAt: Date
  lastUsed: Date
}

export interface SecurityIncident {
  id: string
  userId: string
  username: string
  incidentType: "lockout" | "account_deleted"
  message: string
  timestamp: Date
  read: boolean
}

export interface AdminNotification {
  id: string
  type: "security_incident" | "payment" | "report"
  incidentType?: "lockout" | "account_deleted"
  userId?: string
  username?: string
  message: string
  timestamp: Date
  read: boolean
}
