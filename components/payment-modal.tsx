"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CreditCard, Bitcoin, CheckCircle, Clock, AlertCircle, Camera } from "lucide-react"
import { db } from "@/lib/firebase"
import { ref, set, serverTimestamp, onValue } from "firebase/database"
import { useFirebase } from "@/components/firebase-provider"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { storage } from "@/lib/firebase"
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import Image from "next/image"

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
}

type Plan = {
  id: string
  name: string
  price: number
  duration: number
}

type PaymentMethod = "xbon" | "crypto"

const plans: Plan[] = [
  { id: "monthly", name: "1 Month", price: 50, duration: 30 },
  { id: "biannual", name: "6 Months", price: 250, duration: 180 },
]

// Crypto payment details - you would get these from your CoinPayments account
const CRYPTO_PAYMENT = {
  btc: {
    monthly: {
      amount: "0.0021",
      address: "bc1q7tvxll9nkt3ccy70fn9v6rcf8evennupxa5f79",
    },
    biannual: {
      amount: "0.0105",
      address: "bc1q7tvxll9nkt3ccy70fn9v6rcf8evennupxa5f79",
    },
  },
  eth: {
    monthly: {
      amount: "0.031",
      address: "0x0D32Fa1FE884103120B4883Df71ee5F06735Ac9e",
    },
    biannual: {
      amount: "0.155",
      address: "0x0D32Fa1FE884103120B4883Df71ee5F06735Ac9e",
    },
  },
}

