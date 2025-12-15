"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"
import { useFirebase } from "@/components/firebase-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { X, Pin, Megaphone } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export default function AnnouncementsDisplay() {
  const { user } = useFirebase()
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Record<string, boolean>>({})

  // Fetch announcements
  useEffect(() => {
    if (!user) return

    const announcementsRef = ref(db, "announcements")

    const unsubscribe = onValue(announcementsRef, (snapshot) => {
      if (snapshot.exists()) {
        const announcementsData: any[] = []

        snapshot.forEach((childSnapshot) => {
          const announcementData = childSnapshot.val()
          const announcementId = childSnapshot.key as string

          // Check if this announcement is for this user
          const isForUser =
            announcementData.isGlobal || (announcementData.targetUsers && announcementData.targetUsers[user.uid])

          if (isForUser) {
            announcementsData.push({
              id: announcementId,
              ...announcementData,
              createdAt: announcementData.createdAt ? new Date(announcementData.createdAt) : new Date(),
            })
          }
        })

        // Sort by pinned first, then by creation date (newest first)
        announcementsData.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1
          if (!a.isPinned && b.isPinned) return 1
          return b.createdAt.getTime() - a.createdAt.getTime()
        })

        setAnnouncements(announcementsData)
      } else {
        setAnnouncements([])
      }
    })

    return () => unsubscribe()
  }, [user])

  // Load dismissed announcements from localStorage
  useEffect(() => {
    if (!user) return

    const savedDismissed = localStorage.getItem(`dismissed_announcements_${user.uid}`)
    if (savedDismissed) {
      try {
        setDismissedAnnouncements(JSON.parse(savedDismissed))
      } catch (error) {
        console.error("Error parsing dismissed announcements:", error)
      }
    }
  }, [user])

  // Handle dismiss announcement
  const handleDismiss = (announcementId: string) => {
    const newDismissed = {
      ...dismissedAnnouncements,
      [announcementId]: true,
    }

    setDismissedAnnouncements(newDismissed)

    // Save to localStorage
    if (user) {
      localStorage.setItem(`dismissed_announcements_${user.uid}`, JSON.stringify(newDismissed))
    }
  }

  // Filter out dismissed announcements, except for pinned ones
  const visibleAnnouncements = announcements.filter(
    (announcement) => announcement.isPinned || !dismissedAnnouncements[announcement.id],
  )

  if (visibleAnnouncements.length === 0) {
    return null
  }

  return (
    <div className="space-y-3 mb-4">
      {visibleAnnouncements.map((announcement) => (
        <Alert
          key={announcement.id}
          className={`relative ${
            announcement.isPinned ? "bg-yellow-900/30 border-yellow-800" : "bg-gray-900/30 border-gray-800"
          }`}
        >
          <div className="flex items-center">
            {announcement.isPinned ? (
              <Pin className="h-4 w-4 text-yellow-400 mr-2" />
            ) : (
              <Megaphone className="h-4 w-4 text-primary mr-2" />
            )}
            <AlertTitle className="text-white">{announcement.title}</AlertTitle>
          </div>
          <AlertDescription className="mt-2 text-gray-300">{announcement.message}</AlertDescription>
          <div className="mt-2 text-xs text-gray-400">
            {announcement.createdAt && formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDismiss(announcement.id)}
            className="absolute top-2 right-2 h-6 w-6 text-gray-400 hover:text-white hover:bg-gray-700"
          >
            <X className="h-4 w-4" />
          </Button>
        </Alert>
      ))}
    </div>
  )
}
