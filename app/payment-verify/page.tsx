"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { db } from "@/lib/firebase"
import { ref, onValue, update, get, serverTimestamp } from "firebase/database"
import { useFirebase } from "@/components/firebase-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, XCircle, Clock, User, Shield, AlertTriangle } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import FirebaseProvider from "@/components/firebase-provider"
import Image from "next/image"

interface Payment {
  id: string
  userId: string
  username: string
  plan: string
  planName: string
  amount: number
  method: string
  code: string | null
  paperWalletUrl?: string | null
  status: "pending" | "verified" | "rejected"
  createdAt: Date
}

// Admin user ID - this should be your admin user ID
const ADMIN_USER_ID = "zzzz"

// Wrap the main component with FirebaseProvider
export default function PaymentVerifyPageWrapper() {
  return (
    <FirebaseProvider>
      <PaymentVerifyPage />
    </FirebaseProvider>
  )
}

function PaymentVerifyPage() {
  const { user, loading } = useFirebase()
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingPayment, setProcessingPayment] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userIdToVerify, setUserIdToVerify] = useState<string | null>(null)

  // Update the PaymentVerifyPage to accept a userId from the URL
  useEffect(() => {
    // Check if there's a userId in the URL
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const userId = urlParams.get("userId")
      if (userId) {
        setUserIdToVerify(userId)
        // You could automatically load this user's data
      }
    }
  }, [])

  // Check if current user is admin
  useEffect(() => {
    if (!loading && user) {
      // Check if the current user ID matches the admin ID
      const userIsAdmin = user.uid === ADMIN_USER_ID
      setIsAdmin(userIsAdmin)

      if (!userIsAdmin) {
        setError("Access denied. Only administrators can access this page.")
      }
    }
  }, [user, loading])

  // Update debug info with auth state
  useEffect(() => {
    setDebugInfo(`Auth state: ${loading ? "Loading" : user ? "Authenticated" : "Not authenticated"}
User: ${user ? `${user.uid} (${user.email || "No email"})` : "None"}
Admin: ${isAdmin ? "Yes" : "No"}`)
  }, [user, loading, isAdmin])

  // Only fetch payments when authentication is confirmed and user is admin
  useEffect(() => {
    if (loading) {
      setDebugInfo((prev) => `${prev}\nWaiting for authentication to complete...`)
      return
    }

    if (!user) {
      setDebugInfo((prev) => `${prev}\nNo user authenticated. Please log in.`)
      setIsLoading(false)
      setError("You must be logged in to access this page.")
      return
    }

    if (!isAdmin) {
      setIsLoading(false)
      return // Don't fetch payments if not admin
    }

    setDebugInfo((prev) => `${prev}\nUser authenticated: ${user.uid}. Fetching payments...`)
    console.log("User authenticated:", user.uid, "Fetching payments...")

    // Fetch all pending payments
    const paymentsRef = ref(db, "payments")
    const unsubscribe = onValue(
      paymentsRef,
      async (snapshot) => {
        console.log("Payments snapshot received, exists:", snapshot.exists())
        setDebugInfo((prev) => `${prev}\nPayments data received: ${snapshot.exists() ? "Yes" : "No"}`)

        if (snapshot.exists()) {
          const paymentsData: Payment[] = []

          // Get all users to map user IDs to usernames
          console.log("Fetching users data...")
          const usersRef = ref(db, "users")
          const usersSnapshot = await get(usersRef)
          console.log("Users snapshot received, exists:", usersSnapshot.exists())
          setDebugInfo((prev) => `${prev}\nUsers data received: ${usersSnapshot.exists() ? "Yes" : "No"}`)

          const users: Record<string, any> = {}

          if (usersSnapshot.exists()) {
            usersSnapshot.forEach((childSnapshot) => {
              const userData = childSnapshot.val()
              users[childSnapshot.key as string] = userData
            })
            console.log("Processed users data, count:", Object.keys(users).length)
            setDebugInfo((prev) => `${prev}\nUsers count: ${Object.keys(users).length}`)
          }

          snapshot.forEach((childSnapshot) => {
            const paymentData = childSnapshot.val()
            const userId = paymentData.userId

            paymentsData.push({
              id: childSnapshot.key as string,
              userId,
              username: users[userId]?.username || "Unknown User",
              plan: paymentData.plan,
              planName: paymentData.planName,
              amount: paymentData.amount,
              method: paymentData.method,
              code: paymentData.code,
              paperWalletUrl: paymentData.paperWalletUrl,
              status: paymentData.status,
              createdAt: paymentData.createdAt ? new Date(paymentData.createdAt) : new Date(),
            })
          })

          console.log("Processed payments data, count:", paymentsData.length)
          setDebugInfo((prev) => `${prev}\nPayments count: ${paymentsData.length}`)

          // Sort by creation date (newest first)
          paymentsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

          setPayments(paymentsData)
          setIsLoading(false)
        } else {
          console.log("No payments found in database")
          setDebugInfo((prev) => `${prev}\nNo payments found in database`)
          setPayments([])
          setIsLoading(false)
        }
      },
      (error) => {
        console.error("Error fetching payments:", error)
        setError(`Failed to load payments: ${error.message}`)
        setDebugInfo((prev) => `${prev}\nError: ${error.message}`)
        setIsLoading(false)
      },
    )

    return () => unsubscribe()
  }, [user, loading, router, isAdmin])

  // Add a timeout to prevent infinite loading
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        if (isLoading) {
          console.log("Loading timeout reached, forcing state update")
          setIsLoading(false)
          setError("Loading timed out. Please check your database connection and refresh the page.")
        }
      }, 10000) // 10 seconds timeout

      return () => clearTimeout(timeout)
    }
  }, [isLoading])

  const handleVerifyPayment = async (payment: Payment, isApproved: boolean) => {
    if (!isAdmin) return // Safety check

    setProcessingPayment(payment.id)

    try {
      // Update payment status
      const paymentRef = ref(db, `payments/${payment.id}`)
      await update(paymentRef, {
        status: isApproved ? "verified" : "rejected",
        verifiedAt: serverTimestamp(),
      })

      // Update user payment status
      const userPaymentRef = ref(db, `users/${payment.userId}/payment`)
      await update(userPaymentRef, {
        status: isApproved ? "verified" : "rejected",
        updatedAt: serverTimestamp(),
      })

      // If approved, set subscription details
      if (isApproved) {
        const planDuration = payment.plan === "monthly" ? 30 : 180
        const expiresAt = new Date(Date.now() + planDuration * 24 * 60 * 60 * 1000).toISOString()

        await update(userPaymentRef, {
          expiresAt,
          startedAt: serverTimestamp(),
        })
      }

      setProcessingPayment(null)
    } catch (error: any) {
      console.error("Error processing payment:", error)
      setError(`Failed to process payment: ${error.message}`)
      setProcessingPayment(null)
    }
  }

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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black overflow-auto">
        <div className="text-center max-w-md p-6 auth-card">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-4">You must be logged in to access this page.</p>
          <Button onClick={() => router.push("/")} className="btn-primary">
            Return to Login
          </Button>
          {debugInfo && (
            <div className="mt-4 p-2 bg-gray-800 rounded text-xs overflow-auto">
              <pre>{debugInfo}</pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black overflow-auto">
        <div className="text-center max-w-md p-6 auth-card">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Administrator Access Only</h1>
          <p className="text-gray-400 mb-4">
            This page is restricted to administrators only. If you believe this is an error, please contact support.
          </p>
          <Button onClick={() => router.push("/")} className="btn-primary">
            Return to App
          </Button>
          {debugInfo && (
            <div className="mt-4 p-2 bg-gray-800 rounded text-xs overflow-auto">
              <pre>{debugInfo}</pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (error && isAdmin) {
    return (
      <div className="min-h-screen bg-black p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/30 border border-red-800 text-white p-4 rounded-md mb-6">
            <h2 className="text-xl font-bold mb-2">Error</h2>
            <p>{error}</p>
            {debugInfo && (
              <div className="mt-4 p-2 bg-gray-800 rounded text-xs overflow-auto">
                <pre>{debugInfo}</pre>
              </div>
            )}
            <Button onClick={() => window.location.reload()} className="mt-4 btn-primary">
              Refresh Page
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading && isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black overflow-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f4427e] mx-auto mb-4"></div>
          <p className="text-gray-400">Loading payments data...</p>
          {debugInfo && (
            <div className="mt-4 p-2 bg-gray-800 rounded text-xs overflow-auto max-w-md">
              <pre>{debugInfo}</pre>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black p-6 overflow-auto">
      <div className="max-w-4xl mx-auto pb-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Payment Verification Panel</h1>
          <div className="flex gap-2">
            <Button onClick={() => router.push("/admin")} className="bg-purple-600 hover:bg-purple-700 text-white">
              Admin Panel
            </Button>
            <Button onClick={() => router.push("/")} variant="outline" className="border-gray-700">
              Return to App
            </Button>
          </div>
        </div>

        {debugInfo && (
          <div className="mb-4 p-2 bg-gray-800 rounded text-xs overflow-auto">
            <pre>{debugInfo}</pre>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Clock className="mr-2 h-5 w-5 text-yellow-500" />
              Pending Payments
            </h2>

            {payments.filter((p) => p.status === "pending").length === 0 ? (
              <div className="text-center py-12 bg-gray-900/50 rounded-lg border border-gray-800">
                <p className="text-gray-400">No pending payments</p>
              </div>
            ) : (
              payments
                .filter((p) => p.status === "pending")
                .map((payment) => (
                  <Card key={payment.id} className="mb-4 bg-gray-900/50 border-gray-800">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-white flex items-center">
                            <User className="h-5 w-5 mr-2 text-gray-400" />
                            {payment.username}
                          </CardTitle>
                          <CardDescription>User ID: {payment.userId}</CardDescription>
                        </div>
                        <div className="bg-yellow-500/20 text-yellow-400 py-1 px-3 rounded text-xs">Pending</div>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-2">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Plan:</p>
                          <p className="text-white font-medium">
                            {payment.planName} (€{payment.amount})
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Payment Method:</p>
                          <p className="text-white font-medium capitalize">{payment.method}</p>
                        </div>
                        {payment.method === "xbon" && (
                          <div className="col-span-2">
                            <p className="text-gray-400">X Bon Code:</p>
                            <p className="text-white font-mono bg-gray-800 p-1 rounded mt-1">{payment.code}</p>
                          </div>
                        )}
                        {payment.method === "crypto" && payment.paperWalletUrl && (
                          <div className="col-span-2">
                            <p className="text-gray-400 mb-2">Paper Wallet:</p>
                            <div className="relative w-full h-48 bg-gray-800 rounded-md overflow-hidden">
                              <Image
                                src={payment.paperWalletUrl || "/placeholder.svg"}
                                alt="Paper Wallet"
                                fill
                                className="object-contain"
                              />
                            </div>
                          </div>
                        )}
                        <div className="col-span-2">
                          <p className="text-gray-400">Requested:</p>
                          <p className="text-white">
                            {formatDistanceToNow(new Date(payment.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end space-x-2 pt-2">
                      <Button
                        variant="outline"
                        className="border-red-800 hover:bg-red-900/30 text-red-400"
                        onClick={() => handleVerifyPayment(payment, false)}
                        disabled={processingPayment === payment.id}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Deny
                      </Button>
                      <Button
                        className="bg-green-700 hover:bg-green-800 text-white"
                        onClick={() => handleVerifyPayment(payment, true)}
                        disabled={processingPayment === payment.id}
                      >
                        {processingPayment === payment.id ? (
                          <>
                            <span className="animate-spin mr-2">⟳</span> Processing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Approve
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                ))
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <CheckCircle className="mr-2 h-5 w-5 text-green-500" />
              Recent Transactions
            </h2>

            {payments.filter((p) => p.status !== "pending").length === 0 ? (
              <div className="text-center py-12 bg-gray-900/50 rounded-lg border border-gray-800">
                <p className="text-gray-400">No processed transactions</p>
              </div>
            ) : (
              payments
                .filter((p) => p.status !== "pending")
                .slice(0, 5) // Show only the 5 most recent
                .map((payment) => (
                  <Card key={payment.id} className="mb-4 bg-gray-900/50 border-gray-800">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-white flex items-center">
                            <User className="h-5 w-5 mr-2 text-gray-400" />
                            {payment.username}
                          </CardTitle>
                          <CardDescription>User ID: {payment.userId}</CardDescription>
                        </div>
                        <div
                          className={`py-1 px-3 rounded text-xs ${
                            payment.status === "verified"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {payment.status === "verified" ? "Approved" : "Rejected"}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-400">Plan:</p>
                          <p className="text-white font-medium">
                            {payment.planName} (€{payment.amount})
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-400">Payment Method:</p>
                          <p className="text-white font-medium capitalize">{payment.method}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-gray-400">Processed:</p>
                          <p className="text-white">
                            {formatDistanceToNow(new Date(payment.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
