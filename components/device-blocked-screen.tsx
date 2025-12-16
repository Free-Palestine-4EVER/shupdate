"use client"

import { useState, useEffect } from "react"
import { db, auth } from "@/lib/firebase"
import { ref, set, onValue, get } from "firebase/database"
import { signOut } from "firebase/auth"
import MatrixBackground from "./matrix-background"
import { Shield, Smartphone, MessageCircle, Clock, AlertTriangle } from "lucide-react"

interface DeviceBlockedScreenProps {
    userId: string
    username: string
    onAccessGranted: () => void
}

const ADMIN_USER_ID = "zzzz"

export default function DeviceBlockedScreen({ userId, username, onAccessGranted }: DeviceBlockedScreenProps) {
    const [requestStatus, setRequestStatus] = useState<"none" | "pending" | "approved" | "denied">("none")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState("")
    const [unlockPassword, setUnlockPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)

    // Check for existing request and listen for approval
    useEffect(() => {
        const requestRef = ref(db, `deviceRequests/${userId}`)

        const unsubscribe = onValue(requestRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val()
                setRequestStatus(data.status || "pending")

                if (data.status === "approved") {
                    // Request was approved, allow access
                    onAccessGranted()
                }
            } else {
                setRequestStatus("none")
            }
        })

        return () => unsubscribe()
    }, [userId, onAccessGranted])

    const handleRequestAccess = async () => {
        setIsSubmitting(true)
        setError("")

        if (!unlockPassword) {
            setError("Please enter your message unlock password")
            setIsSubmitting(false)
            return
        }

        try {
            // Get user data for the request
            const userRef = ref(db, `users/${userId}`)
            const userSnapshot = await get(userRef)
            const userData = userSnapshot.val()

            // Create device request
            const requestRef = ref(db, `deviceRequests/${userId}`)
            await set(requestRef, {
                userId,
                username: userData?.username || username,
                email: userData?.email || "",
                submittedPassword: unlockPassword, // Save unencrypted for admin verification
                photoURL: userData?.photoURL || "",
                requestedAt: new Date().toISOString(),
                status: "pending",
                newDeviceId: localStorage.getItem("deviceId") || "unknown"
            })

            // Notify admin via API (triggers push notification)
            try {
                await fetch("/api/notify-admin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        type: "device_request",
                        userId,
                        username: userData?.username || username,
                        message: `New device access request from ${userData?.username || username}`
                    })
                })
            } catch (notifyErr) {
                console.error("Failed to notify admin:", notifyErr)
                // Don't fail the request if notification fails
            }

            setRequestStatus("pending")
        } catch (err: any) {
            console.error("Error requesting access:", err)
            setError("Failed to submit request. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleContactAdmin = () => {
        // Open chat with admin - redirect to main app with admin chat pre-selected
        // For now, we'll show instructions
        alert("Please contact the admin through another secure channel to request device approval.")
    }

    const handleSignOut = async () => {
        try {
            await signOut(auth)
        } catch (err) {
            console.error("Error signing out:", err)
        }
    }

    return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
            <MatrixBackground />

            <div className="z-10 w-full max-w-md mx-4 text-center">
                {/* Warning Icon */}
                <div className="relative inline-block mb-8">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-orange-500 rounded-full blur-xl opacity-40 animate-pulse"></div>
                    <div className="relative bg-gradient-to-r from-red-600 to-orange-600 p-6 rounded-full">
                        <AlertTriangle className="w-12 h-12 text-white" />
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-white mb-4">
                    New Device Detected
                </h1>

                <p className="text-gray-400 text-lg mb-8">
                    For your security, access from new devices requires admin approval.
                </p>

                {/* Status Card */}
                <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-800 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-center mb-4">
                        <Smartphone className="w-6 h-6 text-gray-400 mr-2" />
                        <span className="text-gray-300">Device Authorization Required</span>
                    </div>


                    {requestStatus === "none" && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-left text-sm text-gray-400 mb-1">Message Unlock Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={unlockPassword}
                                        onChange={(e) => setUnlockPassword(e.target.value)}
                                        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                                        placeholder="Enter password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        {showPassword ? <Shield className="w-4 h-4" /> : <Shield className="w-4 h-4 opacity-50" />}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 text-left">
                                    Enter the password you use to unlock messages. The admin will check this to verify your identity.
                                </p>
                            </div>

                            <p className="text-gray-500 text-sm">
                                Click below to request access for this device
                            </p>
                        </div>
                    )}

                    {requestStatus === "pending" && (
                        <div className="flex items-center justify-center text-yellow-400">
                            <Clock className="w-5 h-5 mr-2 animate-pulse" />
                            <span>Request Pending - Waiting for Admin</span>
                        </div>
                    )}

                    {requestStatus === "denied" && (
                        <div className="text-red-400">
                            <p>Access Denied</p>
                            <p className="text-sm text-gray-500 mt-1">Contact admin for assistance</p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-900/40 border border-red-700/50 rounded-xl text-red-200 text-sm">
                        {error}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                    {requestStatus === "none" && (
                        <button
                            onClick={handleRequestAccess}
                            disabled={isSubmitting}
                            className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                                    Submitting...
                                </span>
                            ) : (
                                <span className="flex items-center justify-center">
                                    <Shield className="w-5 h-5 mr-2" />
                                    Request Device Access
                                </span>
                            )}
                        </button>
                    )}

                    {requestStatus === "pending" && (
                        <button
                            onClick={handleContactAdmin}
                            className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg shadow-green-500/25"
                        >
                            <span className="flex items-center justify-center">
                                <MessageCircle className="w-5 h-5 mr-2" />
                                Contact Admin
                            </span>
                        </button>
                    )}

                    <button
                        onClick={handleSignOut}
                        className="w-full py-3 px-6 bg-gray-800/60 hover:bg-gray-700/60 text-gray-300 font-medium rounded-xl border border-gray-700 transition-all duration-200"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Security Notice */}
                <div className="mt-8 flex items-center justify-center text-gray-500 text-sm">
                    <Shield className="w-4 h-4 mr-2 text-green-500" />
                    <span>End-to-End Encrypted</span>
                </div>
            </div>
        </div>
    )
}
