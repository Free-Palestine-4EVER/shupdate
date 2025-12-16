"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { verifyPasscode, setSessionVerified } from "@/lib/passcode-utils"
import { db } from "@/lib/firebase"
import { ref, get } from "firebase/database"
import type { User } from "@/lib/types"
import MatrixBackground from "./matrix-background"
import { Shield, Lock, Eye, EyeOff, AlertTriangle, ScanFace } from "lucide-react"
import { verifyBiometric, isBiometricAvailable } from "@/lib/biometrics"
import {
  checkLockoutStatus,
  recordFailedAttempt,
  lockUserAccount,
  deleteUserAndAllData,
  resetPasscodeAttempts
} from "@/lib/delete-user-data"
import {
  decryptPrivateKeyWithPasscode,
  storePrivateKey,
  hasEncryptionKeys
} from "@/lib/encryption"

interface PasscodeScreenProps {
  userId: string
  onVerified: () => void
}

export default function PasscodeScreen({ userId, onVerified }: PasscodeScreenProps) {
  const [passcode, setPasscode] = useState<string[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [storedHash, setStoredHash] = useState("")
  const [storedSalt, setStoredSalt] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [showDots, setShowDots] = useState(true)
  const [shakeAnimation, setShakeAnimation] = useState(false)
  const [isLockedOut, setIsLockedOut] = useState(false)
  const [lockoutTimeRemaining, setLockoutTimeRemaining] = useState("")
  const [username, setUsername] = useState("")
  const [biometricFailed, setBiometricFailed] = useState(false)
  const [biometryAttempts, setBiometryAttempts] = useState(0)
  const maxAttempts = 5

  // Check lockout status and countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const checkStatus = async () => {
      const status = await checkLockoutStatus(userId)
      setIsLockedOut(status.isLockedOut)

      if (status.isLockedOut && status.lockoutUntil) {
        const updateTimer = () => {
          const remaining = status.lockoutUntil! - Date.now()
          if (remaining <= 0) {
            setIsLockedOut(false)
            setLockoutTimeRemaining("")
            if (interval) clearInterval(interval)
          } else {
            const minutes = Math.floor(remaining / 60000)
            const seconds = Math.floor((remaining % 60000) / 1000)
            setLockoutTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`)
          }
        }
        updateTimer()
        interval = setInterval(updateTimer, 1000)
      }
    }

    checkStatus()
    return () => { if (interval) clearInterval(interval) }
  }, [userId])

  useEffect(() => {
    const fetchPasscodeData = async () => {
      try {
        const userRef = ref(db, `users/${userId}`)
        const snapshot = await get(userRef)

        if (snapshot.exists()) {
          const userData = snapshot.val() as User
          setUsername(userData.username || "Unknown")

          // Check if user has a valid passcode set up
          if (userData.passcode?.hash && userData.passcode?.salt && userData.passcode?.isEnabled !== false) {
            setStoredHash(userData.passcode.hash)
            setStoredSalt(userData.passcode.salt)
          } else {
            // No passcode or disabled - let user through to setup
            setSessionVerified(true)
            onVerified()
          }
        } else {
          setSessionVerified(true)
          onVerified()
        }
        setLoading(false)
      } catch (error) {
        console.error("Error fetching passcode data:", error)
        setError("Failed to load passcode data")
        setLoading(false)
        setSessionVerified(true)
        onVerified()
      }
    }

    fetchPasscodeData()
    fetchPasscodeData()
  }, [userId, onVerified])

  // BIOMETRIC CHECK
  useEffect(() => {
    if (
      loading ||
      isLockedOut ||
      biometricFailed ||
      biometryAttempts >= 2 ||
      localStorage.getItem(`biometric_enabled_${userId}`) !== "true"
    ) {
      return
    }

    const tryBiometric = async () => {
      console.log("Attempting biometric unlock...")
      try {
        const success = await verifyBiometric()
        if (success) {
          // Biometric verified!
          // CRITICAL: We need the private key.
          // If it's in IndexedDB (local device), we are good.
          const hasKey = await hasEncryptionKeys(userId)
          if (hasKey) {
            await resetPasscodeAttempts(userId)
            setSessionVerified(true)
            onVerified()
          } else {
            // Face ID worked but we can't restore keys without the PIN
            // (because the backup key stored in Firebase is encrypted with PIN)
            setError("Face ID verified, but PIN is required to restore secure keys.")
            setBiometricFailed(true) // Stop trying biometrics, force PIN
          }
        } else {
          setBiometryAttempts(prev => prev + 1)
          // If that was the 2nd fail, it will stop due to check above next render
        }
      } catch (err) {
        console.error("Biometric error:", err)
        setBiometryAttempts(prev => prev + 1)
      }
    }

    // Small delay to let UI settle
    const timer = setTimeout(() => {
      tryBiometric()
    }, 1000)

    return () => clearTimeout(timer)
  }, [loading, isLockedOut, biometricFailed, biometryAttempts, userId])


  useEffect(() => {
    if (passcode.length === 6 && !isVerifying && !isLockedOut) {
      verifyUserPasscode()
    }
  }, [passcode, isLockedOut])

  const verifyUserPasscode = async () => {
    setIsVerifying(true)

    try {
      const passcodeString = passcode.join("")
      const isValid = verifyPasscode(passcodeString, storedHash, storedSalt)

      if (isValid) {
        // Reset attempts on success
        await resetPasscodeAttempts(userId)

        // KEY SYNC: Check if we need to restore the private key from cloud backup
        try {
          const hasLocalKey = await hasEncryptionKeys(userId)

          if (!hasLocalKey) {
            // No local key - check if there's an encrypted backup in Firebase
            const userRef = ref(db, `users/${userId}`)
            const snapshot = await get(userRef)

            if (snapshot.exists()) {
              const userData = snapshot.val()

              if (userData.encryptedPrivateKey) {
                // Decrypt and restore the private key
                console.log("Restoring private key from cloud backup...")
                const privateKey = await decryptPrivateKeyWithPasscode(
                  userData.encryptedPrivateKey,
                  passcodeString
                )
                await storePrivateKey(userId, privateKey)
                console.log("Private key restored successfully!")
              } else {
                // Old user without encrypted key backup - they'll get it when they change PIN
                console.log("No encrypted key backup found - user needs to change PIN to enable key sync")
              }
            }
          }
        } catch (keyError) {
          // Don't block login if key restoration fails
          console.error("Error restoring encryption key:", keyError)
        }

        setSessionVerified(true)
        onVerified()
      } else {
        // Record failed attempt and check for lockout/deletion
        const result = await recordFailedAttempt(userId, username)

        setShakeAnimation(true)
        setTimeout(() => setShakeAnimation(false), 500)

        if (result.shouldDelete) {
          // Delete account after 10 attempts
          setError("Maximum security attempts exceeded. Account will be deleted.")
          await deleteUserAndAllData(userId)
          // The user will be signed out by deleteUserAndAllData
          return
        }

        if (result.shouldLockout) {
          // Lock account for 1 hour after 5 attempts
          await lockUserAccount(userId, username)
          setIsLockedOut(true)
          setError("Account locked for 1 hour due to multiple failed attempts. Admin has been notified.")
        } else {
          const newAttempts = attempts + 1
          setAttempts(newAttempts)
          setError(`Access denied. ${result.remainingAttempts} attempts remaining before lockout.`)
        }

        setPasscode([])
      }
    } catch (error) {
      console.error("Error verifying passcode:", error)
      setError("Verification failed")
      setPasscode([])
    } finally {
      setIsVerifying(false)
    }
  }

  const handleNumberPress = (number: number) => {
    if (passcode.length < 6 && !isVerifying && !isLockedOut) {
      setPasscode([...passcode, number.toString()])
      setError("")
    }
  }

  const handleDelete = () => {
    if (passcode.length > 0 && !isVerifying && !isLockedOut) {
      setPasscode(passcode.slice(0, -1))
      setError("")
    }
  }

  // Styles
  const containerStyle: React.CSSProperties = {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "linear-gradient(to bottom right, #111827, #000, #111827)",
    overflow: "hidden",
  }

  const loadingContainerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    background: "linear-gradient(to bottom right, #111827, #000, #111827)",
  }

  const spinnerStyle: React.CSSProperties = {
    width: "64px",
    height: "64px",
    border: "2px solid transparent",
    borderTopColor: "#3b82f6",
    borderBottomColor: "#8b5cf6",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  }

  const contentStyle: React.CSSProperties = {
    zIndex: 10,
    width: "100%",
    maxWidth: "384px",
    margin: "0 1rem",
    animation: shakeAnimation ? "shake 0.5s ease-in-out" : "none",
  }

  const headerStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: "3rem",
  }

  const iconContainerStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-block",
    marginBottom: "1.5rem",
  }

  const iconGlowStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
    borderRadius: "50%",
    filter: "blur(20px)",
    opacity: 0.3,
  }

  const iconStyle: React.CSSProperties = {
    position: "relative",
    background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
    padding: "1rem",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }

  const titleStyle: React.CSSProperties = {
    fontSize: "1.875rem",
    fontWeight: "bold",
    background: "linear-gradient(to right, #fff, #dbeafe, #e9d5ff)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    marginBottom: "0.75rem",
  }

  const subtitleStyle: React.CSSProperties = {
    color: "#9ca3af",
    fontSize: "1.125rem",
    fontWeight: 500,
  }

  const errorStyle: React.CSSProperties = {
    marginBottom: "2rem",
    padding: "1rem",
    background: "linear-gradient(to right, rgba(127, 29, 29, 0.4), rgba(153, 27, 27, 0.4))",
    border: "1px solid rgba(185, 28, 28, 0.5)",
    borderRadius: "1rem",
    color: "#fecaca",
    textAlign: "center",
  }

  const dotsContainerStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "1.5rem",
    marginBottom: "3rem",
  }

  const dotStyle = (filled: boolean): React.CSSProperties => ({
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    transition: "all 0.3s ease",
    transform: filled ? "scale(1.1)" : "scale(1)",
    background: filled ? "linear-gradient(to right, #3b82f6, #8b5cf6)" : "transparent",
    border: filled ? "none" : "2px solid #4b5563",
    boxShadow: filled ? "0 0 20px rgba(59, 130, 246, 0.5)" : "none",
  })

  const numberPadStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "280px",
    margin: "0 auto 2rem",
  }

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "4px",
  }

  const numberButtonStyle: React.CSSProperties = {
    width: "80px",
    height: "80px",
    borderRadius: "1rem",
    background: "linear-gradient(to bottom right, rgba(31, 41, 55, 0.8), rgba(17, 24, 39, 0.8))",
    border: "1px solid rgba(55, 65, 81, 0.5)",
    color: "#fff",
    fontSize: "1.5rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  }

  const deleteButtonStyle: React.CSSProperties = {
    ...numberButtonStyle,
    background: "linear-gradient(to bottom right, rgba(153, 27, 27, 0.6), rgba(127, 29, 29, 0.6))",
    border: "1px solid rgba(185, 28, 28, 0.5)",
    color: "#fecaca",
    fontSize: "1.125rem",
  }

  const emptyStyle: React.CSSProperties = {
    width: "80px",
    height: "80px",
  }

  const statusStyle: React.CSSProperties = {
    textAlign: "center",
  }

  const statusBadgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.5rem 1rem",
    background: "linear-gradient(to right, rgba(20, 83, 45, 0.4), rgba(6, 78, 59, 0.4))",
    border: "1px solid rgba(21, 128, 61, 0.5)",
    borderRadius: "9999px",
    color: "#bbf7d0",
    fontSize: "0.875rem",
    fontWeight: 500,
  }

  if (loading) {
    return (
      <div style={loadingContainerStyle}>
        <div style={spinnerStyle}></div>
        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <MatrixBackground />

      <div style={contentStyle}>
        <div className="text-center mb-12">
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-xl opacity-30 animate-pulse"></div>
            <div className="relative bg-gradient-to-r from-blue-500 to-purple-500 p-4 rounded-full">
              {biometryAttempts < 2 && !biometricFailed && localStorage.getItem(`biometric_enabled_${userId}`) === "true" ? (
                <ScanFace className="w-8 h-8 text-white animate-pulse" />
              ) : (
                <Lock className="w-8 h-8 text-white" />
              )}
            </div>
          </div>

          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent mb-3">
            {biometryAttempts < 2 && !biometricFailed && localStorage.getItem(`biometric_enabled_${userId}`) === "true"
              ? "Face ID / Security Code"
              : "Enter Security Code"}
          </h1>
          <p className="text-gray-400 text-lg font-medium">
            {error || (biometryAttempts < 2 && !biometricFailed && localStorage.getItem(`biometric_enabled_${userId}`) === "true"
              ? "Scanning face or enter code..."
              : "Enter your 6-digit security code")}
          </p>
        </div>

        {error && (
          <div style={errorStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
              <Shield style={{ width: "20px", height: "20px", color: "#f87171", marginRight: "0.5rem" }} />
              <span style={{ fontWeight: 600 }}>Security Alert</span>
            </div>
            <p style={{ fontSize: "0.875rem" }}>{error}</p>
          </div>
        )}

        <div style={{ ...dotsContainerStyle, gap: '1rem' }}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} style={{ ...dotStyle(passcode.length > index), width: '14px', height: '14px' }}></div>
          ))}
          <button
            onClick={() => setShowDots(!showDots)}
            style={{
              marginLeft: "1rem",
              padding: "0.5rem",
              borderRadius: "50%",
              background: "rgba(31, 41, 55, 0.5)",
              border: "none",
              cursor: "pointer",
            }}
          >
            {showDots ? (
              <Eye style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
            ) : (
              <EyeOff style={{ width: "16px", height: "16px", color: "#9ca3af" }} />
            )}
          </button>
        </div>

        <div style={numberPadStyle}>
          <div style={gridStyle}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => (
              <button
                key={number}
                onClick={() => handleNumberPress(number)}
                disabled={isVerifying || attempts >= maxAttempts}
                style={numberButtonStyle}
              >
                {number}
              </button>
            ))}
            <div style={emptyStyle}></div>
            <button
              onClick={() => handleNumberPress(0)}
              disabled={isVerifying || attempts >= maxAttempts}
              style={numberButtonStyle}
            >
              0
            </button>
            <button
              onClick={handleDelete}
              disabled={passcode.length === 0 || isVerifying || attempts >= maxAttempts}
              style={deleteButtonStyle}
            >
              ⌫
            </button>
          </div>
        </div>

        <div style={statusStyle}>
          <div style={statusBadgeStyle}>
            <Shield style={{ width: "16px", height: "16px", color: "#4ade80", marginRight: "0.5rem" }} />
            <span>{isVerifying ? "Verifying..." : "Secure Session"}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
