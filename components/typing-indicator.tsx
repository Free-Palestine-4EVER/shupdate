"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { ref, onValue, off } from "firebase/database"

interface TypingIndicatorProps {
  chatId: string
  currentUserId: string
}

export default function TypingIndicator({ chatId, currentUserId }: TypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<string[]>([])

  useEffect(() => {
    if (!chatId) return

    const typingRef = ref(db, `chats/${chatId}/typingUsers`)

    onValue(typingRef, (snapshot) => {
      if (snapshot.exists()) {
        const typingData = snapshot.val()
        // Filter out the current user and get only users who are typing
        const usersTyping = Object.entries(typingData)
          .filter(([userId, isTyping]) => userId !== currentUserId && isTyping === true)
          .map(([userId]) => userId)

        setTypingUsers(usersTyping)
      } else {
        setTypingUsers([])
      }
    })

    return () => {
      off(typingRef)
    }
  }, [chatId, currentUserId])

  if (typingUsers.length === 0) return null

  return (
    <div className="typing-indicator px-4 py-2 text-sm text-gray-400 italic">
      <div className="flex items-center">
        <span className="mr-2">Typing...</span>
        <span className="typing-animation">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </span>
      </div>
    </div>
  )
}
