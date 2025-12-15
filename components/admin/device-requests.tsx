"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { ref, onValue, update, remove, get } from "firebase/database"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Smartphone, Clock, RefreshCw, User } from "lucide-react"
import Image from "next/image"
import { formatDistanceToNow } from "date-fns"

interface DeviceRequest {
    id: string
    userId: string
    username: string
    email: string
    photoURL: string
    requestedAt: string
    status: "pending" | "approved" | "denied"
    newDeviceId: string
}

export default function DeviceRequests() {
    const [requests, setRequests] = useState<DeviceRequest[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [processingId, setProcessingId] = useState<string | null>(null)

    // Fetch all device requests
    useEffect(() => {
        const requestsRef = ref(db, "deviceRequests")

        const unsubscribe = onValue(requestsRef, (snapshot) => {
            setIsLoading(false)

            if (snapshot.exists()) {
                const requestsData: DeviceRequest[] = []

                snapshot.forEach((childSnapshot) => {
                    const data = childSnapshot.val()
                    if (data.status === "pending") {
                        requestsData.push({
                            id: childSnapshot.key || "",
                            ...data
                        })
                    }
                })

                // Sort by request time (newest first)
                requestsData.sort((a, b) =>
                    new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
                )

                setRequests(requestsData)
            } else {
                setRequests([])
            }
        }, (err) => {
            console.error("Error fetching device requests:", err)
            setError("Failed to load device requests")
            setIsLoading(false)
        })

        return () => unsubscribe()
    }, [])

    const handleApprove = async (request: DeviceRequest) => {
        setProcessingId(request.id)
        setError(null)

        try {
            // Update user's deviceId to the new device
            const userRef = ref(db, `users/${request.userId}`)
            await update(userRef, {
                deviceId: request.newDeviceId,
                deviceApprovedAt: new Date().toISOString(),
                deviceApprovedBy: "admin"
            })

            // Update request status
            const requestRef = ref(db, `deviceRequests/${request.id}`)
            await update(requestRef, {
                status: "approved",
                approvedAt: new Date().toISOString()
            })

            // Remove from pending after short delay (so user sees approval)
            setTimeout(async () => {
                await remove(requestRef)
            }, 5000)

            setSuccessMessage(`Access granted to ${request.username}`)
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (err: any) {
            console.error("Error approving request:", err)
            setError(`Failed to approve: ${err.message}`)
        } finally {
            setProcessingId(null)
        }
    }

    const handleDeny = async (request: DeviceRequest) => {
        setProcessingId(request.id)
        setError(null)

        try {
            // Update request status to denied
            const requestRef = ref(db, `deviceRequests/${request.id}`)
            await update(requestRef, {
                status: "denied",
                deniedAt: new Date().toISOString()
            })

            // Remove after short delay
            setTimeout(async () => {
                await remove(requestRef)
            }, 5000)

            setSuccessMessage(`Access denied for ${request.username}`)
            setTimeout(() => setSuccessMessage(null), 3000)
        } catch (err: any) {
            console.error("Error denying request:", err)
            setError(`Failed to deny: ${err.message}`)
        } finally {
            setProcessingId(null)
        }
    }

    return (
        <div className="h-full flex flex-col">
            <div className="mb-4">
                <h2 className="text-xl font-bold text-white flex items-center">
                    <Smartphone className="w-5 h-5 mr-2 text-blue-400" />
                    Device Access Requests
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                    Approve or deny new device login requests
                </p>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-4 bg-red-900/30 border-red-800">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {successMessage && (
                <Alert className="mb-4 bg-green-900/30 border-green-800">
                    <AlertDescription className="text-green-400">{successMessage}</AlertDescription>
                </Alert>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center p-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-900/30 rounded-lg border border-gray-800">
                    <Smartphone className="w-12 h-12 text-gray-600 mb-4" />
                    <p className="text-gray-400 text-lg">No pending requests</p>
                    <p className="text-gray-500 text-sm mt-1">New device requests will appear here</p>
                </div>
            ) : (
                <div className="flex-1 overflow-auto space-y-4">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center space-x-4">
                                    {request.photoURL ? (
                                        <Image
                                            src={request.photoURL}
                                            alt={request.username}
                                            width={50}
                                            height={50}
                                            className="rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
                                            <User className="w-6 h-6 text-gray-500" />
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="font-semibold text-white">{request.username}</h3>
                                        <p className="text-gray-400 text-sm">{request.email}</p>
                                        <div className="flex items-center text-gray-500 text-xs mt-1">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                                        </div>
                                    </div>
                                </div>

                                <Badge variant="outline" className="border-yellow-600 text-yellow-400">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pending
                                </Badge>
                            </div>

                            <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                                <p className="text-gray-400 text-xs mb-1">New Device ID</p>
                                <code className="text-xs text-gray-300 font-mono break-all">
                                    {request.newDeviceId}
                                </code>
                            </div>

                            <div className="mt-4 flex space-x-3">
                                <Button
                                    onClick={() => handleApprove(request)}
                                    disabled={processingId === request.id}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {processingId === request.id ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Approve
                                        </>
                                    )}
                                </Button>
                                <Button
                                    onClick={() => handleDeny(request)}
                                    disabled={processingId === request.id}
                                    variant="destructive"
                                    className="flex-1"
                                >
                                    {processingId === request.id ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Deny
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
