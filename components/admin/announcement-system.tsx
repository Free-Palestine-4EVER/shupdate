"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { ref, get, set, push, serverTimestamp, update, remove } from "firebase/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { RefreshCw, Megaphone, Pin, Trash2, Send, Users } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function AnnouncementSystem() {
  const [users, setUsers] = useState<any[]>([])
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<Record<string, boolean>>({})
  const [isGlobal, setIsGlobal] = useState(true)
  const [isPinned, setIsPinned] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("create")
  const [isDeletingAnnouncement, setIsDeletingAnnouncement] = useState<Record<string, boolean>>({})

  // Fetch users and announcements
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch users
        const usersRef = ref(db, "users")
        const usersSnapshot = await get(usersRef)

        const usersData: any[] = []
        if (usersSnapshot.exists()) {
          usersSnapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val()
            usersData.push({
              id: childSnapshot.key,
              ...userData,
            })
          })
        }
        setUsers(usersData)

        // Fetch announcements
        const announcementsRef = ref(db, "announcements")
        const announcementsSnapshot = await get(announcementsRef)

        const announcementsData: any[] = []
        if (announcementsSnapshot.exists()) {
          announcementsSnapshot.forEach((childSnapshot) => {
            const announcementData = childSnapshot.val()
            announcementsData.push({
              id: childSnapshot.key,
              ...announcementData,
              createdAt: announcementData.createdAt ? new Date(announcementData.createdAt) : new Date(),
            })
          })
        }

        // Sort by creation date (newest first)
        announcementsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        setAnnouncements(announcementsData)
      } catch (error: any) {
        console.error("Error fetching data:", error)
        setError(`Failed to load data: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  // Handle send announcement
  const handleSendAnnouncement = async () => {
    if (!title.trim() || !message.trim()) {
      setError("Title and message are required")
      return
    }

    setIsSending(true)
    setError(null)

    try {
      const announcementsRef = ref(db, "announcements")
      const newAnnouncementRef = push(announcementsRef)

      const targetUsers = isGlobal
        ? {}
        : Object.keys(selectedUsers)
            .filter((id) => selectedUsers[id])
            .reduce((acc, id) => ({ ...acc, [id]: true }), {})

      const announcementData = {
        title,
        message,
        isGlobal,
        isPinned,
        targetUsers: isGlobal ? null : targetUsers,
        createdAt: serverTimestamp(),
      }

      await set(newAnnouncementRef, announcementData)

      // Update local state
      setAnnouncements([
        {
          id: newAnnouncementRef.key,
          ...announcementData,
          createdAt: new Date(),
        },
        ...announcements,
      ])

      // Reset form
      setTitle("")
      setMessage("")
      setIsGlobal(true)
      setIsPinned(false)
      setSelectedUsers({})

      setSuccessMessage("Announcement sent successfully")
      setTimeout(() => setSuccessMessage(null), 3000)

      // Switch to manage tab
      setActiveTab("manage")
    } catch (error: any) {
      console.error("Error sending announcement:", error)
      setError(`Failed to send announcement: ${error.message}`)
    } finally {
      setIsSending(false)
    }
  }

  // Handle delete announcement
  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return

    setIsDeletingAnnouncement((prev) => ({ ...prev, [announcementId]: true }))

    try {
      const announcementRef = ref(db, `announcements/${announcementId}`)
      await remove(announcementRef)

      // Update local state
      setAnnouncements(announcements.filter((a) => a.id !== announcementId))

      setSuccessMessage("Announcement deleted successfully")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      console.error("Error deleting announcement:", error)
      setError(`Failed to delete announcement: ${error.message}`)
    } finally {
      setIsDeletingAnnouncement((prev) => {
        const newState = { ...prev }
        delete newState[announcementId]
        return newState
      })
    }
  }

  // Handle toggle pin announcement
  const handleTogglePinAnnouncement = async (announcement: any) => {
    try {
      const announcementRef = ref(db, `announcements/${announcement.id}`)
      await update(announcementRef, {
        isPinned: !announcement.isPinned,
      })

      // Update local state
      setAnnouncements(announcements.map((a) => (a.id === announcement.id ? { ...a, isPinned: !a.isPinned } : a)))

      setSuccessMessage(`Announcement ${announcement.isPinned ? "unpinned" : "pinned"} successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      console.error("Error toggling pin status:", error)
      setError(`Failed to update announcement: ${error.message}`)
    }
  }

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }))
  }

  // Count selected users
  const selectedUserCount = Object.values(selectedUsers).filter(Boolean).length

  return (
    <div className="h-full flex flex-col">
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mb-4">
          <TabsTrigger value="create" className="data-[state=active]:bg-gray-800">
            Create Announcement
          </TabsTrigger>
          <TabsTrigger value="manage" className="data-[state=active]:bg-gray-800">
            Manage Announcements
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto">
          <TabsContent value="create" className="h-full mt-0">
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-400 mb-1">
                  Announcement Title
                </label>
                <Input
                  id="title"
                  placeholder="Enter announcement title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="custom-input"
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-400 mb-1">
                  Announcement Message
                </label>
                <Textarea
                  id="message"
                  placeholder="Enter announcement message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="custom-input min-h-[120px]"
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="global" checked={isGlobal} onCheckedChange={() => setIsGlobal(!isGlobal)} />
                  <label htmlFor="global" className="text-sm text-gray-400">
                    Send to all users
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox id="pinned" checked={isPinned} onCheckedChange={() => setIsPinned(!isPinned)} />
                  <label htmlFor="pinned" className="text-sm text-gray-400">
                    Pin announcement
                  </label>
                </div>
              </div>

              {!isGlobal && (
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Select Target Users ({selectedUserCount} selected)
                  </label>

                  {isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-4 text-center text-gray-400">No users found</div>
                  ) : (
                    <div className="bg-gray-900/30 rounded-md border border-gray-800 max-h-60 overflow-auto p-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {users.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2 p-2 hover:bg-gray-800 rounded-md">
                            <Checkbox
                              id={`user-${user.id}`}
                              checked={!!selectedUsers[user.id]}
                              onCheckedChange={() => toggleUserSelection(user.id)}
                            />
                            <label htmlFor={`user-${user.id}`} className="text-sm text-white cursor-pointer flex-1">
                              {user.username || `User ${user.id.substring(0, 5)}`}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4">
                <Button
                  onClick={handleSendAnnouncement}
                  disabled={isSending || !title.trim() || !message.trim() || (!isGlobal && selectedUserCount === 0)}
                  className="btn-primary"
                >
                  {isSending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> Send Announcement
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="manage" className="h-full mt-0">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="p-4 text-center text-gray-400">No announcements found</div>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="bg-gray-900/30 rounded-md border border-gray-800 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <Megaphone className="h-5 w-5 text-primary mr-2" />
                        <h3 className="font-medium text-white">{announcement.title}</h3>
                        {announcement.isPinned && (
                          <span className="ml-2 bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">
                            Pinned
                          </span>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleTogglePinAnnouncement(announcement)}
                          className={`${announcement.isPinned ? "text-yellow-400" : "text-gray-400"} hover:text-yellow-400 hover:bg-yellow-900/20`}
                        >
                          <Pin className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAnnouncement(announcement.id)}
                          disabled={isDeletingAnnouncement[announcement.id]}
                          className="text-red-500 hover:text-red-400 hover:bg-red-900/20"
                        >
                          {isDeletingAnnouncement[announcement.id] ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <p className="mt-2 text-gray-300">{announcement.message}</p>

                    <div className="mt-3 flex items-center text-xs text-gray-400">
                      <span>
                        {announcement.createdAt &&
                          formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                      </span>

                      {announcement.isGlobal ? (
                        <span className="ml-3 flex items-center">
                          <Users className="h-3 w-3 mr-1" /> All users
                        </span>
                      ) : (
                        <span className="ml-3 flex items-center">
                          <Users className="h-3 w-3 mr-1" />
                          {announcement.targetUsers ? Object.keys(announcement.targetUsers).length : 0} selected users
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
