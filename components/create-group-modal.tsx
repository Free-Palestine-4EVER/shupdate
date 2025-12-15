"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Users, Search, X, Upload } from "lucide-react"
import type { User } from "@/lib/types"
import { db, storage } from "@/lib/firebase"
import { ref as dbRef, push, set, serverTimestamp } from "firebase/database"
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  currentUser: User | null
  users: User[]
  onGroupCreated: (groupId: string) => void
}

export default function CreateGroupModal({
  isOpen,
  onClose,
  currentUser,
  users,
  onGroupCreated,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [groupPhoto, setGroupPhoto] = useState("")
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Filter users based on search term
  const filteredUsers = users.filter(
    (user) =>
      user.id !== currentUser?.id && // Exclude current user
      user.username.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all form state when modal closes
      setGroupName("")
      setGroupDescription("")
      setGroupPhoto("")
      setSelectedUsers([])
      setSearchTerm("")
      setError(null)
      setIsLoading(false)
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [isOpen])

  const handleUserToggle = (userId: string) => {
    setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]))
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentUser) return

    setIsUploading(true)
    setUploadProgress(0)
    setError(null)

    try {
      const fileRef = storageRef(storage, `group_photos/${Date.now()}_${file.name}`)
      const uploadTask = uploadBytesResumable(fileRef, file)

      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)
        },
        (error) => {
          console.error("Error uploading photo:", error)
          setError(`Failed to upload photo: ${error.message}`)
          setIsUploading(false)
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          setGroupPhoto(downloadURL)
          setIsUploading(false)
          setUploadProgress(0)
        },
      )
    } catch (error: any) {
      console.error("Error starting upload:", error)
      setError(`Failed to start upload: ${error.message}`)
      setIsUploading(false)
    }
  }

  const handleCreateGroup = async () => {
    if (!currentUser || !groupName.trim() || selectedUsers.length === 0) {
      setError("Please provide a group name and select at least one member")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Create the group in Firebase
      const groupsRef = dbRef(db, "groups")
      const newGroupRef = push(groupsRef)

      // Include current user in participants
      const participants = [currentUser.id, ...selectedUsers]

      const groupData = {
        name: groupName.trim(),
        description: groupDescription.trim(),
        photoURL: groupPhoto || "/placeholder.svg",
        participants: participants,
        createdBy: currentUser.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isGroup: true,
        lastMessage: null,
      }

      await set(newGroupRef, groupData)

      // Call the callback with the new group ID
      onGroupCreated(newGroupRef.key!)

      // Close the modal
      onClose()
    } catch (error: any) {
      console.error("Error creating group:", error)
      setError(`Failed to create group: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!currentUser) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gray-900 border-gray-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Create Group
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-red-900/30 border-red-800">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Group Photo */}
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={groupPhoto || "/placeholder.svg"} />
              <AvatarFallback className="bg-gray-700 text-white text-lg">
                <Users className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Label htmlFor="group-photo-upload" className="cursor-pointer">
                <Button
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-700 bg-transparent"
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : "Add Photo"}
                </Button>
                <input
                  id="group-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </Label>
            </div>
          </div>

          {/* Group Name */}
          <div>
            <Label htmlFor="group-name">Group Name *</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="bg-gray-800 border-gray-600 text-white"
              placeholder="Enter group name"
              maxLength={50}
            />
          </div>

          {/* Group Description */}
          <div>
            <Label htmlFor="group-description">Description (Optional)</Label>
            <Textarea
              id="group-description"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              className="bg-gray-800 border-gray-600 text-white"
              placeholder="What's this group about?"
              rows={2}
              maxLength={200}
            />
          </div>

          {/* Search Users */}
          <div>
            <Label htmlFor="user-search">Add Members *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="user-search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-800 border-gray-600 text-white pl-10"
                placeholder="Search users..."
              />
            </div>
          </div>

          {/* Users List */}
          <div className="max-h-48 overflow-y-auto space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center text-gray-400 py-4">
                {searchTerm ? "No users found matching your search" : "No users available"}
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-800">
                  <Checkbox
                    id={`user-${user.id}`}
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => handleUserToggle(user.id)}
                    className="border-gray-600"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL || "/placeholder.svg"} />
                    <AvatarFallback className="bg-gray-700 text-white text-sm">
                      {user.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Label htmlFor={`user-${user.id}`} className="flex-1 cursor-pointer text-white">
                    {user.username}
                  </Label>
                </div>
              ))
            )}
          </div>

          {/* Selected Users Count */}
          {selectedUsers.length > 0 && (
            <div className="text-sm text-gray-400">
              {selectedUsers.length} member{selectedUsers.length !== 1 ? "s" : ""} selected
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} className="border-gray-600 hover:bg-gray-700 bg-transparent">
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={isLoading || !groupName.trim() || selectedUsers.length === 0 || isUploading}
              className="bg-primary hover:bg-primary/90"
            >
              {isLoading ? "Creating..." : "Create Group"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
