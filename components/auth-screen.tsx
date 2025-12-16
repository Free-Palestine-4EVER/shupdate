"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { AlertCircle, RefreshCw, Shield } from "lucide-react"
import { auth, db } from "@/lib/firebase"
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signOut } from "firebase/auth"
import { ref, set, serverTimestamp, get, update } from "firebase/database"
import { useFirebase } from "@/components/firebase-provider"
import { generateKeyPair, storePrivateKey, getPrivateKey, hasEncryptionKeys } from "@/lib/encryption"
import DeviceBlockedScreen from "@/components/device-blocked-screen"

// Generate or get deviceId
function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return ''
  let deviceId = localStorage.getItem('deviceId')
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem('deviceId', deviceId)
  }
  return deviceId
}

export default function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isOnline, setIsOnline] = useState(true)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [isDeviceBlocked, setIsDeviceBlocked] = useState(false)
  const [blockedUserId, setBlockedUserId] = useState("")
  const [blockedUsername, setBlockedUsername] = useState("")
  const { user, loading } = useFirebase()

  useEffect(() => {
    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOnline) {
      setError("You are offline. Please check your internet connection.")
      return
    }
    setIsLoading(true)
    setError("")

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      const userRef = ref(db, `users/${user.uid}`)
      const snapshot = await get(userRef)
      const defaultUsername = user.displayName || email.split("@")[0]
      const defaultPhotoURL =
        user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(defaultUsername)}&background=random`

      if (!snapshot.exists()) {
        // New user - store deviceId
        const deviceId = getOrCreateDeviceId()
        await set(userRef, {
          id: user.uid,
          username: defaultUsername,
          email: user.email,
          photoURL: defaultPhotoURL,
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp(),
          online: true,
          deviceId, // Store first device
        })
      } else {
        const userData = snapshot.val()
        const currentDeviceId = getOrCreateDeviceId()

        // DEVICE CHECK: Enforce 1-account-1-device policy
        // Log logic but DO NOT logout here. The main page will handle the blocking UI.
        // This ensures the user remains authenticated to request access.
        if (userData.deviceId && userData.deviceId !== currentDeviceId) {
          console.log("Device mismatch detected during login. Access will be restricted by main layout.")
        }


        const updatedData: any = {
          lastSeen: serverTimestamp(),
          online: true,
          username: userData.username || defaultUsername,
          email: userData.email || user.email,
          photoURL: userData.photoURL || defaultPhotoURL,
          id: user.uid,
        }

        // If no deviceId stored yet (legacy user), store current device
        if (!userData.deviceId) {
          updatedData.deviceId = currentDeviceId
        }

        if (!userData.createdAt) {
          updatedData.createdAt = serverTimestamp()
        }

        // Check if user has encryption keys, generate ONLY if this is a brand new setup with no public key
        if (!userData.publicKey) {
          const { publicKey, privateKey } = await generateKeyPair()
          await storePrivateKey(user.uid, privateKey)
          updatedData.publicKey = publicKey
        } else {
          // EXISTING USER WITH PUBLIC KEY
          // DO NOT REGENERATE KEYS HERE.
          // If the user cleared their browser cache, they need to RESTORE their key using their passcode.
          // Generating a new key here would invalidate all old messages.
          console.log("User has existing public key. Checking for local private key...")
          const hasKeys = await hasEncryptionKeys(user.uid)

          if (!hasKeys) {
            console.log("Local private key missing. User must restore via passcode or manual reset.")
            // We do NOT update updatedData.publicKey here. 
            // The user will be prompted to enter passcode to decrypt their sync'd key in the main app.
          }
        }

        await update(userRef, updatedData)
      }
    } catch (error: any) {
      console.error("Login error:", error)
      if (error.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection and try again.")
      } else if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        setError("Invalid email or password.")
      } else {
        setError(error.message || "An error occurred during login.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isOnline) {
      setError("You are offline. Please check your internet connection.")
      return
    }
    if (!username.trim()) {
      setError("Username is required")
      return
    }
    setIsLoading(true)
    setError("")

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user
      const photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`
      await updateProfile(user, { displayName: username, photoURL })

      // Generate encryption keys for E2E encryption
      const { publicKey, privateKey } = await generateKeyPair()
      await storePrivateKey(user.uid, privateKey)

      // Get or create device ID for this device
      const deviceId = getOrCreateDeviceId()

      await set(ref(db, `users/${user.uid}`), {
        id: user.uid,
        username,
        email,
        photoURL,
        publicKey, // Store public key in Firebase for other users to encrypt messages
        lastSeen: serverTimestamp(),
        createdAt: serverTimestamp(),
        online: true,
        deviceId, // Store device ID for single-device policy
      })
    } catch (error: any) {
      console.error("Registration error:", error)
      if (error.code === "auth/network-request-failed") {
        setError("Network error. Please check your internet connection and try again.")
      } else if (error.code === "auth/email-already-in-use") {
        setError("This email is already registered.")
      } else if (error.code === "auth/weak-password") {
        setError("Password is too weak.")
      } else {
        setError(error.message || "An error occurred during registration.")
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut(auth)
    } catch (error: any) {
      setError(error.message)
    }
  }

  // Styles
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#000",
  }

  const quoteStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    textAlign: "center",
    padding: "0 1rem",
  }

  const quoteTextStyle: React.CSSProperties = {
    color: "#32CD32",
    fontSize: "0.875rem",
    marginTop: "0.5rem",
  }

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "28rem",
    backgroundColor: "rgba(30, 30, 30, 0.7)",
    backdropFilter: "blur(5px)",
    boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
    padding: "2rem",
    margin: "0 1rem",
    borderRadius: "1rem",
  }

  const titleStyle: React.CSSProperties = {
    textAlign: "center",
    marginBottom: "2rem",
  }

  const headingStyle: React.CSSProperties = {
    fontSize: "1.875rem",
    fontWeight: "bold",
    color: "#fff",
    marginBottom: "0.5rem",
  }

  const primaryTextStyle: React.CSSProperties = {
    color: "#ec4899",
  }

  const alertStyle: React.CSSProperties = {
    marginBottom: "1.5rem",
    padding: "1rem",
    backgroundColor: "rgba(127, 29, 29, 0.3)",
    border: "1px solid #7f1d1d",
    borderRadius: "0.5rem",
    color: "#fecaca",
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
  }

  const formStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: "3rem",
    padding: "0 1rem",
    backgroundColor: "rgba(39, 39, 42, 0.5)",
    border: "1px solid #3f3f46",
    borderRadius: "0.5rem",
    color: "#fff",
    fontSize: "1rem",
    outline: "none",
    boxSizing: "border-box",
  }

  const buttonStyle: React.CSSProperties = {
    width: "100%",
    height: "3rem",
    marginTop: "0.5rem",
    backgroundColor: "#ec4899",
    border: "none",
    borderRadius: "0.5rem",
    color: "#fff",
    fontSize: "1rem",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    opacity: isLoading || !isOnline ? 0.5 : 1,
  }

  const linkContainerStyle: React.CSSProperties = {
    textAlign: "center",
    marginTop: "1.5rem",
    color: "#9ca3af",
  }

  const linkStyle: React.CSSProperties = {
    color: "#ec4899",
    background: "none",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
  }

  const footerStyle: React.CSSProperties = {
    marginTop: "3rem",
    paddingTop: "1.5rem",
    borderTop: "1px solid #27272a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
    fontSize: "0.875rem",
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ color: "#fff" }}>Loading...</div>
      </div>
    )
  }

  // Show device blocked screen if trying to login from new device
  if (isDeviceBlocked) {
    return (
      <DeviceBlockedScreen
        userId={blockedUserId}
        username={blockedUsername}
        onAccessGranted={() => {
          setIsDeviceBlocked(false)
          setBlockedUserId("")
          setBlockedUsername("")
        }}
      />
    )
  }

  if (user) {
    return (
      <div style={containerStyle}>
        <p style={{ color: "#fff" }}>Signed in as {user.email}</p>
        <button onClick={handleSignOut} style={{ ...buttonStyle, maxWidth: "200px", marginTop: "1rem" }}>
          Sign Out
        </button>
      </div>
    )
  }

  return (
    <>
      <div style={quoteStyle}>
        <p style={quoteTextStyle}>I have joined the war on drugs, but on the drugs side</p>
      </div>

      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={titleStyle}>
            <h1 style={headingStyle}>
              Welcome to <span style={primaryTextStyle}>Shhhhh</span>
            </h1>
          </div>

          {!isOnline && (
            <div style={alertStyle}>
              <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
              <div>
                <strong>You are offline</strong>
                <p style={{ margin: 0, fontSize: "0.875rem" }}>Please check your internet connection.</p>
              </div>
            </div>
          )}

          {error && (
            <div style={alertStyle}>
              <AlertCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {isRegisterMode ? (
            <form onSubmit={handleRegister} style={formStyle}>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              <button type="submit" disabled={isLoading || !isOnline} style={buttonStyle}>
                {isLoading ? (
                  <>
                    <RefreshCw style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                    Creating account...
                  </>
                ) : (
                  "Register"
                )}
              </button>
              <div style={linkContainerStyle}>
                <p>
                  Already have an account?{" "}
                  <button type="button" onClick={() => setIsRegisterMode(false)} style={linkStyle}>
                    Login now
                  </button>
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleLogin} style={formStyle}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
              <button type="submit" disabled={isLoading || !isOnline} style={buttonStyle}>
                {isLoading ? (
                  <>
                    <RefreshCw style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </button>
              <div style={linkContainerStyle}>
                <p>
                  Don't have an account?{" "}
                  <button type="button" onClick={() => setIsRegisterMode(true)} style={linkStyle}>
                    Register now
                  </button>
                </p>
              </div>
            </form>
          )}

          <div style={footerStyle}>
            <Shield style={{ width: "16px", height: "16px", color: "#ec4899", marginRight: "0.5rem" }} />
            <span>Encrypted & Anonymous Secure Chat</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
