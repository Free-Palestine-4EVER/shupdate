"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, Crown, UserMinus, UserPlus, Search } from "lucide-react"
import Image from "next/image"
import type { User, Chat } from "@/lib/types"
import { db } from "@/lib/firebase"
import { ref, update } from "firebase/database"

interface GroupMembersModalProps {
  isOpen: boolean
  onClose: () => void
  group: Chat | null
  currentUser: User | null
  users: User[]
}

export default function GroupMembersModal({ isOpen, onClose, group, currentUser, users }: GroupMembersModalProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)

  if (!group || !group.isGroup) return null

  const isCurrentUserAdmin =
    currentUser &&
    group.admins &&
    (Array.isArray(group.admins) ? group.admins.includes(currentUser.id) : group.admins[currentUser.id] === true)

  const participantIds = Array.isArray(group.participants) ? group.participants : Object.keys(group.participants || {})

  const groupMembers = users.filter((user) => participantIds.includes(user.id))
  const nonMembers = users.filter((user) => !participantIds.includes(user.id) && user.id !== currentUser?.id)

  const filteredNonMembers = nonMembers.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const isUserAdmin = (userId: string) => {
    if (!group.admins) return false
    return Array.isArray(group.admins) ? group.admins.includes(userId) : group.admins[userId] === true
  }

  const handleAddMember = async (userId: string) => {
    if (!group || !currentUser || !isCurrentUserAdmin) return

    setIsUpdating(true)
    try {
      const groupRef = ref(db, `groups/${group.id}`)
      await update(groupRef, {
        [`participants/${userId}`]: true,
        updatedAt: Date.now(),
      })
    } catch (error) {
      console.error("Error adding member:", error)
      alert("Failed to add member")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!group || !currentUser || !isCurrentUserAdmin || userId === currentUser.id) return
    if (!confirm("Are you sure you want to remove this member?")) return

    setIsUpdating(true)
    try {
      const groupRef = ref(db, `groups/${group.id}`)
      await update(groupRef, {
        [`participants/${userId}`]: null,
        [`admins/${userId}`]: null, // Also remove admin status
        updatedAt: Date.now(),
      })
    } catch (error) {
      console.error("Error removing member:", error)
      alert("Failed to remove member")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleToggleAdmin = async (userId: string) => {
    if (!group || !currentUser || !isCurrentUserAdmin || userId === currentUser.id) return

    setIsUpdating(true)
    try {
      const groupRef = ref(db, `groups/${group.id}`)
      const isAdmin = isUserAdmin(userId)

      await update(groupRef, {
        [`admins/${userId}`]: isAdmin ? null : true,
        updatedAt: Date.now(),
      })
    } catch (error) {
      console.error("Error toggling admin:", error)
      alert("Failed to update admin status")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 border-gray-700 max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5" />
            {group.name} Members ({groupMembers.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          {/* Current Members */}
          <div>
            <h3 className="text-sm font-medium text-gray-300 mb-2">Members</h3>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {groupMembers.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                  <div className="flex items-center space-x-3">
                    <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-600">
                      <Image
                        src={member.photoURL || "/placeholder.svg"}
                        alt={member.username}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <span className="text-white text-sm">{member.username}</span>
                      {isUserAdmin(member.id) && <Crown className="inline h-3 w-3 text-yellow-500 ml-1" />}
                      {member.id === group.createdBy && <span className="text-xs text-gray-400 ml-1">(Creator)</span>}
                    </div>
                  </div>

                  {isCurrentUserAdmin && member.id !== currentUser?.id && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleAdmin(member.id)}
                        disabled={isUpdating}
                        className="h-6 w-6 p-0 text-yellow-500 hover:bg-yellow-500/20"
                        title={isUserAdmin(member.id) ? "Remove admin" : "Make admin"}
                      >
                        <Crown className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={isUpdating}
                        className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/20"
                        title="Remove member"
                      >
                        <UserMinus className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add Members (only for admins) */}
          {isCurrentUserAdmin && nonMembers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">Add Members</h3>

              <div className="relative mb-2">
                <Input
                  placeholder="Search users to add"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-gray-800 border-gray-600 text-white"
                />
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              </div>

              <div className="max-h-32 overflow-y-auto space-y-2">
                {filteredNonMembers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                    <div className="flex items-center space-x-3">
                      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-gray-600">
                        <Image
                          src={user.photoURL || "/placeholder.svg"}
                          alt={user.username}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <span className="text-white text-sm">{user.username}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAddMember(user.id)}
                      disabled={isUpdating}
                      className="h-6 w-6 p-0 text-green-500 hover:bg-green-500/20"
                      title="Add member"
                    >
                      <UserPlus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {filteredNonMembers.length === 0 && searchQuery && (
                  <p className="text-gray-400 text-sm text-center py-2">No users found</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="pt-4">
          <Button onClick={onClose} className="w-full bg-gray-700 hover:bg-gray-600 text-white">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
