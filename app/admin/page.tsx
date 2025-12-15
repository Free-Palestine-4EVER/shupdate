"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useFirebase } from "@/components/firebase-provider"
import AdminPanel from "@/components/admin/admin-panel"
import FirebaseProvider from "@/components/firebase-provider"
import MatrixBackground from "@/components/matrix-background"
import { Button } from "@/components/ui/button"

// Admin user ID
const ADMIN_USER_ID = "zzzz"

// Wrap the main component with FirebaseProvider
export default function AdminPageWrapper() {
  return (
    <FirebaseProvider>
      <AdminPage />
    </FirebaseProvider>
  )
}

function AdminPage() {
  const { user, loading } = useFirebase()
  const router = useRouter()

  // Redirect non-admin users
  useEffect(() => {
    if (!loading && (!user || user.uid !== ADMIN_USER_ID)) {
      router.push("/")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black overflow-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f4427e] mx-auto mb-4"></div>
          <p className="text-gray-400">Checking authentication...</p>
        </div>
      </div>
    )
  }

  if (!user || user.uid !== ADMIN_USER_ID) {
    return null // Will redirect
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Matrix background */}
      <MatrixBackground />

      {/* Admin navigation */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button onClick={() => router.push("/payment-verify")} className="bg-purple-600 hover:bg-purple-700 text-white">
          Payment Verification
        </Button>
        <Button onClick={() => router.push("/")} variant="outline" className="border-gray-700 text-gray-300">
          Back to Chat
        </Button>
      </div>

      {/* Content */}
      <div className="relative w-full h-full" style={{ zIndex: 1 }}>
        <AdminPanel />
      </div>
    </div>
  )
}
