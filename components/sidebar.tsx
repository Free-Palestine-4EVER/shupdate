"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import type { User, Chat } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
// No longer need Input and Button from shadcn/ui, replaced with inline styles and native elements
// import { Input } from "@/components/ui/input"
// import { Button } from "@/components/ui/button"
import { Search, Settings, LogOut, Shield, Users, Sparkles } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { signOut } from "firebase/auth"
import { ref, push, set, serverTimestamp, onValue } from "firebase/database"
import CreateGroupModal from "@/components/create-group-modal"

interface SidebarProps {
  currentUser: User | null
  chats: Chat[]
  groups: Chat[]
  users: User[]
  selectedChat: string | null
  onChatSelect: (chatId: string, userId?: string) => void
  onGroupSelect: (groupId: string) => void
  onSettingsOpen: () => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  filteredUsers: User[]
  selectedServer?: string | null
  isMobileView?: boolean // Added for responsive design
}

// Map server IDs to readable names
const serverNames: Record<string, string> = {
  russia: "Russia",
  hongkong: "Hong Kong",
  malta: "Malta",
  china: "China",
}

// Admin user ID - this should match your admin user ID
const ADMIN_USER_ID = "zzzz" // Replace with your actual admin user ID if different

export default function Sidebar({
  currentUser,
  chats,
  groups,
  users,
  selectedChat,
  onChatSelect,
  onGroupSelect,
  onSettingsOpen,
  searchQuery,
  setSearchQuery,
  filteredUsers,
  selectedServer,
  isMobileView = false,
}: SidebarProps) {
  const [isSearching, setIsSearching] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<"chats" | "groups">("chats")
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  // Added state for server selection modal
  const [showServerSelection, setShowServerSelection] = useState(false)

  // Listen for presence changes
  useEffect(() => {
    if (!db) return

    // Listen to both status and presence nodes for redundancy
    const statusRef = ref(db, "status")
    const presenceRef = ref(db, "presence")

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

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const startNewChat = async (userId: string) => {
    if (!currentUser) return

    try {
      // Check if chat already exists
      const existingChat = chats.find(
        (chat) =>
          chat.participants.includes(userId) &&
          chat.participants.length === 2 &&
          chat.participants.includes(currentUser.id),
      )

      if (existingChat) {
        onChatSelect(existingChat.id, userId)
        setSearchQuery("")
        setIsSearching(false)
        return
      }

      // Create new chat in Realtime Database
      const chatsRef = ref(db, "chats")
      const newChatRef = push(chatsRef)

      await set(newChatRef, {
        participants: [currentUser.id, userId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      onChatSelect(newChatRef.key || "", userId)
      setSearchQuery("")
      setIsSearching(false)
    } catch (error: any) {
      console.error("Error creating new chat:", error)
      alert("Failed to create new chat. Please check your connection.")
    }
  }

  // Added a handler for when a user is clicked in the search results
  const handleUserClick = (userId: string) => {
    startNewChat(userId)
  }

  const getChatName = (chat: Chat) => {
    if (!currentUser) return ""

    // If it's a group, return the group name
    if (chat.isGroup) {
      return chat.name || "Unnamed Group"
    }

    let otherParticipantId: string | undefined

    // Check if participants is an array
    if (Array.isArray(chat.participants)) {
      otherParticipantId = chat.participants.find((p) => p !== currentUser.id)
    }
    // If it's an object with keys
    else if (typeof chat.participants === "object") {
      otherParticipantId = Object.keys(chat.participants).find((id) => id !== currentUser.id)
    }

    if (!otherParticipantId) return ""

    const otherUser = users.find((u) => u.id === otherParticipantId)
    return otherUser?.username || "Unknown User"
  }

  const getChatAvatar = (chat: Chat) => {
    if (!currentUser) return ""

    // If it's a group, return the group photo
    if (chat.isGroup) {
      return (
        chat.photoURL ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name || "Group")}&background=random`
      )
    }

    let otherParticipantId: string | undefined

    // Check if participants is an array
    if (Array.isArray(chat.participants)) {
      otherParticipantId = chat.participants.find((p) => p !== currentUser.id)
    }
    // If it's an object with keys
    else if (typeof chat.participants === "object") {
      otherParticipantId = Object.keys(chat.participants).find((id) => id !== currentUser.id)
    }

    if (!otherParticipantId) return ""

    const otherUser = users.find((u) => u.id === otherParticipantId)
    return otherUser?.photoURL || ""
  }

  const getLastMessage = (chat: Chat) => {
    if (!chat.lastMessage) return ""

    if (chat.lastMessage.imageUrl) {
      return "📷 Image"
    }

    if (chat.lastMessage.videoUrl) {
      return "🎥 Video"
    }

    if (chat.lastMessage.audioUrl) {
      return "🎵 Voice message"
    }

    const text = chat.lastMessage.text || ""
    return text.length > 35 ? text.substring(0, 35) + "..." : text
  }

  const getParticipantCount = (chat: Chat) => {
    if (!chat.isGroup) return 0

    if (Array.isArray(chat.participants)) {
      return chat.participants.length
    } else if (typeof chat.participants === "object") {
      return Object.keys(chat.participants).length
    }
    return 0
  }

  // Check if a user is online using the presence data
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

  // Ensure currentUser has required fields
  const hasValidUserData = currentUser && currentUser.username && currentUser.photoURL

  // Get server name from ID
  const getServerName = (serverId: string | null) => {
    if (!serverId) return null
    return serverNames[serverId] || serverId
  }

  const handleGroupCreated = (groupId: string) => {
    onGroupSelect(groupId)
    setActiveTab("groups")
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: isMobileView ? "100%" : "320px",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#000000",
        borderRight: "1px solid rgba(255, 255, 255, 0.1)",
        overflow: "hidden",
      }}
    >
      {/* Floating Elements */}
      <div className="absolute top-4 right-4 w-2 h-2 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-60 animate-ping"></div>
      <div className="absolute top-20 right-8 w-1 h-1 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-40 animate-pulse"></div>

      {/* Header */}
      {/* Replaced with inline styles */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid rgba(51, 65, 85, 0.5)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {hasValidUserData ? (
              <>
                {/* Avatar and user info */}
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
                      src={currentUser.photoURL || "/placeholder.svg"}
                      alt={currentUser.username}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  {/* Online indicator */}
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
                </div>
                <div>
                  {/* Username */}
                  <h3 style={{ fontSize: "16px", fontWeight: 600, color: "white", margin: 0 }}>
                    {currentUser.username}
                  </h3>
                  {/* Status */}
                  <p style={{ fontSize: "12px", color: "rgb(148, 163, 184)", margin: 0 }}>Online</p>
                </div>
              </>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {/* Settings Button */}
            <button
              onClick={onSettingsOpen}
              style={{
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(51, 65, 85, 0.5)",
                borderRadius: "8px",
                color: "rgb(148, 163, 184)",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              <Settings className="h-5 w-5" />
            </button>
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              style={{
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(30, 41, 59, 0.5)",
                border: "1px solid rgba(51, 65, 85, 0.5)",
                borderRadius: "8px",
                color: "rgb(148, 163, 184)",
                cursor: "pointer",
                transition: "all 0.3s",
              }}
            >
              <LogOut className="h-5 w-5" />
            </button>
            {/* Server Selection Button - Admin Only */}
            {currentUser?.id === ADMIN_USER_ID && (
              <button
                onClick={() => setShowServerSelection(true)}
                style={{
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(30, 41, 59, 0.5)",
                  border: "1px solid rgba(51, 65, 85, 0.5)",
                  borderRadius: "8px",
                  color: "rgb(148, 163, 184)",
                  cursor: "pointer",
                  transition: "all 0.3s",
                }}
              >
                <Shield className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Search */}
      {/* Replaced with inline styles */}
      <div style={{ padding: "16px", borderBottom: "1px solid rgba(51, 65, 85, 0.5)" }}>
        <div style={{ position: "relative" }}>
          {/* Search Icon */}
          <Search
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "18px",
              height: "18px",
              color: "rgb(148, 163, 184)",
            }}
          />
          {/* Input field */}
          <input
            type="text"
            placeholder="Search users"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearching(true)} // Keep this for focus behavior
            style={{
              width: "100%",
              padding: "12px 12px 12px 40px",
              background: "rgba(15, 23, 42, 0.5)",
              border: "1px solid rgba(51, 65, 85, 0.5)",
              borderRadius: "12px",
              color: "white",
              fontSize: isMobileView ? "16px" : "14px",
              outline: "none",
            }}
          />
          {/* Clear search button removed as it's replaced by the Esc key behavior in a typical input */}
        </div>
      </div>

      {/* Tabs */}
      {/* Replaced with inline styles */}
      <div style={{ display: "flex", gap: "8px", padding: "16px", borderBottom: "1px solid rgba(51, 65, 85, 0.5)" }}>
        <button
          onClick={() => setActiveTab("chats")}
          style={{
            flex: 1,
            padding: "12px",
            background:
              activeTab === "chats"
                ? "linear-gradient(to right, rgba(59, 130, 246, 0.2), rgba(168, 85, 247, 0.2))"
                : "rgba(30, 41, 59, 0.5)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            borderRadius: "12px",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.3s",
          }}
        >
          Chats ({chats.length})
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          style={{
            flex: 1,
            padding: "12px",
            background:
              activeTab === "groups"
                ? "linear-gradient(to right, rgba(59, 130, 246, 0.2), rgba(168, 85, 247, 0.2))"
                : "rgba(30, 41, 59, 0.5)",
            border: "1px solid rgba(51, 65, 85, 0.5)",
            borderRadius: "12px",
            color: activeTab === "groups" ? "rgb(96, 165, 250)" : "white",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.3s",
          }}
        >
          Groups ({groups.length})
        </button>
      </div>

      {/* Create Group Button - Removed as it's not part of the updates and was a shadcn component */}

      {/* Chat/Group List or Search Results */}
      {/* Replaced with inline styles */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        {isSearching && searchQuery ? (
          <div style={{ borderTop: "1px solid rgba(51, 65, 85, 0.3)" }}>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleUserClick(user.id)} // Use the new handler
                  style={{
                    padding: "16px",
                    cursor: "pointer",
                    transition: "all 0.3s",
                    background: "transparent",
                    borderBottom: "1px solid rgba(51, 65, 85, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(to right, rgba(30, 41, 59, 0.5), rgba(51, 65, 85, 0.5))"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ position: "relative" }}>
                      <div
                        style={{
                          position: "relative",
                          width: "40px",
                          height: "40px",
                          overflow: "hidden",
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: "linear-gradient(to right, rgb(59, 130, 246), rgb(168, 85, 247))",
                          padding: "2px",
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
                            src={user.photoURL || "/placeholder.svg"}
                            alt={user.username}
                            fill
                            style={{ objectFit: "cover" }}
                          />
                        </div>
                      </div>
                      {isUserOnline(user.id) && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            width: "12px",
                            height: "12px",
                            background: "linear-gradient(to right, rgb(74, 222, 128), rgb(16, 185, 129))",
                            borderRadius: "50%",
                            border: "2px solid rgb(15, 23, 42)",
                            animation: "pulse 2s infinite",
                          }}
                        ></span>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <p
                          style={{
                            fontWeight: 500,
                            color: "white",
                            margin: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.username}
                        </p>
                        {user.id === ADMIN_USER_ID && (
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              background: "linear-gradient(to right, rgb(251, 191, 36), rgb(249, 115, 22))",
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            admin
                          </span>
                        )}
                      </div>
                      {isUserOnline(user.id) ? (
                        <p style={{ fontSize: "12px", color: "rgb(74, 222, 128)", fontWeight: 500, margin: 0 }}>
                          Online
                        </p>
                      ) : user.lastSeen ? (
                        <p style={{ fontSize: "12px", color: "rgb(148, 163, 184)", margin: 0 }}>
                          Last seen {formatDistanceToNow(new Date(user.lastSeen), { addSuffix: true })}
                        </p>
                      ) : (
                        <p style={{ fontSize: "12px", color: "rgb(148, 163, 184)", margin: 0 }}>Offline</p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: "16px", textAlign: "center", color: "rgb(148, 163, 184)" }}>No users found</div>
            )}
          </div>
        ) : (
          <div>
            {activeTab === "chats" ? (
              <>
                {chats.map((chat) => {
                  // Simplified participant finding
                  const otherParticipantId = chat.participants.find((id) => id !== currentUser?.id)
                  const otherUser = users.find((u) => u.id === otherParticipantId)

                  return (
                    <div
                      key={chat.id}
                      onClick={() => onChatSelect(chat.id, otherParticipantId)}
                      style={{
                        padding: "16px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        background:
                          selectedChat === chat.id
                            ? "rgba(255, 255, 255, 0.15)"
                            : "transparent",
                        border: selectedChat === chat.id ? "1px solid rgba(255, 255, 255, 0.5)" : "1px solid transparent",
                        borderRadius: "12px",
                        margin: "4px 8px",
                        backdropFilter: "blur(8px)",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedChat !== chat.id) {
                          e.currentTarget.style.background =
                            "linear-gradient(to right, rgba(30, 41, 59, 0.5), rgba(51, 65, 85, 0.5))"
                          e.currentTarget.style.transform = "scale(1.02)"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedChat !== chat.id) {
                          e.currentTarget.style.background = "transparent"
                          e.currentTarget.style.transform = "scale(1)"
                        }
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ position: "relative" }}>
                          {getChatAvatar(chat) ? (
                            <div
                              style={{
                                position: "relative",
                                width: "40px",
                                height: "40px",
                                overflow: "hidden",
                                borderRadius: "50%",
                                flexShrink: 0,
                                background: "linear-gradient(to right, rgb(59, 130, 246), rgb(168, 85, 247))",
                                padding: "2px",
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
                                  src={getChatAvatar(chat) || "/placeholder.svg"}
                                  alt={getChatName(chat)}
                                  fill
                                  style={{ objectFit: "cover" }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                width: "40px",
                                height: "40px",
                                background: "linear-gradient(to right, rgb(51, 65, 85), rgb(71, 85, 105))",
                                borderRadius: "50%",
                              }}
                            ></div>
                          )}
                          {otherUser && isUserOnline(otherUser.id) && (
                            <span
                              style={{
                                position: "absolute",
                                bottom: 0,
                                right: 0,
                                width: "12px",
                                height: "12px",
                                background: "linear-gradient(to right, rgb(74, 222, 128), rgb(16, 185, 129))",
                                borderRadius: "50%",
                                border: "2px solid rgb(15, 23, 42)",
                                animation: "pulse 2s infinite",
                              }}
                            ></span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <p
                                style={{
                                  fontWeight: 500,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  color: "white",
                                  margin: 0,
                                }}
                              >
                                {getChatName(chat)}
                              </p>
                              {otherParticipantId === ADMIN_USER_ID && (
                                <span
                                  style={{
                                    marginLeft: "8px",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    background: "linear-gradient(to right, rgb(251, 191, 36), rgb(249, 115, 22))",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                  }}
                                >
                                  admin
                                </span>
                              )}
                            </div>
                            {chat.lastMessage && (
                              <p style={{ fontSize: "12px", color: "rgb(148, 163, 184)", margin: 0 }}>
                                {formatDistanceToNow(new Date(chat.lastMessage.timestamp), { addSuffix: true })}
                              </p>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <p
                              style={{
                                fontSize: "14px",
                                color: "rgb(148, 163, 184)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                margin: 0,
                              }}
                            >
                              {getLastMessage(chat)}
                            </p>
                            {chat.lastMessage &&
                              !chat.lastMessage.read &&
                              chat.lastMessage.senderId !== currentUser?.id && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    width: "8px",
                                    height: "8px",
                                    background: "linear-gradient(to right, rgb(59, 130, 246), rgb(168, 85, 247))",
                                    borderRadius: "50%",
                                    animation: "pulse 2s infinite",
                                  }}
                                ></span>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {chats.length === 0 && (
                  <div style={{ padding: "16px", textAlign: "center", color: "rgb(148, 163, 184)" }}>
                    No chats yet. Search for users to start chatting.
                  </div>
                )}
              </>
            ) : (
              <>
                {groups.map((group) => (
                  <div
                    key={group.id}
                    onClick={() => onGroupSelect(group.id)}
                    style={{
                      padding: "16px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      background:
                        selectedChat === group.id
                          ? "rgba(255, 255, 255, 0.15)"
                          : "transparent",
                      border: selectedChat === group.id ? "1px solid rgba(255, 255, 255, 0.5)" : "1px solid transparent",
                      borderRadius: "12px",
                      margin: "4px 8px",
                      backdropFilter: "blur(8px)",
                    }}
                    onMouseEnter={(e) => {
                      if (selectedChat !== group.id) {
                        e.currentTarget.style.background =
                          "linear-gradient(to right, rgba(30, 41, 59, 0.5), rgba(51, 65, 85, 0.5))"
                        e.currentTarget.style.transform = "scale(1.02)"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedChat !== group.id) {
                        e.currentTarget.style.background = "transparent"
                        e.currentTarget.style.transform = "scale(1)"
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          position: "relative",
                          width: "40px",
                          height: "40px",
                          overflow: "hidden",
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: "linear-gradient(to right, rgb(59, 130, 246), rgb(168, 85, 247))",
                          padding: "2px",
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
                            src={getChatAvatar(group) || "/placeholder.svg"}
                            alt={getChatName(group)}
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
                          <Users style={{ height: "8px", width: "8px", color: "white" }} />
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <p
                              style={{
                                fontWeight: 500,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: "white",
                                margin: 0,
                              }}
                            >
                              {getChatName(group)}
                            </p>
                          </div>
                          {group.lastMessage && (
                            <p style={{ fontSize: "12px", color: "rgb(148, 163, 184)", margin: 0 }}>
                              {formatDistanceToNow(new Date(group.lastMessage.timestamp), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <p
                            style={{
                              fontSize: "14px",
                              color: "rgb(148, 163, 184)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              margin: 0,
                            }}
                          >
                            {getLastMessage(group) || `${getParticipantCount(group)} members`}
                          </p>
                          {group.lastMessage &&
                            !group.lastMessage.readBy?.[currentUser?.id || ""] &&
                            group.lastMessage.senderId !== currentUser?.id && (
                              <span
                                style={{
                                  display: "inline-block",
                                  width: "8px",
                                  height: "8px",
                                  background: "linear-gradient(to right, rgb(59, 130, 246), rgb(168, 85, 247))",
                                  borderRadius: "50%",
                                  animation: "pulse 2s infinite",
                                }}
                              ></span>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <div style={{ padding: "16px", textAlign: "center", color: "rgb(148, 163, 184)" }}>
                    No groups yet. Create a group to start chatting with multiple people.
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Secure tunnel indicator */}
      {/* Replaced with inline styles */}
      <div
        style={{
          marginTop: "auto",
          padding: "12px 12px 24px 12px",
          borderTop: "1px solid rgba(51, 65, 85, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: "rgb(52, 211, 153)",
            fontSize: "12px",
            background: "linear-gradient(to right, rgba(16, 185, 129, 0.1), rgba(34, 197, 94, 0.1))",
            padding: "8px 12px",
            borderRadius: "9999px",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              background: "linear-gradient(to right, rgb(74, 222, 128), rgb(34, 197, 94))",
              borderRadius: "50%",
              marginRight: "8px",
              animation: "pulse 2s infinite",
              boxShadow: "0 0 15px rgba(74, 222, 128, 0.25)",
            }}
          ></div>
          <span style={{ fontWeight: 500 }}>
            {selectedServer ? `Secure tunnel: ${getServerName(selectedServer)}` : "Connected to secure tunnel"}
          </span>
          <Sparkles style={{ height: "12px", width: "12px", marginLeft: "8px", animation: "pulse 2s infinite" }} />
        </div>
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        currentUser={currentUser}
        users={users}
        onGroupCreated={handleGroupCreated}
      />

      {/* Server Selection Modal (Placeholder for now) */}
      {/* {showServerSelection && (
        <ServerSelectionModal
          isOpen={showServerSelection}
          onClose={() => setShowServerSelection(false)}
          // Add props for selecting server if needed
        />
      )} */}
    </div>
  )
}
