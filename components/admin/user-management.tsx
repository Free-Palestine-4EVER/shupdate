"use client"

import { useState, useEffect } from "react"
import { db, storage } from "@/lib/firebase"
import { ref as dbRef, get, update, query, orderByChild } from "firebase/database"
import { ref as storageRef, deleteObject } from "firebase/storage"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Search, UserX, Edit, RefreshCw, CheckCircle, Trash2, AlertTriangle, RotateCcw, Key } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"
import { adminDeleteUserCompletely, resetAllPasscodesForFreshStart, resetPasscodesOnly } from "@/lib/admin-delete-user"
import { generateKeyPair } from "@/lib/encryption"

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([])
  const [filteredUsers, setFilteredUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editUsername, setEditUsername] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [userIdToVerify, setUserIdToVerify] = useState("")
  const [verifyStatus, setVerifyStatus] = useState<{ message: string; isError: boolean } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isResettingPasscodes, setIsResettingPasscodes] = useState(false)
  const [isProvisioningKeys, setIsProvisioningKeys] = useState(false)

  // Fetch all users
  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const usersRef = dbRef(db, "users")
        const usersQuery = query(usersRef, orderByChild("createdAt"))
        const snapshot = await get(usersQuery)

        if (snapshot.exists()) {
          const usersData: any[] = []

          snapshot.forEach((childSnapshot) => {
            const userData = childSnapshot.val()
            usersData.push({
              id: childSnapshot.key,
              ...userData,
              lastSeen: userData.lastSeen ? new Date(userData.lastSeen) : null,
              createdAt: userData.createdAt ? new Date(userData.createdAt) : new Date(),
            })
          })

          // Sort by creation date (newest first)
          usersData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

          setUsers(usersData)
          setFilteredUsers(usersData)
        } else {
          setUsers([])
          setFilteredUsers([])
        }
      } catch (error: any) {
        console.error("Error fetching users:", error)
        setError(`Failed to load users: ${error.message}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchUsers()
  }, [])

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users)
      return
    }

    const query = searchQuery.toLowerCase()
    const filtered = users.filter(
      (user) =>
        user.username?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        user.id?.toLowerCase().includes(query),
    )

    setFilteredUsers(filtered)
  }, [searchQuery, users])

  // Handle user ban/unban
  const handleToggleBan = async (userId: string, isBanned: boolean) => {
    try {
      const userRef = dbRef(db, `users/${userId}`)

      await update(userRef, {
        isBanned: !isBanned,
        ...(isBanned ? { unbannedAt: new Date().toISOString() } : { bannedAt: new Date().toISOString() }),
      })

      // Update local state
      setUsers(users.map((user) => (user.id === userId ? { ...user, isBanned: !isBanned } : user)))

      setFilteredUsers(filteredUsers.map((user) => (user.id === userId ? { ...user, isBanned: !isBanned } : user)))

      if (selectedUser?.id === userId) {
        setSelectedUser({ ...selectedUser, isBanned: !isBanned })
      }

      setSuccessMessage(`User ${!isBanned ? "banned" : "unbanned"} successfully`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      console.error("Error toggling ban status:", error)
      setError(`Failed to update user: ${error.message}`)
    }
  }

  // Handle edit profile
  const handleEditProfile = () => {
    if (!selectedUser) return

    setEditUsername(selectedUser.username || "")
    setShowEditDialog(true)
  }

  // Save edited profile
  const handleSaveProfile = async () => {
    if (!selectedUser || !editUsername.trim()) return

    setIsSaving(true)

    try {
      const userRef = dbRef(db, `users/${selectedUser.id}`)

      await update(userRef, {
        username: editUsername,
        updatedAt: new Date().toISOString(),
      })

      // Update local state
      setUsers(users.map((user) => (user.id === selectedUser.id ? { ...user, username: editUsername } : user)))

      setFilteredUsers(
        filteredUsers.map((user) => (user.id === selectedUser.id ? { ...user, username: editUsername } : user)),
      )

      setSelectedUser({ ...selectedUser, username: editUsername })
      setShowEditDialog(false)

      setSuccessMessage("User profile updated successfully")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      console.error("Error updating profile:", error)
      setError(`Failed to update profile: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle reset profile picture
  const handleResetProfilePicture = async () => {
    if (!selectedUser || !selectedUser.photoURL) return

    if (!window.confirm("Are you sure you want to reset this user's profile picture?")) return

    try {
      // First try to delete the old image from storage if it's in our storage
      if (selectedUser.photoURL.includes("firebase")) {
        try {
          const urlPath = selectedUser.photoURL.split("?")[0].split("/o/")[1]
          if (urlPath) {
            const decodedPath = decodeURIComponent(urlPath)
            const imageRef = storageRef(storage, decodedPath)
            await deleteObject(imageRef)
          }
        } catch (storageError) {
          console.error("Error deleting profile picture from storage:", storageError)
          // Continue anyway since we'll update the database
        }
      }

      // Generate a default avatar URL
      const defaultPhotoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedUser.username)}&background=random`

      // Update the user's profile picture in the database
      const userRef = dbRef(db, `users/${selectedUser.id}`)
      await update(userRef, {
        photoURL: defaultPhotoURL,
        updatedAt: new Date().toISOString(),
      })

      // Update local state
      setUsers(users.map((user) => (user.id === selectedUser.id ? { ...user, photoURL: defaultPhotoURL } : user)))

      setFilteredUsers(
        filteredUsers.map((user) => (user.id === selectedUser.id ? { ...user, photoURL: defaultPhotoURL } : user)),
      )

      setSelectedUser({ ...selectedUser, photoURL: defaultPhotoURL })

      setSuccessMessage("Profile picture reset successfully")
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error: any) {
      console.error("Error resetting profile picture:", error)
      setError(`Failed to reset profile picture: ${error.message}`)
    }
  }

  // Update the handleVerifyUser function to redirect to payment-verify page
  const handleVerifyUser = async () => {
    if (!userIdToVerify.trim()) {
      setVerifyStatus({ message: "Please enter a user ID", isError: true })
      return
    }

    try {
      // Check if user exists
      const userRef = dbRef(db, `users/${userIdToVerify}`)
      const snapshot = await get(userRef)

      if (!snapshot.exists()) {
        setVerifyStatus({ message: "User not found", isError: true })
        return
      }

      // Redirect to payment verification page with the user ID
      window.open(`/payment-verify?userId=${userIdToVerify}`, "_blank")

      setVerifyStatus({ message: "Redirecting to payment verification page", isError: false })
      setUserIdToVerify("")

      // Clear status after 3 seconds
      setTimeout(() => {
        setVerifyStatus(null)
      }, 3000)
    } catch (error: any) {
      console.error("Error verifying user:", error)
      setVerifyStatus({ message: `Error: ${error.message}`, isError: true })
    }
  }

  // Handle delete user completely
  const handleDeleteUser = async () => {
    if (!selectedUser) return

    setIsDeleting(true)
    setError(null)

    try {
      const result = await adminDeleteUserCompletely(selectedUser.id)

      if (result.success) {
        // Remove user from local state
        setUsers(users.filter((user) => user.id !== selectedUser.id))
        setFilteredUsers(filteredUsers.filter((user) => user.id !== selectedUser.id))
        setSelectedUser(null)

        setSuccessMessage(
          `User deleted successfully. Removed ${result.deletedChats} chats, ${result.deletedMessages} messages, ${result.deletedGroups} groups.`
        )
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setError(`Failed to delete user: ${result.error}`)
      }
    } catch (error: any) {
      console.error("Error deleting user:", error)
      setError(`Failed to delete user: ${error.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  // Handle reset all passcodes
  const handleResetAllPasscodes = async () => {
    setIsResettingPasscodes(true)
    setError(null)

    try {
      const result = await resetAllPasscodesForFreshStart()

      if (result.success) {
        setSuccessMessage(
          `Fresh start initiated! Reset passcodes for ${result.resetCount} users. All users will need to set up new PINs and encryption keys.`
        )
        setTimeout(() => setSuccessMessage(null), 5000)
      } else {
        setError(`Failed to reset passcodes: ${result.error}`)
      }
    } catch (error: any) {
      console.error("Error resetting passcodes:", error)
      setError(`Failed to reset passcodes: ${error.message}`)
    } finally {
      setIsResettingPasscodes(false)
    }
  }

  // Handle provision keys for all users
  const handleProvisionKeys = async () => {
    setIsProvisioningKeys(true)
    setError(null)
    setSuccessMessage(null)

    try {
      let provisionedCount = 0
      const updates: Record<string, any> = {}

      // Fetch all users again to be sure
      const usersRef = dbRef(db, "users")
      const snapshot = await get(usersRef)

      if (snapshot.exists()) {
        const usersData = snapshot.val()

        // Iterate effectively
        const userIds = Object.keys(usersData)

        for (const uid of userIds) {
          const user = usersData[uid]

          // Generate new keypair for EVERY user (or checks if missing? The user said "create key for every user immediately/manually")
          // Logic: If user has no public key, DEFINITELY provision.
          // If user HAS public key but we want to Force assign?
          // Let's provision if missing OR if we want to ensure everyone has one.
          // Safest is to check !user.publicKey first to avoid overwriting active users.
          // BUT the user said "assign unique key to every user" implies potentially overwriting if they are broken.
          // Let's stick to "If missing" to be safe, but maybe add a force option later?
          // Actually, let's overwrite for this specific admin request to ensure they work.
          // WAIT, overwriting effectively resets their E2E identity. 
          // If they are "sleeping" and have no key (offline), they have no key.

          if (!user.publicKey) {
            console.log(`Provisioning keys for user ${uid} (${user.username})...`)

            // Generate keypair
            const { publicKey, privateKey } = await generateKeyPair()

            // Export private key to string/JSON for storage
            const exportedPrivateKey = await crypto.subtle.exportKey("jwk", privateKey)

            updates[`users/${uid}/publicKey`] = publicKey
            // Store private key in a special admin-provisioned field
            // The client will pick this up upon login
            updates[`users/${uid}/provisionedPrivateKey`] = JSON.stringify(exportedPrivateKey)

            provisionedCount++
          }
        }

        if (Object.keys(updates).length > 0) {
          await update(dbRef(db), updates)
          setSuccessMessage(`Successfully provisioned encryption keys for ${provisionedCount} users. They can now receive messages.`)
        } else {
          setSuccessMessage("All users already have encryption keys.")
        }
      }
    } catch (error: any) {
      console.error("Error provisioning keys:", error)
      setError(`Failed to provision keys: ${error.message}`)
    } finally {
      setIsProvisioningKeys(false)
    }
  }

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

      {verifyStatus && (
        <Alert
          className={`mb-4 ${verifyStatus.isError ? "bg-red-900/30 border-red-800" : "bg-green-900/30 border-green-800"}`}
        >
          <AlertDescription>{verifyStatus.message}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search users by name, email or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 custom-input"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
          <Input
            placeholder="User ID to Verify"
            value={userIdToVerify}
            onChange={(e) => setUserIdToVerify(e.target.value)}
            className="custom-input sm:w-40"
          />
          <Button onClick={handleVerifyUser} className="btn-primary w-full sm:w-auto">
            Verify User
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isResettingPasscodes}
                className="border-orange-600 text-orange-500 hover:bg-orange-900/20 w-full sm:w-auto"
              >
                {isResettingPasscodes ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Resetting...</>
                ) : (
                  <><RotateCcw className="h-4 w-4 mr-1" /> Reset All PINs</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center text-orange-500">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Reset All Passcodes - Fresh Start
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300">
                  This will reset <strong>ALL USER PASSCODES</strong>, device registrations, and encryption keys.
                  <br /><br />
                  <strong>Every user will need to:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Set up a new PIN on their next login</li>
                    <li>Re-register their device</li>
                    <li>Generate new encryption keys</li>
                  </ul>
                  <br />
                  Are you sure you want to proceed?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetAllPasscodes}
                  className="bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                >
                  Yes, Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>



          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                disabled={isProvisioningKeys}
                className="border-blue-600 text-blue-500 hover:bg-blue-900/20 w-full sm:w-auto"
              >
                {isProvisioningKeys ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Provisioning...</>
                ) : (
                  <><Key className="h-4 w-4 mr-1" /> Assign Keys</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center text-blue-500">
                  <Key className="mr-2 h-5 w-5" />
                  Assign Missing Encryption Keys
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-300">
                  This will generate and assign encryption keys for <strong>ALL USERS</strong> who are currently missing them.
                  <br /><br />
                  This allows you to send messages to users who haven't logged in recently or are offline ("sleeping").
                  <br />
                  The users will automatically adopt these keys when they next login.
                  <br /><br />
                  Proceed?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleProvisionKeys}
                  className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                >
                  Yes, Assign Keys
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>


      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        {/* User list */}
        <div className="w-full md:w-1/2 overflow-auto bg-gray-900/30 rounded-md border border-gray-800">
          <div className="p-3 border-b border-gray-800">
            <h3 className="font-medium text-white">Users ({filteredUsers.length})</h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-gray-400">
              {searchQuery ? "No users match your search" : "No users found"}
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className={`p-3 hover:bg-gray-800 cursor-pointer ${selectedUser?.id === user.id ? "bg-gray-800" : ""}`}
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="flex items-center space-x-3">
                    {user.photoURL && (
                      <Image
                        src={user.photoURL || "/placeholder.svg"}
                        alt={user.username || "User"}
                        width={40}
                        height={40}
                        className="rounded-full object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <p className="font-medium text-white truncate">{user.username || "Unnamed User"}</p>
                        {user.isBanned && (
                          <Badge variant="destructive" className="ml-2">
                            Banned
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 truncate">{user.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User details */}
        <div className="w-full md:w-1/2 overflow-auto bg-gray-900/30 rounded-md border border-gray-800">
          {selectedUser ? (
            <div>
              <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-medium text-white">User Details</h3>
                <div className="flex space-x-2">
                  <Button
                    variant={selectedUser.isBanned ? "outline" : "destructive"}
                    size="sm"
                    onClick={() => handleToggleBan(selectedUser.id, selectedUser.isBanned)}
                  >
                    {selectedUser.isBanned ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" /> Unban
                      </>
                    ) : (
                      <>
                        <UserX className="h-4 w-4 mr-1" /> Ban
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEditProfile}>
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={isDeleting}>
                        {isDeleting ? (
                          <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Deleting...</>
                        ) : (
                          <><Trash2 className="h-4 w-4 mr-1" /> Delete</>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center text-red-500">
                          <AlertTriangle className="mr-2 h-5 w-5" />
                          Delete User Permanently
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-300">
                          This will <strong>PERMANENTLY DELETE</strong> user <strong>{selectedUser.username}</strong> and:
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>All their chats and messages</li>
                            <li>All chats they participated in (other users will lose these chats too)</li>
                            <li>Their payments and security data</li>
                            <li>Group memberships</li>
                          </ul>
                          <br />
                          This action <strong>CANNOT BE UNDONE</strong>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteUser}
                          className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                        >
                          Yes, Delete User
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="p-4">
                <div className="flex flex-col items-center mb-4">
                  {selectedUser.photoURL && (
                    <div className="relative mb-2">
                      <Image
                        src={selectedUser.photoURL || "/placeholder.svg"}
                        alt={selectedUser.username || "User"}
                        width={100}
                        height={100}
                        className="rounded-full object-cover"
                      />
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={handleResetProfilePicture} className="mt-2">
                    Reset Profile Picture
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-400">Username</p>
                    <p className="font-medium text-white">{selectedUser.username || "Not set"}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="font-medium text-white">{selectedUser.email || "Not set"}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">User ID</p>
                    <p className="font-mono text-xs bg-gray-800 p-1 rounded mt-1">{selectedUser.id}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Account Created</p>
                    <p className="font-medium text-white">
                      {selectedUser.createdAt
                        ? formatDistanceToNow(new Date(selectedUser.createdAt), { addSuffix: true })
                        : "Unknown"}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Last Seen</p>
                    <p className="font-medium text-white">
                      {selectedUser.lastSeen
                        ? formatDistanceToNow(new Date(selectedUser.lastSeen), { addSuffix: true })
                        : "Never"}
                    </p>
                  </div>

                  {selectedUser.isBanned && (
                    <div>
                      <p className="text-sm text-gray-400">Banned At</p>
                      <p className="font-medium text-red-400">
                        {selectedUser.bannedAt
                          ? formatDistanceToNow(new Date(selectedUser.bannedAt), { addSuffix: true })
                          : "Unknown"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">Select a user to view details</div>
          )}
        </div>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md auth-card">
          <DialogHeader>
            <DialogTitle className="text-white">Edit User Profile</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm text-gray-400">
                  Username
                </label>
                <Input
                  id="username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="custom-input"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="border-gray-700">
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSaving || !editUsername.trim()} className="btn-primary">
              {isSaving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}