export default function PaymentModal({ isOpen, onClose }: PaymentModalProps) {
  const { user } = useFirebase()
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [xbonCode, setXbonCode] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "verified" | "rejected" | null>(null)
  const [isVerificationComplete, setIsVerificationComplete] = useState(false)
  const [selectedCrypto, setSelectedCrypto] = useState<"btc" | "eth">("btc")

  // Add these state variables inside the PaymentModal component
  const [paperWalletFile, setPaperWalletFile] = useState<File | null>(null)
  const [paperWalletUrl, setPaperWalletUrl] = useState<string | null>(null)
  const [isUploadingWallet, setIsUploadingWallet] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add this function inside the PaymentModal component
  const handlePaperWalletUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setIsUploadingWallet(true)
    setUploadProgress(0)
    setPaperWalletFile(file)

    // Create a reference to the storage location
    const walletRef = storageRef(storage, `paper_wallets/${user.uid}/${Date.now()}_${file.name}`)

    // Upload the file
    const uploadTask = uploadBytesResumable(walletRef, file)

    // Listen for upload progress
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        setUploadProgress(progress)
      },
      (error) => {
        console.error("Error uploading paper wallet:", error)
        setError(`Failed to upload paper wallet: ${error.message}`)
        setIsUploadingWallet(false)
        setPaperWalletFile(null)
      },
      async () => {
        // Upload completed successfully, get the download URL
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
        setPaperWalletUrl(downloadURL)
        setIsUploadingWallet(false)
      },
    )
  }

  // Listen for payment status changes
  useEffect(() => {
    if (!user) return

    const paymentStatusRef = ref(db, `users/${user.uid}/payment`)
    const unsubscribe = onValue(paymentStatusRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setPaymentStatus(data.status)

        if (data.status === "verified") {
          setIsVerificationComplete(true)
          // Close modal after 3 seconds when verified
          setTimeout(() => {
            onClose()
          }, 3000)
        }
      }
    })

    return () => unsubscribe()
  }, [user, onClose])

  const handleSubmitPayment = async () => {
    if (!user || !selectedPlan || !paymentMethod) return

    if (paymentMethod === "xbon" && (!xbonCode || xbonCode.length !== 16)) {
      setError("Please enter a valid 16-digit X Bon code")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Create payment record in database
      const paymentRef = ref(db, `payments/${user.uid}`)
      await set(paymentRef, {
        userId: user.uid,
        plan: selectedPlan.id,
        planName: selectedPlan.name,
        amount: selectedPlan.price,
        duration: selectedPlan.duration,
        method: paymentMethod,
        code: paymentMethod === "xbon" ? xbonCode : null,
        cryptoType: paymentMethod === "crypto" ? selectedCrypto : null,
        paperWalletUrl: paymentMethod === "crypto" ? paperWalletUrl : null,
        status: "pending",
        createdAt: serverTimestamp(),
      })

      // Update user payment status
      const userPaymentRef = ref(db, `users/${user.uid}/payment`)
      await set(userPaymentRef, {
        status: "pending",
        plan: selectedPlan.id,
        planName: selectedPlan.name,
        duration: selectedPlan.duration,
        expiresAt: new Date(Date.now() + selectedPlan.duration * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: serverTimestamp(),
      })

      // Send email notification to admin
      try {
        await fetch("/api/notify-admin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: user.displayName || "User",
            email: user.email || "No email",
            userId: user.uid,
            timestamp: new Date().toISOString(),
            subject: "New Payment Submission",
            message: `
            User: ${user.displayName || "Unknown"} (${user.email || "No email"})
            Plan: ${selectedPlan.name}
            Amount: €${selectedPlan.price}
            Method: ${paymentMethod}
            ${
              paymentMethod === "xbon"
                ? `Code: ${xbonCode}`
                : `Crypto: ${selectedCrypto.toUpperCase()} - ${CRYPTO_PAYMENT[selectedCrypto][selectedPlan.id].amount}
                  ${paperWalletUrl ? `Paper Wallet: ${paperWalletUrl}` : ""}`
            }
          `,
          }),
        })
      } catch (notifyError) {
        console.error("Failed to send admin notification:", notifyError)
        // Continue with payment process even if notification fails
      }

      setPaymentStatus("pending")
    } catch (error: any) {
      console.error("Payment submission error:", error)
      setError(`Failed to submit payment: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderPaymentMethodSelection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white">Select Payment Method</h3>
      <div className="grid grid-cols-2 gap-4">
        <Button
          variant="outline"
          className={`h-auto py-6 flex flex-col items-center justify-center ${
            paymentMethod === "xbon" ? "border-primary bg-primary/10" : "border-gray-700 bg-gray-800/50"
          }`}
          onClick={() => setPaymentMethod("xbon")}
        >
          <CreditCard className="h-8 w-8 mb-2" />
          <span className="text-lg font-medium">X Bon</span>
          <span className="text-xs text-gray-400 mt-1">Pay with prepaid card</span>
        </Button>

        <Button
          variant="outline"
          className={`h-auto py-6 flex flex-col items-center justify-center ${
            paymentMethod === "crypto" ? "border-primary bg-primary/10" : "border-gray-700 bg-gray-800/50"
          }`}
          onClick={() => setPaymentMethod("crypto")}
        >
          <Bitcoin className="h-8 w-8 mb-2" />
          <span className="text-lg font-medium">Crypto</span>
          <span className="text-xs text-gray-400 mt-1">Pay with cryptocurrency</span>
        </Button>
      </div>
    </div>
  )

  const renderPlanSelection = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-white">Select Your Plan</h3>
      <div className="grid grid-cols-2 gap-4">
        {plans.map((plan) => (
          <Button
            key={plan.id}
            variant="outline"
            className={`h-auto py-6 flex flex-col items-center justify-center ${
              selectedPlan?.id === plan.id ? "border-primary bg-primary/10" : "border-gray-700 bg-gray-800/50"
            }`}
            onClick={() => setSelectedPlan(plan)}
          >
            <span className="text-xl font-bold">{plan.name}</span>
            <span className="text-2xl font-bold mt-2">€{plan.price}</span>
            <span className="text-xs text-gray-400 mt-1">{plan.duration} days of secure chat</span>
          </Button>
        ))}
      </div>
    </div>
  )

  const renderXBonPayment = () => (
    <div className="space-y-4 mt-6">
      <h3 className="text-lg font-medium text-white">Enter X Bon Code</h3>
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="Enter 16-digit code"
          value={xbonCode}
          onChange={(e) => setXbonCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 16))}
          className="custom-input text-center text-lg tracking-wider"
          maxLength={16}
        />
        <p className="text-xs text-gray-400 text-center">Enter the 16-digit code from your X Bon prepaid card</p>
      </div>
    </div>
  )

  const renderCryptoPayment = () => (
    <div className="space-y-4 mt-6 pb-4">
      <h3 className="text-lg font-medium text-white">Crypto Payment</h3>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-400 mb-2">Select Cryptocurrency</h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className={`py-2 ${selectedCrypto === "btc" ? "border-primary bg-primary/10" : "border-gray-700 bg-gray-800/50"}`}
            onClick={() => setSelectedCrypto("btc")}
          >
            Bitcoin (BTC)
          </Button>
          <Button
            variant="outline"
            className={`py-2 ${selectedCrypto === "eth" ? "border-primary bg-primary/10" : "border-gray-700 bg-gray-800/50"}`}
            onClick={() => setSelectedCrypto("eth")}
          >
            Ethereum (ETH)
          </Button>
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded-md">
        <p className="text-center text-sm mb-2">Send exactly this amount to the address below:</p>
        <p className="text-xl font-mono text-center font-bold text-primary mb-2">
          {selectedPlan && `${CRYPTO_PAYMENT[selectedCrypto][selectedPlan.id].amount} ${selectedCrypto.toUpperCase()}`}
        </p>
        <p className="text-xs font-mono text-center break-all bg-gray-900 p-2 rounded">
          {selectedPlan && CRYPTO_PAYMENT[selectedCrypto][selectedPlan.id].address}
        </p>

        <p className="text-xs text-gray-400 text-center mt-2">Payment will be manually verified within 24 hours</p>
      </div>

      {/* Paper Wallet Upload Section */}
      <div className="mt-4 border-t border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-white mb-2">Upload Paper Wallet (Optional)</h4>

        {paperWalletUrl ? (
          <div className="relative">
            <div className="relative w-full h-48 bg-gray-900 rounded-md overflow-hidden">
              <Image src={paperWalletUrl || "/placeholder.svg"} alt="Paper Wallet" fill className="object-contain" />
            </div>
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2 bg-red-900/80 hover:bg-red-800"
              onClick={() => {
                setPaperWalletUrl(null)
                setPaperWalletFile(null)
              }}
            >
              Remove
            </Button>
          </div>
        ) : isUploadingWallet ? (
          <div className="w-full">
            <div className="h-2 bg-gray-700 rounded-full">
              <div className="h-2 bg-primary rounded-full" style={{ width: `${uploadProgress}%` }}></div>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-center">Uploading... {Math.round(uploadProgress)}%</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Button
              variant="outline"
              className="w-full h-24 border-dashed border-gray-600 bg-gray-800/50 flex flex-col items-center justify-center"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-8 w-8 mb-2 text-gray-400" />
              <span className="text-sm text-gray-400">Upload photo of paper wallet</span>
            </Button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              This helps us verify your payment. Please ensure the transaction details are visible.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePaperWalletUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        )}
      </div>
    </div>
  )

  const renderPaymentStatus = () => {
    switch (paymentStatus) {
      case "pending":
        return (
          <div className="text-center py-6">
            <Clock className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Payment Verification Pending</h3>
            <p className="text-gray-400 mb-4">Your payment is being verified. This usually takes 1-24 hours.</p>
            <div className="animate-pulse bg-yellow-500/20 text-yellow-400 py-2 px-4 rounded-md inline-block">
              Waiting for account activation
            </div>
          </div>
        )
      case "verified":
        return (
          <div className="text-center py-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Payment Verified!</h3>
            <p className="text-gray-400 mb-4">Your account has been activated. Enjoy secure messaging!</p>
            <div className="bg-green-500/20 text-green-400 py-2 px-4 rounded-md inline-block">
              Account activated successfully
            </div>
          </div>
        )
      case "rejected":
        return (
          <div className="text-center py-6">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Payment Rejected</h3>
            <p className="text-gray-400 mb-4">
              Your payment could not be verified. Please try again with a different payment method.
            </p>
            <Button onClick={() => setPaymentStatus(null)} className="btn-primary">
              Try Again
            </Button>
          </div>
        )
      default:
        return null
    }
  }

  const renderPaymentForm = () => {
    if (paymentStatus) {
      return renderPaymentStatus()
    }

    return (
      <div className="space-y-6 pb-4">
        {renderPlanSelection()}
        {selectedPlan && renderPaymentMethodSelection()}
        {selectedPlan && paymentMethod === "xbon" && renderXBonPayment()}
        {selectedPlan && paymentMethod === "crypto" && renderCryptoPayment()}

        {error && (
          <Alert variant="destructive" className="bg-red-900/30 border-red-800">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end pt-4 mt-2 mb-2">
          <Button
            onClick={handleSubmitPayment}
            disabled={
              !selectedPlan || !paymentMethod || (paymentMethod === "xbon" && xbonCode.length !== 16) || isSubmitting
            }
            className="btn-primary"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin mr-2">⟳</span> Processing...
              </>
            ) : (
              `Pay €${selectedPlan?.price || 0}`
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Only allow closing if payment is verified or we're explicitly closing it
        if (paymentStatus === "verified" || !open) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md auth-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-center text-xl">Secure Chat Subscription</DialogTitle>
        </DialogHeader>

        <div className="py-4">{renderPaymentForm()}</div>
      </DialogContent>
    </Dialog>
  )
}
