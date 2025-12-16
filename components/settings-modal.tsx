"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { db, storage } from "@/lib/firebase"
import { ref as dbRef, update, get } from "firebase/database"
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage"
import { updateProfile } from "firebase/auth"
import { useFirebase } from "./firebase-provider"
import { generatePasscodeHash, verifyPasscode } from "@/lib/passcode-utils"
import { X } from "lucide-react"
import Image from "next/image"
import { BellRing, Calendar, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { getPrivateKey, encryptPrivateKeyWithPasscode } from "@/lib/encryption"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  user: any
  activeTab?: string
}

export default function SettingsModal({ isOpen, onClose, user, activeTab = "profile" }: SettingsModalProps) {
  const { user: authUser } = useFirebase()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [passcodeEnabled, setPasscodeEnabled] = useState(false)
  const [currentPasscode, setCurrentPasscode] = useState("")
  const [newPasscode, setNewPasscode] = useState("")
  const [confirmPasscode, setConfirmPasscode] = useState("")
  const [passcodeError, setPasscodeError] = useState("")
  const [passcodeSuccess, setPasscodeSuccess] = useState("")
  const [hasPasscode, setHasPasscode] = useState(false)
  const [isLoadingPasscode, setIsLoadingPasscode] = useState(true)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notificationSuccess, setNotificationSuccess] = useState(false)
  const [currentTab, setCurrentTab] = useState(activeTab)
  const { toast } = useToast()
  const [subscriptionPlan, setSubscriptionPlan] = useState("Free")
  const [subscriptionActive, setSubscriptionActive] = useState(false)
  const [daysLeft, setDaysLeft] = useState(0)
  const [expiryDate, setExpiryDate] = useState<Date | null>(null)
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false)

  // Force admin tab for user with ID "zzzz"
  useEffect(() => {
    if (user && user.id === "zzzz") {
      console.log("User is zzzz, setting admin to true")
      setIsAdmin(true)
    }
  }, [user])

  // Set active tab when prop changes
  useEffect(() => {
    if (activeTab) {
      setCurrentTab(activeTab)
    }
  }, [activeTab])

  // Load user data when modal opens - separated subscription loading
  useEffect(() => {
    if (isOpen && user) {
      console.log("Loading user data for settings:", user)
      setUsername(user.username || "")

      // Make sure we're using the actual photoURL from the user object
      if (user.photoURL) {
        console.log("Setting avatar preview from user data:", user.photoURL)
        setAvatarPreview(user.photoURL)
      }

      // Debug log
      console.log("Current user ID:", user.id)

      // Force admin for zzzz user ID
      if (user.id === "zzzz") {
        console.log("Setting admin to true for zzzz user")
        setIsAdmin(true)
      }

      // Load basic user data first
      const userRef = dbRef(db, `users/${user.id}`)
      get(userRef).then((snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.val()
          console.log("User data from database:", userData)

          // Check for admin status
          const isUserAdmin = userData.isAdmin === true || user.id === "zzzz"
          console.log("Is user admin?", isUserAdmin)
          setIsAdmin(isUserAdmin)

          // Check if user has passcode
          setIsLoadingPasscode(true)
          if (userData.passcode) {
            setPasscodeEnabled(userData.passcode.isEnabled === true)
            setHasPasscode(!!userData.passcode.hash && !!userData.passcode.salt)
          } else {
            setPasscodeEnabled(false)
            setHasPasscode(false)
          }
          setIsLoadingPasscode(false)
        }
      })
    }
  }, [user, isOpen])

  // Separate effect for subscription data to prevent glitching
  useEffect(() => {
    if (isOpen && user && currentTab === "profile") {
      setIsLoadingSubscription(true)

      const userRef = dbRef(db, `users/${user.id}`)
      get(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.val()

            // Get subscription info
            if (userData.payment) {
              console.log("Payment data:", userData.payment)

              // Set subscription plan
              setSubscriptionPlan(userData.payment.planName || "Premium")
              setSubscriptionActive(userData.payment.status === "verified")

              // Calculate days left if expiry date exists
              if (userData.payment.expiresAt) {
                const expiry = new Date(userData.payment.expiresAt)
                setExpiryDate(expiry)

                const today = new Date()
                const diffTime = expiry.getTime() - today.getTime()
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                setDaysLeft(diffDays > 0 ? diffDays : 0)
                console.log(`Subscription expires in ${diffDays} days`)
              } else {
                // For lifetime subscriptions or if no expiry date
                if (userData.payment.plan === "lifetime") {
                  setDaysLeft(36500) // ~100 years
                  console.log("Lifetime subscription detected")
                } else {
                  setDaysLeft(0)
                }
                setExpiryDate(null)
              }
            } else {
              console.log("No payment data found")
              setSubscriptionPlan("Free")
              setSubscriptionActive(false)
              setDaysLeft(0)
              setExpiryDate(null)
            }
          }
          setIsLoadingSubscription(false)
        })
        .catch((error) => {
          console.error("Error loading subscription data:", error)
          setIsLoadingSubscription(false)
        })
    }
  }, [user, isOpen, currentTab])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setAvatarFile(file)

      // Create a local preview URL
      const previewUrl = URL.createObjectURL(file)
      console.log("Created preview URL for new avatar:", previewUrl)
      setAvatarPreview(previewUrl)
    }
  }

  const handleSaveProfile = async () => {
    if (!user || !authUser) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      let photoURL = user.photoURL

      if (avatarFile) {
        console.log("Uploading new avatar file")
        const avatarRef = storageRef(storage, `avatars/${user.id}`)
        await uploadBytes(avatarRef, avatarFile)
        photoURL = await getDownloadURL(avatarRef)
        console.log("New avatar URL:", photoURL)
      }

      // Update in Firebase Realtime Database
      const userRef = dbRef(db, `users/${user.id}`)
      await update(userRef, {
        username,
        photoURL,
        updatedAt: new Date().toISOString(),
      })

      // Also update in Firebase Auth profile
      try {
        console.log("Updating Firebase Auth profile")
        await updateProfile(authUser, {
          displayName: username,
          photoURL: photoURL,
        })
      } catch (authError) {
        console.error("Error updating auth profile:", authError)
        // Continue anyway since database was updated
      }

      // Update local user object to reflect changes immediately
      user.username = username
      user.photoURL = photoURL

      console.log("Profile updated successfully")
      setSaveSuccess(true)

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false)
      }, 3000)
    } catch (error) {
      console.error("Error saving profile:", error)
      alert("Failed to save profile changes. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasscodeToggle = async (enabled: boolean) => {
    if (!user) return

    if (enabled && !hasPasscode) {
      // Don't enable if no passcode set
      return
    }

    try {
      const userRef = dbRef(db, `users/${user.id}`)
      await update(userRef, {
        "passcode/isEnabled": enabled,
      })
      setPasscodeEnabled(enabled)
    } catch (error) {
      console.error("Error updating passcode settings:", error)
    }
  }

  const handleSetupPasscode = async () => {
    if (!user || newPasscode !== confirmPasscode) {
      setPasscodeError("Passcodes do not match")
      return
    }

    if (newPasscode.length !== 6 || !/^\d+$/.test(newPasscode)) {
      setPasscodeError("Passcode must be 6 digits")
      return
    }

    try {
      setIsSaving(true)
      setPasscodeError("")

      // If changing passcode, verify current one first
      if (hasPasscode) {
        const userRef = dbRef(db, `users/${user.id}`)
        const snapshot = await get(userRef)

        if (snapshot.exists()) {
          const userData = snapshot.val()
          const isValid = verifyPasscode(currentPasscode, userData.passcode?.hash || "", userData.passcode?.salt || "")

          if (!isValid) {
            setPasscodeError("Current passcode is incorrect")
            setIsSaving(false)
            return
          }
        }
      }

      // Generate new passcode hash
      const { hash, salt } = generatePasscodeHash(newPasscode)

      // Get private key and encrypt with new passcode for cloud sync
      const privateKey = await getPrivateKey(user.id)
      let encryptedKeyData = null

      if (privateKey) {
        encryptedKeyData = await encryptPrivateKeyWithPasscode(privateKey, newPasscode)
        console.log("Private key re-encrypted with new passcode")
      }

      // Save to database (passcode hash + encrypted key)
      const userRef = dbRef(db, `users/${user.id}`)
      const updateData: any = {
        passcode: {
          hash,
          salt,
          isEnabled: true,
        },
      }

      // Add encrypted key for cross-device sync
      if (encryptedKeyData) {
        updateData.encryptedPrivateKey = {
          encryptedKey: encryptedKeyData.encryptedKey,
          salt: encryptedKeyData.salt,
          iv: encryptedKeyData.iv,
        }
      }

      await update(userRef, updateData)

      setHasPasscode(true)
      setPasscodeEnabled(true)
      setPasscodeSuccess("Passcode set successfully")
      setCurrentPasscode("")
      setNewPasscode("")
      setConfirmPasscode("")

      // Clear success message after 3 seconds
      setTimeout(() => {
        setPasscodeSuccess("")
      }, 3000)
    } catch (error) {
      console.error("Error setting passcode:", error)
      setPasscodeError("Failed to set passcode")
    } finally {
      setIsSaving(false)
    }
  }

  const goToAdminPanel = () => {
    onClose()
    router.push("/admin")
  }

  const goToPaymentVerify = () => {
    onClose()
    router.push("/payment-verify")
  }

  const promptForPermission = async () => {
    setNotificationSuccess(false)

    try {
      // Prioritize OneSignal if available (Custom UI -> System UI)
      if (window.OneSignal) {
        try {
          // Check if already registered
          const subscriptionId = await window.OneSignal.User.PushSubscription.id
          const isOptedIn = await window.OneSignal.User.PushSubscription.optedIn

          console.log("OneSignal Status - ID:", subscriptionId, "OptedIn:", isOptedIn)

          if (!subscriptionId || !isOptedIn) {
            console.log("User not fully registered. Triggering prompt.")
            await window.OneSignal.showSlidedownPrompt()
          } else {
            console.log("User already registered. Skipping prompt.")
            // Might help to ensure login sync
            if (user && user.id) {
              window.OneSignal.login(user.id)
            }
          }

          // Also identify user immediately if logging in
          if (user && user.id) {
            await window.OneSignal.login(user.id)
          }
        } catch (e) {
          console.error("OneSignal prompt error:", e)
        }
      }

      // Then request native permission (triggers system modal if OneSignal didn't, or confirms status)
      const permission = await Notification.requestPermission()

      if (permission === "granted") {
        setNotificationSuccess(true)
        localStorage.setItem("notifications_allowed", "true")
        localStorage.setItem("clicked_allow_notification_button", "true")

        // Also save to database for this user
        if (user && user.id) {
          const userRef = dbRef(db, `users/${user.id}`)
          update(userRef, {
            notificationsAllowed: true,
            clickedAllowNotificationButton: true,
            notificationsAllowedAt: new Date().toISOString(),
          }).catch((err) => console.error("Error saving notification status:", err))
        }

        // Final verification with OneSignal
        if (window.OneSignal) {
          // Ensure opt-in if permission granted
          const isOptedOut = await window.OneSignal.User.PushSubscription.optedOut
          if (isOptedOut) {
            await window.OneSignal.User.PushSubscription.optIn()
          }
        }

        toast({
          title: "Notifications Enabled",
          description: "You will now receive notifications.",
        })
      } else if (permission === "denied") {
        toast({
          title: "Notifications Blocked",
          description: "Please enable notifications in your browser settings.",
          variant: "destructive",
        })
      } else {
        // Dismissed or default
        toast({
          title: "Permission Dismissed",
          description: "Click again to enable notifications.",
        })
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error)
      toast({
        title: "Error",
        description: "Could not enable notifications. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Force admin tab for zzzz user
  const showAdminTab = isAdmin || (user && user.id === "zzzz")
  console.log("Show admin tab?", showAdminTab)

  // Format expiry date
  const formatExpiryDate = () => {
    if (!expiryDate) return null

    return expiryDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Check if subscription is lifetime
  const isLifetime = subscriptionPlan.toLowerCase() === "lifetime" || daysLeft > 36000

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] bg-gray-900 text-white border-gray-800">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-xl font-bold">Settings</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
          <TabsList className={`grid ${showAdminTab ? 'grid-cols-4' : 'grid-cols-3'} mb-4`}>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            {showAdminTab && <TabsTrigger value="admin">Admin</TabsTrigger>}
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="space-y-6">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-700">
                  {avatarPreview ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={avatarPreview || "/placeholder.svg"}
                        alt="Avatar"
                        fill
                        className="object-cover"
                        onError={(e) => {
                          console.error("Error loading avatar image:", e)
                          // Fallback to initial letter if image fails to load
                          setAvatarPreview("")
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <span className="text-3xl">{username.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded-md text-sm"
                >
                  Change Avatar
                </Button>
                <Input
                  ref={fileInputRef}
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-gray-800 border-gray-700"
                />
              </div>

              {/* Subscription Status - Only show when profile tab is active */}
              {currentTab === "profile" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Subscription Status</h3>
                    {isLoadingSubscription ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[#f4427e]"></div>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-900/50 text-green-400 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                        {subscriptionActive ? "Active" : "Inactive"}
                      </span>
                    )}
                  </div>

                  {!isLoadingSubscription && (
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <div className="w-6 h-6 flex items-center justify-center mr-2 text-gray-400">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs text-gray-400">Current Plan</div>
                          <div className="font-medium">{subscriptionPlan}</div>
                        </div>
                      </div>

                      {subscriptionPlan !== "Free" && !isLifetime && (
                        <div className="flex items-center">
                          <div className="w-6 h-6 flex items-center justify-center mr-2 text-gray-400">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Time Remaining</div>
                            <div className="font-medium">{daysLeft} days left</div>
                          </div>
                        </div>
                      )}

                      {isLifetime && (
                        <div className="flex items-center">
                          <div className="w-6 h-6 flex items-center justify-center mr-2 text-gray-400">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-400">Time Remaining</div>
                            <div className="font-medium">Lifetime</div>
                          </div>
                        </div>
                      )}

                      {!isLifetime && (
                        <Button onClick={goToPaymentVerify} className="w-full bg-pink-500 hover:bg-pink-600">
                          {subscriptionPlan !== "Free" ? "Extend Subscription" : "Upgrade Subscription"}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {saveSuccess && (
                <div className="bg-green-900/30 border border-green-800 text-green-400 p-2 rounded text-sm text-center">
                  Profile updated successfully!
                </div>
              )}

              <Button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            {isLoadingPasscode ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-[#f4427e]"></div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Passcode Protection</h3>
                    <p className="text-sm text-gray-400">Require a 6-digit passcode when opening the app</p>
                  </div>
                  <Switch
                    checked={passcodeEnabled}
                    onCheckedChange={handlePasscodeToggle}
                    disabled={!hasPasscode || isSaving}
                  />
                </div>

                <div className="border-t border-gray-800 pt-4 mt-4">
                  <h3 className="text-lg font-medium mb-4">{hasPasscode ? "Change Passcode" : "Setup Passcode"}</h3>

                  {hasPasscode && (
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="current-passcode">Current Passcode</Label>
                      <Input
                        id="current-passcode"
                        type="password"
                        maxLength={4}
                        value={currentPasscode}
                        onChange={(e) => setCurrentPasscode(e.target.value.replace(/[^0-9]/g, ""))}
                        className="bg-gray-800 border-gray-700"
                        placeholder="Enter current 6-digit passcode"
                      />
                    </div>
                  )}

                  <div className="space-y-2 mb-4">
                    <Label htmlFor="new-passcode">{hasPasscode ? "New Passcode" : "Passcode"}</Label>
                    <Input
                      id="new-passcode"
                      type="password"
                      maxLength={4}
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value.replace(/[^0-9]/g, ""))}
                      className="bg-gray-800 border-gray-700"
                      placeholder="Enter 6-digit passcode"
                    />
                  </div>

                  <div className="space-y-2 mb-4">
                    <Label htmlFor="confirm-passcode">Confirm Passcode</Label>
                    <Input
                      id="confirm-passcode"
                      type="password"
                      maxLength={4}
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value.replace(/[^0-9]/g, ""))}
                      className="bg-gray-800 border-gray-700"
                      placeholder="Confirm 6-digit passcode"
                    />
                  </div>

                  {passcodeError && <div className="text-red-500 text-sm mb-4">{passcodeError}</div>}

                  {passcodeSuccess && <div className="text-green-500 text-sm mb-4">{passcodeSuccess}</div>}

                  <Button
                    onClick={handleSetupPasscode}
                    disabled={isSaving || !newPasscode || !confirmPasscode || (hasPasscode && !currentPasscode)}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    {isSaving ? "Saving..." : hasPasscode ? "Change Passcode" : "Setup Passcode"}
                  </Button>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6">
              <h3 className="text-lg font-medium mb-4">Notification Permissions</h3>
              <Button
                onClick={promptForPermission}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                <BellRing className="mr-2 h-4 w-4" />
                Always Allow Notification
              </Button>

              {notificationSuccess && (
                <div className="mt-4 bg-green-900/30 border border-green-800 text-green-400 p-2 rounded text-sm text-center">
                  Success! Notifications are now enabled.
                </div>
              )}
            </div>
          </TabsContent>

          {showAdminTab && (
            <TabsContent value="admin" className="space-y-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Admin Controls</h3>
                <p className="text-sm text-gray-400">Access admin features and settings</p>

                <div className="grid grid-cols-1 gap-4">
                  <Button
                    onClick={goToAdminPanel}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                  >
                    Admin Panel
                  </Button>

                  <Button
                    onClick={goToPaymentVerify}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  >
                    Payment Verification
                  </Button>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
