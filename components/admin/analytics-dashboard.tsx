"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Users, MessageSquare, Clock } from "lucide-react"
import { format, subDays, eachDayOfInterval } from "date-fns"

export default function AnalyticsDashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    newUsers: 0,
    totalMessages: 0,
    totalChats: 0,
    messagesByDay: [] as { date: string; count: number }[],
    usersByDay: [] as { date: string; count: number }[],
  })

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Get all users
        const usersRef = ref(db, "users")
        const usersSnapshot = await get(usersRef)

        let totalUsers = 0
        let activeUsers = 0
        let newUsers = 0
        const userCreationDates: Date[] = []

        const now = new Date()
        const thirtyDaysAgo = subDays(now, 30)
        const sevenDaysAgo = subDays(now, 7)

        if (usersSnapshot.exists()) {
          usersSnapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val()
            totalUsers++

            // Check if user was active in the last 7 days
            if (userData.lastSeen) {
              const lastSeen = new Date(userData.lastSeen)
              if (lastSeen >= sevenDaysAgo) {
                activeUsers++
              }
            }

            // Check if user was created in the last 30 days
            if (userData.createdAt) {
              const createdAt = new Date(userData.createdAt)
              if (createdAt >= thirtyDaysAgo) {
                newUsers++
                userCreationDates.push(createdAt)
              }
            }
          })
        }

        // Get all chats and messages
        const chatsRef = ref(db, "chats")
        const chatsSnapshot = await get(chatsRef)

        let totalChats = 0
        let totalMessages = 0
        const messageDates: Date[] = []

        if (chatsSnapshot.exists()) {
          chatsSnapshot.forEach((chatSnapshot) => {
            totalChats++

            const chatData = chatSnapshot.val()
            if (chatData.messages) {
              const messages = Object.values(chatData.messages) as any[]
              totalMessages += messages.length

              // Collect message timestamps for the last 30 days
              messages.forEach((message: any) => {
                if (message.timestamp) {
                  const timestamp = new Date(message.timestamp)
                  if (timestamp >= thirtyDaysAgo) {
                    messageDates.push(timestamp)
                  }
                }
              })
            }
          })
        }

        // Process message data by day
        const messagesByDay = processDataByDay(messageDates, thirtyDaysAgo, now)

        // Process user creation data by day
        const usersByDay = processDataByDay(userCreationDates, thirtyDaysAgo, now)

        setStats({
          totalUsers,
          activeUsers,
          newUsers,
          totalMessages,
          totalChats,
          messagesByDay,
          usersByDay,
        })
      } catch (error: any) {
        console.error("Error fetching analytics:", error)
        setError(`Failed to load analytics: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAnalytics()
  }, [])

  // Helper function to process data by day
  const processDataByDay = (dates: Date[], startDate: Date, endDate: Date) => {
    // Create an array of all days in the interval
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    // Initialize counts for each day
    const countsByDay = days.map((day) => ({
      date: format(day, "yyyy-MM-dd"),
      count: 0,
    }))

    // Count items for each day
    dates.forEach((date) => {
      const dateStr = format(date, "yyyy-MM-dd")
      const dayIndex = countsByDay.findIndex((d) => d.date === dateStr)
      if (dayIndex !== -1) {
        countsByDay[dayIndex].count++
      }
    })

    return countsByDay
  }

  // Helper function to get max value for chart scaling
  const getMaxValue = (data: { date: string; count: number }[]) => {
    const max = Math.max(...data.map((d) => d.count), 1)
    return max
  }

  const maxMessageCount = getMaxValue(stats.messagesByDay)
  const maxUserCount = getMaxValue(stats.usersByDay)

  return (
    <div className="h-full flex flex-col">
      {error && (
        <Alert variant="destructive" className="mb-4 bg-red-900/30 border-red-800">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-8 flex-1">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="space-y-6 overflow-auto">
          {/* Summary stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/30 rounded-md border border-gray-800 p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-md bg-blue-900/30 mr-3">
                  <Users className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Users</p>
                  <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-gray-400">Active (7d): {stats.activeUsers}</span>
                <span className="text-green-400">New (30d): +{stats.newUsers}</span>
              </div>
            </div>

            <div className="bg-gray-900/30 rounded-md border border-gray-800 p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-md bg-purple-900/30 mr-3">
                  <MessageSquare className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Messages</p>
                  <p className="text-2xl font-bold text-white">{stats.totalMessages}</p>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-gray-400">Chats: {stats.totalChats}</span>
                <span className="text-purple-400">
                  Avg: {stats.totalChats ? Math.round(stats.totalMessages / stats.totalChats) : 0}/chat
                </span>
              </div>
            </div>

            <div className="bg-gray-900/30 rounded-md border border-gray-800 p-4">
              <div className="flex items-center">
                <div className="p-2 rounded-md bg-pink-900/30 mr-3">
                  <Clock className="h-6 w-6 text-pink-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Activity Today</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.messagesByDay[stats.messagesByDay.length - 1]?.count || 0}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-gray-400">Messages</span>
                <span className="text-pink-400">
                  New users: {stats.usersByDay[stats.usersByDay.length - 1]?.count || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Message volume chart */}
          <div className="bg-gray-900/30 rounded-md border border-gray-800 p-4">
            <h3 className="font-medium text-white mb-4">Message Volume (Last 30 Days)</h3>
            <div className="h-60">
              <div className="flex h-48 items-end space-x-1">
                {stats.messagesByDay.map((day, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div
                      className="w-full bg-purple-500/70 hover:bg-purple-500 rounded-t transition-all"
                      style={{
                        height: `${maxMessageCount ? (day.count / maxMessageCount) * 100 : 0}%`,
                        minHeight: day.count ? "4px" : "0",
                      }}
                    ></div>
                    <div className="text-xs text-gray-500 mt-1 rotate-90 origin-left translate-y-6 absolute bottom-0">
                      {format(new Date(day.date), "MM/dd")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* New users chart */}
          <div className="bg-gray-900/30 rounded-md border border-gray-800 p-4">
            <h3 className="font-medium text-white mb-4">New User Registrations (Last 30 Days)</h3>
            <div className="h-60">
              <div className="flex h-48 items-end space-x-1">
                {stats.usersByDay.map((day, index) => (
                  <div key={index} className="flex flex-col items-center flex-1">
                    <div
                      className="w-full bg-blue-500/70 hover:bg-blue-500 rounded-t transition-all"
                      style={{
                        height: `${maxUserCount ? (day.count / maxUserCount) * 100 : 0}%`,
                        minHeight: day.count ? "4px" : "0",
                      }}
                    ></div>
                    <div className="text-xs text-gray-500 mt-1 rotate-90 origin-left translate-y-6 absolute bottom-0">
                      {format(new Date(day.date), "MM/dd")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
