"use client"

import { useState } from "react"
import { generateSalt, hashPasscode, CURRENT_PASSCODE_VERSION } from "@/lib/passcode-utils"
import { db } from "@/lib/firebase"
import { ref, update } from "firebase/database"
import MatrixBackground from "./matrix-background"
import { Shield, Lock, CheckCircle, Eye, EyeOff, Sparkles } from "lucide-react"
import { getPrivateKey, encryptPrivateKeyWithPasscode, generateKeyPair, storePrivateKey } from "@/lib/encryption"

interface PasscodeSetupProps {
  userId: string
  onComplete: () => void
}

export default function PasscodeSetup({ userId, onComplete }: PasscodeSetupProps) {
  const [step, setStep] = useState<"create" | "confirm">("create")
  const [passcode, setPasscode] = useState<string[]>([])
  const [confirmPasscode, setConfirmPasscode] = useState<string[]>([])
  const [error, setError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [showDots, setShowDots] = useState(true)
  const [shakeAnimation, setShakeAnimation] = useState(false)

  const handleNumberPress = (number: number) => {
    if (isProcessing) return

    if (step === "create" && passcode.length < 6) {
      setPasscode([...passcode, number.toString()])
      setError("")
    } else if (step === "confirm" && confirmPasscode.length < 6) {
      setConfirmPasscode([...confirmPasscode, number.toString()])
      setError("")
    }
  }

  const handleDelete = () => {
    if (isProcessing) return

    if (step === "create" && passcode.length > 0) {
      setPasscode(passcode.slice(0, -1))
      setError("")
    } else if (step === "confirm" && confirmPasscode.length > 0) {
      setConfirmPasscode(confirmPasscode.slice(0, -1))
      setError("")
    }
  }

  const handleContinue = () => {
    if (passcode.length !== 6) {
      setError("Please enter a 6-digit security code")
      setShakeAnimation(true)
      setTimeout(() => setShakeAnimation(false), 500)
      return
    }

    setStep("confirm")
  }

  const handleConfirm = async () => {
    if (confirmPasscode.length !== 6) {
      setError("Please enter a 6-digit security code")
      setShakeAnimation(true)
      setTimeout(() => setShakeAnimation(false), 500)
      return
    }

    if (passcode.join("") !== confirmPasscode.join("")) {
      setError("Security codes do not match. Please try again.")
      setConfirmPasscode([])
      setShakeAnimation(true)
      setTimeout(() => setShakeAnimation(false), 500)
      return
    }

    setIsProcessing(true)

    try {
      const salt = generateSalt()
      const hash = hashPasscode(passcode.join(""), salt)

      // Get the user's private key from local storage
      const privateKey = await getPrivateKey(userId)

      let encryptedKeyData = null
      if (privateKey) {
        // Encrypt the private key with the passcode for cloud backup
        encryptedKeyData = await encryptPrivateKeyWithPasscode(privateKey, passcode.join(""))
        console.log("Private key encrypted for cloud sync")
      }

      // Update user data with passcode hash, salt, and encrypted key
      const userRef = ref(db, `users/${userId}`)
      const updateData: any = {
        passcode: {
          hash,
          salt,
          isEnabled: true,
          version: CURRENT_PASSCODE_VERSION,
        },
      }

      // If no private key was found locally, generate a new one and update the public key
      // This heals the account from "Fresh Start" or data loss
      if (!privateKey) {
        console.log("No local private key found. Generating new key pair...")
        const { publicKey, privateKey: newPrivateKey } = await generateKeyPair()

        // Store locally
        await storePrivateKey(userId, newPrivateKey)

        // Encrypt for backup
        encryptedKeyData = await encryptPrivateKeyWithPasscode(newPrivateKey, passcode.join(""))

        // Update public key in Firebase so others can message me
        updateData.publicKey = publicKey

        console.log("New key pair generated and synced.")
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

      // Store passcode status in localStorage
      localStorage.setItem(`passcode_enabled_${userId}`, "true")

      onComplete()
    } catch (error) {
      console.error("Error saving passcode:", error)
      setError("Failed to save security code. Please try again.")
      setIsProcessing(false)
    }
  }

  const toggleDotsVisibility = () => {
    setShowDots(!showDots)
  }

  const currentArray = step === "create" ? passcode : confirmPasscode

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 overflow-hidden">
      <MatrixBackground />

      {/* Floating security elements */}
      <div className="absolute top-10 left-10 opacity-20">
        <Shield className="w-8 h-8 text-blue-400 animate-pulse" />
      </div>
      <div className="absolute top-20 right-16 opacity-20">
        <Lock className="w-6 h-6 text-purple-400 animate-pulse" style={{ animationDelay: "1s" }} />
      </div>
      <div className="absolute bottom-20 left-20 opacity-20">
        <Sparkles className="w-10 h-10 text-cyan-400 animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      <div className={`z-10 w-full max-w-sm mx-4 ${shakeAnimation ? "animate-shake" : ""}`}>
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <div className="relative bg-gradient-to-r from-blue-500 to-purple-500 p-4 rounded-full">
              {step === "create" ? (
                <Lock className="w-8 h-8 text-white" />
              ) : (
                <CheckCircle className="w-8 h-8 text-white" />
              )}
            </div>
          </div>

          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent mb-3">
            {step === "create" ? "Create Security Code" : "Confirm Security Code"}
          </h1>
          <p className="text-gray-400 text-lg font-medium">
            {step === "create"
              ? "Set a 6-digit code to secure your account"
              : "Enter your security code again to confirm"}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-gradient-to-r from-red-900/40 to-red-800/40 border border-red-700/50 rounded-2xl backdrop-blur-sm text-red-200 text-center shadow-lg">
            <div className="flex items-center justify-center mb-2">
              <Shield className="w-5 h-5 text-red-400 mr-2" />
              <span className="font-semibold">Security Alert</span>
            </div>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Passcode Dots Display */}
        <div className="flex justify-center items-center space-x-4 mb-12">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="relative">
              <div
                className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ease-out transform ${currentArray.length > index
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 scale-110 shadow-lg shadow-blue-500/50"
                  : "border-2 border-gray-600 hover:border-gray-500"
                  }`}
              >
                {currentArray.length > index && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full animate-ping opacity-75"></div>
                )}
              </div>
              {!showDots && currentArray.length > index && (
                <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white font-mono text-lg">
                  {currentArray[index]}
                </span>
              )}
            </div>
          ))}

          {/* Toggle visibility button */}
          <button
            onClick={toggleDotsVisibility}
            className="ml-4 p-2 rounded-full bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 backdrop-blur-sm"
          >
            {showDots ? <Eye className="w-4 h-4 text-gray-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
          </button>
        </div>

        {/* Number Pad */}
        <div className="w-full max-w-xs mx-auto mb-8">
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
              <button
                key={number}
                onClick={() => handleNumberPress(number)}
                disabled={isProcessing}
                className="relative group w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80 backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 ease-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                <span className="relative text-2xl font-semibold text-white group-hover:text-blue-100 transition-colors duration-200">
                  {number}
                </span>
              </button>
            ))}

            {/* Empty space */}
            <div className="w-20 h-20"></div>

            {/* Zero button */}
            <button
              onClick={() => handleNumberPress(0)}
              disabled={isProcessing}
              className="relative group w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800/80 to-gray-900/80 hover:from-gray-700/80 hover:to-gray-800/80 backdrop-blur-sm border border-gray-700/50 hover:border-gray-600/50 transition-all duration-200 ease-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <span className="relative text-2xl font-semibold text-white group-hover:text-blue-100 transition-colors duration-200">
                0
              </span>
            </button>

            {/* Delete button */}
            <button
              onClick={handleDelete}
              disabled={
                (step === "create" && passcode.length === 0) ||
                (step === "confirm" && confirmPasscode.length === 0) ||
                isProcessing
              }
              className="relative group w-20 h-20 rounded-2xl bg-gradient-to-br from-red-800/60 to-red-900/60 hover:from-red-700/60 hover:to-red-800/60 backdrop-blur-sm border border-red-700/50 hover:border-red-600/50 transition-all duration-200 ease-out transform hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-600/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
              <span className="relative text-lg font-bold text-red-200 group-hover:text-red-100 transition-colors duration-200">
                ⌫
              </span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {step === "create" ? (
            <button
              onClick={handleContinue}
              disabled={passcode.length !== 6 || isProcessing}
              className="w-full py-4 px-6 text-center text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-2xl border border-blue-500/50 hover:border-blue-400/50 transition-all duration-200 ease-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-blue-500/25 font-semibold"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleConfirm}
              disabled={confirmPasscode.length !== 6 || isProcessing}
              className="w-full py-4 px-6 text-center text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-2xl border border-green-500/50 hover:border-green-400/50 transition-all duration-200 ease-out transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-green-500/25 font-semibold"
            >
              {isProcessing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                  Securing Account...
                </div>
              ) : (
                "Confirm & Secure"
              )}
            </button>
          )}
        </div>

        {/* Security Status */}
        <div className="text-center mt-8">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-700/50 rounded-full backdrop-blur-sm">
            <Shield className="w-4 h-4 text-green-400 mr-2" />
            <span className="text-green-200 text-sm font-medium">
              {isProcessing ? "Encrypting..." : "End-to-End Encrypted"}
            </span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  )
}
