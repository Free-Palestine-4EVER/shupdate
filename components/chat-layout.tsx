"use client"

import { useState, useEffect } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { db } from "@/lib/firebase"
import { ref, onValue, get, set, serverTimestamp, update } from "firebase/database"
import type { User, Chat } from "@/lib/types"
import Sidebar from "@/components/sidebar"
import ChatWindow from "@/components/chat-window"
import SettingsModal from "@/components/settings-modal"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import OnlinePresence from "@/components/online-presence"
// import UnlockMessagesModal from "@/components/unlock-messages-modal"
import { hasEncryptionKeys } from "@/lib/encryption"

interface ChatLayoutProps {
  selectedServer?: string | null
}

export default function ChatLayout({ selectedServer }: ChatLayoutProps) {
  const { user, firebaseInitialized } = useFirebase()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [groups, setGroups] = useState<Chat[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [selectedChat, setSelectedChat] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isGroup, setIsGroup] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [creatingUserData, setCreatingUserData] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [isMigratingData, setIsMigratingData] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Record<string, boolean>>({})
  const [isMobileView, setIsMobileView] = useState(false)
  const [showChatOnMobile, setShowChatOnMobile] = useState(false)



  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768)
    }

    // Initial check
    checkMobile()

    // Add resize listener
    window.addEventListener("resize", checkMobile)

    return () => {
      window.removeEventListener("resize", checkMobile)
    }
  }, [])

  useEffect(() => {
    if (selectedChat && isMobileView) {
      setShowChatOnMobile(true)
    }
  }, [selectedChat, isMobileView])



  // Listen for presence changes
  useEffect(() => {
    if (!user) return

    const statusRef = ref(db, "status")
    const presenceRef = ref(db, "presence")

    const statusUnsubscribe = onValue(statusRef, (snapshot) => {
      if (snapshot.exists()) {
        const presenceData: Record<string, boolean> = {}

        snapshot.forEach((childSnapshot) => {
          const userId = childSnapshot.key || ""
          const userData = childSnapshot.val()

          // Only mark as online if state is explicitly "online"
          presenceData[userId] = userData?.state === "online"

          // Update the last seen time in our local state if available
          if (userData?.lastSeen && users.length > 0) {
            const userToUpdate = users.find((u) => u.id === userId)
            if (userToUpdate) {
              userToUpdate.lastSeen = new Date(userData.lastSeen)
            }
          }
        })

        setOnlineUsers(presenceData)
      }
    })

    const presenceUnsubscribe = onValue(presenceRef, (snapshot) => {
      if (snapshot.exists()) {
        const presenceData: Record<string, boolean> = {}

        snapshot.forEach((childSnapshot) => {
          const userId = childSnapshot.key || ""
          const userData = childSnapshot.val()

          // Only mark as online if online is explicitly true
          presenceData[userId] = userData?.online === true

          // Update the last seen time in our local state if available
          if (userData?.lastSeen && users.length > 0) {
            const userToUpdate = users.find((u) => u.id === userId)
            if (userToUpdate) {
              userToUpdate.lastSeen = new Date(userData.lastSeen)
            }
          }
        })

        setOnlineUsers((prev) => {
          const newData = { ...prev }
          // Only update values that are true or where the key doesn't exist in prev
          Object.keys(presenceData).forEach((key) => {
            if (presenceData[key] === true || !(key in prev)) {
              newData[key] = presenceData[key]
            }
          })
          return newData
        })
      }
    })

    return () => {
      statusUnsubscribe()
      presenceUnsubscribe()
    }
  }, [user, users])

  // Fetch current user data
  useEffect(() => {
    if (!user) return

    const fetchCurrentUser = async () => {
      try {
        console.log("Fetching current user data for:", user.uid)
        // Get the user document from Realtime Database
        const userRef = ref(db, `users/${user.uid}`)
        const snapshot = await get(userRef)

        if (snapshot.exists()) {
          const userData = snapshot.val()
          console.log("User data found:", userData)

          // Ensure all required fields exist
          const defaultUsername = user.displayName || user.email?.split("@")[0] || `User_${user.uid.substring(0, 5)}`
          const defaultPhotoURL =
            user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultUsername)}&background=random`

          // Update with any missing fields
          const updatedData: any = {}

          let needsUpdate = false

          if (!userData.username) {
            updatedData.username = defaultUsername
            needsUpdate = true
          }

          if (!userData.photoURL) {
            updatedData.photoURL = defaultPhotoURL
            needsUpdate = true
          }

          if (!userData.id) {
            updatedData.id = user.uid
            needsUpdate = true
          }

          if (!userData.email) {
            updatedData.email = user.email
            needsUpdate = true
          }

          if (!userData.createdAt) {
            updatedData.createdAt = serverTimestamp()
            needsUpdate = true
          }

          // Update if any fields were missing
          if (needsUpdate) {
            console.log("Updating user data with missing fields:", updatedData)
            await update(userRef, updatedData)
          }

          // Set current user with complete data
          setCurrentUser({
            id: user.uid,
            username: userData.username || defaultUsername,
            email: userData.email || user.email || "",
            photoURL: userData.photoURL || defaultPhotoURL,
            lastSeen: userData.lastSeen ? new Date(userData.lastSeen) : null,
            createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
            online: onlineUsers[user.uid] || false,
          })
        } else {
          console.log("No user data found, creating new profile")
          // User data doesn't exist, create it
          setCreatingUserData(true)

          // Create a default user profile
          const defaultUsername = user.displayName || user.email?.split("@")[0] || `User_${user.uid.substring(0, 5)}`
          const defaultPhotoURL =
            user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultUsername)}&background=random`

          const defaultUserData = {
            id: user.uid,
            username: defaultUsername,
            email: user.email || "",
            photoURL: defaultPhotoURL,
            createdAt: serverTimestamp(),
          }

          // Save to database
          await set(userRef, defaultUserData)

          // Set current user
          setCurrentUser({
            ...defaultUserData,
            id: user.uid,
            lastSeen: null,
            createdAt: new Date(),
            online: true,
          })

          setCreatingUserData(false)
        }
      } catch (error: any) {
        console.error("Error fetching current user:", error)
        setError(`Failed to fetch user data: ${error.message}`)
        setDebugInfo(`User ID: ${user.uid}, Error: ${error.message}`)
      }
    }

    fetchCurrentUser()

    // Fetch all users with Realtime Database
    try {
      console.log("Setting up users listener")
      const usersRef = ref(db, "users")

      const unsubscribe = onValue(
        usersRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const usersData: User[] = []
            const incompleteUsers: { id: string; data: any }[] = []

            snapshot.forEach((childSnapshot) => {
              const userData = childSnapshot.val()
              const userId = childSnapshot.key || ""

              // Check if user data is complete
              if (userData && userData.username && userData.photoURL) {
                usersData.push({
                  ...userData,
                  id: userId,
                  lastSeen: userData.lastSeen ? new Date(userData.lastSeen) : null,
                  createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
                  online: userData.online === true, // Explicitly check for true
                  email: userData.email || `user_${userId.substring(0, 5)}@example.com`,
                })
              } else if (userData) {
                // Add to incomplete users list for potential migration
                incompleteUsers.push({ id: userId, data: userData })
                console.log("Incomplete user data found:", userId, userData)
              }
            })

            console.log(`Found ${usersData.length} valid users and ${incompleteUsers.length} incomplete users`)

            // If we have incomplete users and we're not already migrating, start migration
            if (incompleteUsers.length > 0 && !isMigratingData && user) {
              migrateIncompleteUsers(incompleteUsers, user.uid)
            }

            setUsers(usersData)
            setIsLoading(false)

            const currentUserData = usersData.find((u) => u.id === user.uid)
            if (currentUserData) {
              setCurrentUser({
                ...currentUserData,
                online: true, // Always set current user as online
              })
            }
          } else {
            console.log("No users found in database")
            setUsers([])
            setIsLoading(false)
          }
        },
        (error) => {
          console.error("Error fetching users:", error)

          if (error.code === "PERMISSION_DENIED") {
            setError("Permission denied. Please check Firebase security rules for the users collection.")
          } else {
            setError(`Failed to fetch users: ${error.message}`)
          }

          setIsLoading(false)
        },
      )

      return () => unsubscribe()
    } catch (error: any) {
      console.error("Error setting up users listener:", error)
      setError(`Failed to set up users listener: ${error.message}`)
      setIsLoading(false)
    }
  }, [user])

  // Function to migrate incomplete user data
  const migrateIncompleteUsers = async (incompleteUsers: { id: string; data: any }[], currentUserId: string) => {
    try {
      setIsMigratingData(true)
      console.log("Starting migration for incomplete users...")

      for (const { id, data } of incompleteUsers) {
        // Skip migration for other users if not the current user
        // This is to respect permissions - users can only update their own data
        if (id !== currentUserId) continue

        const userRef = ref(db, `users/${id}`)

        // Create default values for missing fields
        const defaultUsername = `User_${id.substring(0, 5)}`
        const defaultPhotoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultUsername)}&background=random`

        const updatedData: any = {
          ...data,
          id: id,
        }

        if (!data.username) updatedData.username = defaultUsername
        if (!data.photoURL) updatedData.photoURL = defaultPhotoURL
        if (!data.email) updatedData.email = `user_${id.substring(0, 5)}@example.com`
        if (!data.createdAt) updatedData.createdAt = serverTimestamp()

        console.log(`Migrating user ${id} with data:`, updatedData)

        try {
          await update(userRef, updatedData)
          console.log(`Successfully migrated user ${id}`)
        } catch (error) {
          console.error(`Failed to migrate user ${id}:`, error)
        }
      }
    } catch (error) {
      console.error("Error during user data migration:", error)
    } finally {
      setIsMigratingData(false)
    }
  }

  // Fetch chats for current user with Realtime Database
  useEffect(() => {
    if (!user?.uid) return

    try {
      console.log("Setting up chats listener")
      const chatsRef = ref(db, "chats")

      const unsubscribe = onValue(
        chatsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const chatsData: Chat[] = []

            snapshot.forEach((childSnapshot) => {
              const chatData = childSnapshot.val()

              // Skip groups - they'll be handled separately
              if (chatData.isGroup) return

              // Only include chats where the current user is a participant
              if (chatData.participants) {
                // Check if participants is an object (key-value pairs)
                if (typeof chatData.participants === "object" && !Array.isArray(chatData.participants)) {
                  // If it's an object, check if the user's ID is a key in the object
                  if (chatData.participants[user.uid]) {
                    chatsData.push({
                      id: childSnapshot.key || "",
                      ...chatData,
                      createdAt: chatData.createdAt ? new Date(chatData.createdAt) : new Date(),
                      updatedAt: chatData.updatedAt ? new Date(chatData.updatedAt) : new Date(),
                      lastMessage: chatData.lastMessage
                        ? {
                          ...chatData.lastMessage,
                          timestamp: chatData.lastMessage.timestamp
                            ? new Date(chatData.lastMessage.timestamp)
                            : new Date(),
                        }
                        : undefined,
                    })
                  }
                }
                // If it's an array, use includes method
                else if (Array.isArray(chatData.participants) && chatData.participants.includes(user.uid)) {
                  chatsData.push({
                    id: childSnapshot.key || "",
                    ...chatData,
                    createdAt: chatData.createdAt ? new Date(chatData.createdAt) : new Date(),
                    updatedAt: chatData.updatedAt ? new Date(chatData.updatedAt) : new Date(),
                    lastMessage: chatData.lastMessage
                      ? {
                        ...chatData.lastMessage,
                        timestamp: chatData.lastMessage.timestamp
                          ? new Date(chatData.lastMessage.timestamp)
                          : new Date(),
                      }
                      : undefined,
                  })
                }
              }
            })

            // Sort chats by updatedAt in descending order
            chatsData.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

            console.log(`Found ${chatsData.length} chats for current user`)
            setChats(chatsData)
          } else {
            console.log("No chats found")
            setChats([])
          }
        },
        (error) => {
          console.error("Error fetching chats:", error)

          if (error.code === "PERMISSION_DENIED") {
            setError("Permission denied. Please check Firebase security rules for the chats collection.")
          } else {
            setError(`Failed to fetch chats: ${error.message}`)
          }
        },
      )

      return () => unsubscribe()
    } catch (error: any) {
      console.error("Error setting up chats listener:", error)
      setError(`Failed to set up chat listener: ${error.message}`)
    }
  }, [user, retryCount])

  // Fetch groups for current user
  useEffect(() => {
    if (!user?.uid) return

    try {
      console.log("Setting up groups listener")
      const groupsRef = ref(db, "groups")

      const unsubscribe = onValue(
        groupsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const groupsData: Chat[] = []

            snapshot.forEach((childSnapshot) => {
              const groupData = childSnapshot.val()

              // Only include groups where the current user is a participant
              if (groupData.participants) {
                // Check if participants is an object (key-value pairs)
                if (typeof groupData.participants === "object" && !Array.isArray(groupData.participants)) {
                  // If it's an object, check if the user's ID is a key in the object
                  if (groupData.participants[user.uid]) {
                    groupsData.push({
                      id: childSnapshot.key || "",
                      ...groupData,
                      isGroup: true,
                      createdAt: groupData.createdAt ? new Date(groupData.createdAt) : new Date(),
                      updatedAt: groupData.updatedAt ? new Date(groupData.updatedAt) : new Date(),
                      lastMessage: groupData.lastMessage
                        ? {
                          ...groupData.lastMessage,
                          timestamp: groupData.lastMessage.timestamp
                            ? new Date(groupData.lastMessage.timestamp)
                            : new Date(),
                        }
                        : undefined,
                    })
                  }
                }
                // If it's an array, use includes method
                else if (Array.isArray(groupData.participants) && groupData.participants.includes(user.uid)) {
                  groupsData.push({
                    id: childSnapshot.key || "",
                    ...groupData,
                    isGroup: true,
                    createdAt: groupData.createdAt ? new Date(groupData.createdAt) : new Date(),
                    updatedAt: groupData.updatedAt ? new Date(groupData.updatedAt) : new Date(),
                    lastMessage: groupData.lastMessage
                      ? {
                        ...groupData.lastMessage,
                        timestamp: groupData.lastMessage.timestamp
                          ? new Date(groupData.lastMessage.timestamp)
                          : new Date(),
                      }
                      : undefined,
                  })
                }
              }
            })

            // Sort groups by updatedAt in descending order
            groupsData.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

            console.log(`Found ${groupsData.length} groups for current user`)
            setGroups(groupsData)
          } else {
            console.log("No groups found")
            setGroups([])
          }
        },
        (error) => {
          console.error("Error fetching groups:", error)

          if (error.code === "PERMISSION_DENIED") {
            setError("Permission denied. Please check Firebase security rules for the groups collection.")
          } else {
            setError(`Failed to fetch groups: ${error.message}`)
          }
        },
      )

      return () => unsubscribe()
    } catch (error: any) {
      console.error("Error setting up groups listener:", error)
      setError(`Failed to set up groups listener: ${error.message}`)
    }
  }, [user, retryCount])

  const handleChatSelect = (chatId: string, userId?: string) => {
    setSelectedChat(chatId)
    setIsGroup(false)

    if (userId) {
      const user = users.find((u) => u.id === userId)
      if (user) {
        // Check if the user is online - only trust presence data
        const isOnline = onlineUsers[userId] === true || (currentUser && userId === currentUser.id)

        setSelectedUser({
          ...user,
          online: isOnline,
        })
      }
    } else {
      setSelectedUser(null)
    }

    // For mobile, ensure we show the chat view
    if (isMobileView) {
      setShowChatOnMobile(true)
    }
  }

  const handleGroupSelect = (groupId: string) => {
    setSelectedChat(groupId)
    setIsGroup(true)
    setSelectedUser(null)

    // For mobile, ensure we show the chat view
    if (isMobileView) {
      setShowChatOnMobile(true)
    }
  }

  // Handle back button on mobile
  const handleBackToSidebar = () => {
    setShowChatOnMobile(false)
    // We need to temporarily clear the selectedChat so that clicking the same chat again will work
    // We'll use setTimeout to ensure the UI transition happens first
    setTimeout(() => {
      setSelectedChat(null)
    }, 50)
  }

  // Improved search functionality
  const filteredUsers = searchQuery
    ? users.filter((u) => {
      if (!user) return false
      return u.id !== user.uid && u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase())
    })
    : []

  const handleRetry = () => {
    setError(null)
    setDebugInfo(null)
    setIsLoading(true)
    setRetryCount((prev) => prev + 1)
  }

  if (loading || !firebaseInitialized) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "2px solid transparent",
              borderTopColor: "#ec4899",
              borderBottomColor: "#ec4899",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          ></div>
          <p style={{ color: "#9ca3af" }}>
            {creatingUserData
              ? "Creating your profile..."
              : isMigratingData
                ? "Updating user data..."
                : "Loading your chats..."}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          height: "100vh",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
        }}
      >
        <div style={{ textAlign: "center", padding: "24px", maxWidth: "448px" }}>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          {debugInfo && (
            <div
              style={{
                marginBottom: "16px",
                padding: "8px",
                backgroundColor: "#1f2937",
                borderRadius: "8px",
                fontSize: "12px",
                textAlign: "left",
                overflow: "auto",
              }}
            >
              <pre>{debugInfo}</pre>
            </div>
          )}
          <p style={{ marginBottom: "16px", color: "#9ca3af" }}>
            This may be due to network issues, incorrect Firebase configuration, or Firebase security rules.
          </p>
          <Button onClick={handleRetry} className="mr-2">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload Page
          </Button>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "transparent",
      }}
    >
      {/* Include the OnlinePresence component but it doesn't render anything visible */}
      {currentUser && <OnlinePresence userId={currentUser.id} />}

      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Sidebar - hide on mobile when chat is open, fullscreen when visible */}
          <div
            style={{
              display: isMobileView && showChatOnMobile ? "none" : "flex",
              width: isMobileView ? "100%" : "auto",
              minWidth: isMobileView ? "100%" : undefined,
              flexShrink: 0,
            }}
            className={`${isMobileView && showChatOnMobile ? "hidden" : "flex"} ${isMobileView ? "w-full" : "md:flex-none"}`}
          >
            <Sidebar
              currentUser={currentUser}
              chats={chats}
              groups={groups}
              users={users}
              selectedChat={selectedChat}
              onChatSelect={handleChatSelect}
              onGroupSelect={handleGroupSelect}
              onSettingsOpen={() => setIsSettingsOpen(true)}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filteredUsers={filteredUsers}
              selectedServer={selectedServer}
              isMobileView={isMobileView}
            />
          </div>

          {/* Chat Window - show on mobile only when a chat is selected */}
          <div
            style={{
              display: isMobileView && !showChatOnMobile ? "none" : "flex",
              flex: 1,
            }}
            className={`${isMobileView && !showChatOnMobile ? "hidden" : "flex flex-1"}`}
          >
            <ChatWindow
              currentUser={currentUser}
              selectedChat={selectedChat}
              selectedUser={selectedUser}
              users={users}
              setSelectedChat={setSelectedChat}
              isMobileView={isMobileView}
              onBackClick={handleBackToSidebar}
              isGroup={isGroup}
            />
          </div>
        </div>
      </div>

      {isSettingsOpen && currentUser && (
        <SettingsModal
          user={currentUser}
          isOpen={isSettingsOpen}
          onClose={() => {
            setIsSettingsOpen(false)
            // Refresh user data when settings modal is closed
            if (user) {
              const userRef = ref(db, `users/${user.uid}`)
              get(userRef).then((snapshot) => {
                if (snapshot.exists()) {
                  const userData = snapshot.val()
                  setCurrentUser({
                    ...currentUser,
                    username: userData.username || currentUser.username,
                    photoURL: userData.photoURL || currentUser.photoURL,
                  })
                }
              })
            }
          }}
        />
      )}

    </div>
  )
}
