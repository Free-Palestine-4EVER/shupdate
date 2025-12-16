"use client"

import { useState, useEffect } from "react"
import { db, storage } from "@/lib/firebase"
import { ref as dbRef, get, remove, query, orderByChild, limitToLast } from "firebase/database"
import { ref as storageRef, deleteObject } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Search, Trash2, RefreshCw, MessageSquare, User, AlertTriangle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import Image from "next/image"

export default function MessageModeration() {
  const [chats, setChats] = useState<any[]>([])
  const [selectedChat, setSelectedChat] = useState<any | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [users, setUsers] = useState<Record<string, any>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoadingChats, setIsLoadingChats] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isDeletingMessage, setIsDeletingMessage] = useState<Record<string, boolean>>({})
  const [isNuking, setIsNuking] = useState(false)

  // Fetch all chats
  useEffect(() => {
    const fetchChats = async () => {
      setIsLoadingChats(true)
      setError(null)

      try {
        // First fetch all users for reference
        const usersRef = dbRef(db, "users")
        const usersSnapshot = await get(usersRef)

        const usersData: Record<string, any> = {}
        if (usersSnapshot.exists()) {
          usersSnapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val()
            usersData[childSnapshot.key as string] = {
              id: childSnapshot.key,
              ...userData,
            }
          })
        }
        setUsers(usersData)

        // Then fetch all chats
        const chatsRef = dbRef(db, "chats")
        const chatsSnapshot = await get(chatsRef)

        if (chatsSnapshot.exists()) {
          const chatsData: any[] = []

          chatsSnapshot.forEach((childSnapshot) => {
            const chatData = childSnapshot.val()

            // Get participant names
            let participantNames: string[] = []
            if (Array.isArray(chatData.participants)) {
              participantNames = chatData.participants.map(
                (id: string) => usersData[id]?.username || `User ${id.substring(0, 5)}`,
              )
            } else if (typeof chatData.participants === "object") {
              participantNames = Object.keys(chatData.participants).map(
                (id) => usersData[id]?.username || `User ${id.substring(0, 5)}`,
              )
            }

            chatsData.push({
              id: childSnapshot.key,
              ...chatData,
              participantNames,
              createdAt: chatData.createdAt ? new Date(chatData.createdAt) : new Date(),
              updatedAt: chatData.updatedAt ? new Date(chatData.updatedAt) : new Date(),
            })
          })

          // Sort by updatedAt in descending order
          chatsData.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

          setChats(chatsData)
        } else {
          setChats([])
        }
      } catch (error: any) {
        console.error("Error fetching chats:", error)
        setError(`Failed to load chats: ${error.message}`)
      } finally {
        setIsLoadingChats(false)
      }
    }

    fetchChats()
  }, [])

  // Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat) {
      setMessages([])
      return
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true)
      setError(null)

      try {
        const messagesRef = dbRef(db, `messages/${selectedChat.id}`)
        const messagesQuery = query(messagesRef, orderByChild("timestamp"), limitToLast(100))
        const snapshot = await get(messagesQuery)

        if (snapshot.exists()) {
          const messagesData: any[] = []

          snapshot.forEach((childSnapshot) => {
            const messageData = childSnapshot.val()
            messagesData.push({
              id: childSnapshot.key,
              ...messageData,
              timestamp: messageData.timestamp ? new Date(messageData.timestamp) : new Date(),
            })
          })

          // Sort by timestamp in ascending order
          messagesData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

          setMessages(messagesData)
        } else {
          setMessages([])
        }
      } catch (error: any) {
        console.error("Error fetching messages:", error)
        setError(`Failed to load messages: ${error.message}`)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchMessages()
  }, [selectedChat])

  // Filter chats based on search query
  const filteredChats = searchQuery.trim()
    ? chats.filter(
      (chat) =>
        chat.participantNames.some((name: string) => name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        chat.id.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    : chats

  // Handle delete message
  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat) return

    if (!window.confirm("Are you sure you want to delete this message? This action cannot be undone.")) return

    setIsDeletingMessage((prev) => ({ ...prev, [messageId]: true }))

    try {
      const message = messages.find((m) => m.id === messageId)

      // Delete media files if they exist
      if (message.imageUrl) {
        try {
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
      const messageRef = dbRef(db, `messages/${selectedChat.id}/${messageId}`)
      await remove(messageRef)

      // Update local state
      setMessages(messages.filter((m) => m.id !== messageId))

      setSuccessMessage("Message deleted successfully")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      console.error("Error deleting message:", error)
      setError(`Failed to delete message: ${error.message}`)
    } finally {
      setIsDeletingMessage((prev) => {
        const newState = { ...prev }
        delete newState[messageId]
        return newState
      })
    }
  }

  // Braces Fixed

  const handleNukeAllMessages = async () => {
    // Confirmation handled by AlertDialog
    performNuke()
  }

  const performNuke = async () => {
    setIsNuking(true)
    try {
      // Delete all major collections related to messaging
      await remove(dbRef(db, "chats"))
      await remove(dbRef(db, "groups"))
      await remove(dbRef(db, "messages")) // Delete separated messages
      // Also clear userChats to remove references
      await remove(dbRef(db, "userChats"))

      // IMPORTANT: Also reset all user passcodes and devices for a "Fresh Start"
      const usersRef = dbRef(db, "users")
      const usersSnapshot = await get(usersRef)

      if (usersSnapshot.exists()) {
        const updates: Record<string, any> = {}
        usersSnapshot.forEach((child) => {
          const uid = child.key
          // Reset passcode, deviceId, encryption keys
          updates[`users/${uid}/passcode`] = null
          updates[`users/${uid}/deviceId`] = null
          updates[`users/${uid}/deviceVersion`] = null // Force new claim
          updates[`users/${uid}/encryptedPrivateKey`] = null // Force new key generation
          updates[`users/${uid}/publicKey`] = null // Clean slate
        })

        // Apply all user updates atomically
        // We can use update() on the root reference if needed, or individually.
        // Updating root `users` might be heavy. Let's do batch update on root if possible or iterate.
        // Firebase `update` can handle multi-path updates like { "users/u1/passcode": null, "users/u2/passcode": null }

        await import("firebase/database").then(({ update: firebaseUpdate, ref }) => {
          return firebaseUpdate(ref(db), updates)
        })
      }

      setChats([])
      setMessages([])
      setSelectedChat(null)
      setSuccessMessage("SYSTEM WIPED: All messages deleted. All passcodes & devices reset. Fresh start initiated.")

    } catch (error: any) {
      console.error("Error nuking messages:", error)
      setError(`Failed to nuke system: ${error.message}`)
    } finally {
      setIsNuking(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Message Moderation</h2>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              disabled={isNuking}
              className="bg-red-700 hover:bg-red-800"
            >
              {isNuking ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  SYSTEM RESET IN PROGRESS...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  TOTAL SYSTEM RESET (MESSAGES + SECURITY)
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center text-red-500">
                <AlertTriangle className="mr-2 h-5 w-5" />
                CRITICAL WARNING
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-300">
                This action will <strong>PERMANENTLY DELETE ALL</strong> messages, groups, and chat history for EVERYONE.
                <br /><br />
                It will also <strong>RESET ALL SECURITY KEYS</strong>, forcing every user to re-register their devices and PINs.
                <br /><br />
                This action cannot be undone. Are you absolutely sure?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={performNuke}
                className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                Yes, Nuke Everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error && (
        <Alert variant="destructive" className="mb-4 bg-red-900/30 border-red-800">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="mb-4 bg-green-900/30 border-green-800">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search chats by participant name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 custom-input"
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* Chat list */}
        <div className="w-full md:w-1/3 overflow-auto bg-gray-900/30 rounded-md border border-gray-800">
          <div className="p-3 border-b border-gray-800">
            <h3 className="font-medium text-white">Chats ({filteredChats.length})</h3>
          </div>

          {isLoadingChats ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              {searchQuery ? "No chats match your search" : "No chats found"}
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`p-3 hover:bg-gray-800 cursor-pointer ${selectedChat?.id === chat.id ? "bg-gray-800" : ""}`}
                  onClick={() => setSelectedChat(chat)}
                >
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{chat.participantNames.join(", ")}</p>
                      <p className="text-xs text-gray-400">
                        {chat.updatedAt
                          ? formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })
                          : "Unknown"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="w-full md:w-2/3 overflow-auto bg-gray-900/30 rounded-md border border-gray-800">
          {selectedChat ? (
            <div className="h-full flex flex-col">
              <div className="p-3 border-b border-gray-800">
                <h3 className="font-medium text-white">
                  Messages in chat with {selectedChat.participantNames.join(", ")}
                </h3>
              </div>

              {isLoadingMessages ? (
                <div className="flex items-center justify-center p-8 flex-1">
                  <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="p-4 text-center text-gray-400 flex-1">No messages in this chat</div>
              ) : (
                <div className="p-4 space-y-4 flex-1 overflow-auto">
                  {messages.map((message) => {
                    const sender = users[message.senderId]

                    return (
                      <div key={message.id} className="flex items-start space-x-3 group">
                        <div className="flex-shrink-0">
                          {sender?.photoURL ? (
                            <Image
                              src={sender.photoURL || "/placeholder.svg"}
                              alt={sender.username || "User"}
                              width={32}
                              height={32}
                              className="rounded-full"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center">
                            <p className="font-medium text-white">
                              {sender?.username || `User ${message.senderId.substring(0, 5)}`}
                            </p>
                            <span className="text-xs text-gray-400 ml-2">
                              {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                            </span>
                          </div>

                          <div className="mt-1 bg-gray-800 p-3 rounded-md">
                            {message.text && <p className="text-white">{message.text}</p>}

                            {message.imageUrl && (
                              <div className="mt-2">
                                <img
                                  src={message.imageUrl || "/placeholder.svg"}
                                  alt="Image"
                                  className="max-w-full max-h-64 rounded-md"
                                />
                              </div>
                            )}

                            {message.videoUrl && (
                              <div className="mt-2">
                                <video src={message.videoUrl} controls className="max-w-full max-h-64 rounded-md" />
                              </div>
                            )}

                            {message.audioUrl && (
                              <div className="mt-2">
                                <audio src={message.audioUrl} controls className="w-full" />
                              </div>
                            )}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteMessage(message.id)}
                          disabled={isDeletingMessage[message.id]}
                          className="text-red-500 hover:text-red-400 hover:bg-red-900/20 opacity-0 group-hover:opacity-100"
                        >
                          {isDeletingMessage[message.id] ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">Select a chat to view messages</div>
          )}
        </div>
      </div>
    </div>
  )
}
