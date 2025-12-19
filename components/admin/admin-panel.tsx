"use client"

import { useState, useEffect } from "react"
import { useFirebase } from "@/components/firebase-provider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import UserManagement from "@/components/admin/user-management"
import AnnouncementSystem from "@/components/admin/announcement-system"
import AnalyticsDashboard from "@/components/admin/analytics-dashboard"
import DeviceRequests from "@/components/admin/device-requests"

// Admin user ID
const ADMIN_USER_ID = "zzzz"

export default function AdminPanel() {
  const { user } = useFirebase()
  const [isAdmin, setIsAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState("devices")

  useEffect(() => {
    // Check if current user is admin
    if (user?.uid === ADMIN_USER_ID) {
      setIsAdmin(true)
    }
  }, [user])

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-6 max-w-md auth-card">
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-black/70 backdrop-filter backdrop-blur-sm">
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white">Admin Control Panel</h1>
        <p className="text-gray-400 text-sm">Manage users, messages, and system announcements</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="px-4 pt-2 border-b border-gray-800 bg-transparent">
          <TabsTrigger value="devices" className="data-[state=active]:bg-gray-800">
            Device Requests
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-gray-800">
            User Management
          </TabsTrigger>
          <TabsTrigger value="announcements" className="data-[state=active]:bg-gray-800">
            Announcements
          </TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-gray-800">
            Analytics
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto p-4">
          <TabsContent value="devices" className="h-full mt-0">
            <DeviceRequests />
          </TabsContent>

          <TabsContent value="users" className="h-full mt-0">
            <UserManagement />
          </TabsContent>

          <TabsContent value="announcements" className="h-full mt-0">
            <AnnouncementSystem />
          </TabsContent>

          <TabsContent value="analytics" className="h-full mt-0">
            <AnalyticsDashboard />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
