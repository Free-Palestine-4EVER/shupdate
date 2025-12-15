"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import AuthScreen from "@/components/auth-screen"
import { useFirebase } from "@/components/firebase-provider"
import FirebaseProvider from "@/components/firebase-provider"
import SecretCalculator from "@/components/secret-calculator"
import { db } from "@/lib/firebase"
import { ref, onValue, get } from "firebase/database"
import { updateLastAccessTime, setSessionVerified } from "@/lib/passcode-utils"
import AddToHomescreen from "@/components/add-to-homescreen"

// Dynamically import components that use browser APIs
const MatrixBackground = dynamic(() => import("@/components/matrix-background"), {
  ssr: false,
})

const StandaloneCheck = dynamic(() => import("@/components/standalone-check"), {
  ssr: false,
})

const ChatLayout = dynamic(() => import("@/components/chat-layout"), {
  ssr: false,
  loading: () => <div className="bg-black min-h-screen"></div>,
})

const ServerSelectionModal = dynamic(() => import("@/components/server-selection-modal"), {
  ssr: false,
})

const PaymentModal = dynamic(() => import("@/components/payment-modal"), {
  ssr: false,
})

const NotificationGuidanceModal = dynamic(() => import("@/components/notification-guidance-modal"), {
  ssr: false,
})

const SettingsModal = dynamic(() => import("@/components/settings-modal"), {
  ssr: false,
})

const PasscodeScreen = dynamic(() => import("@/components/passcode-screen"), {
  ssr: false,
  loading: () => <div className="bg-black min-h-screen"></div>,
})

const PasscodeSetup = dynamic(() => import("@/components/passcode-setup"), {
  ssr: false,
  loading: () => <div className="bg-black min-h-screen"></div>,
})

const IOSPWADebug = dynamic(() => import("@/components/ios-pwa-debug"), {
  ssr: false,
})

const OneSignalInitializer = dynamic(() => import("@/components/onesignal-initializer"), {
  ssr: false,
})

const OneSignalModalManager = dynamic(() => import("@/components/onesignal-modal-manager"), {
  ssr: false,
})

// Add this import at the top with the other dynamic imports
const PWADebug = dynamic(() => import("@/components/pwa-debug"), {
  ssr: false,
})

export default function HomePage() {
  return (
    <FirebaseProvider>
      <div className="bg-transparent min-h-screen">
        <AppContent />
      </div>
    </FirebaseProvider>
  )
}

function AppContent() {
  const { user, loading } = useFirebase()
  const [showServerSelection, setShowServerSelection] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showNotificationGuidance, setShowNotificationGuidance] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsActiveTab, setSettingsActiveTab] = useState("profile")
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null)
  const [paymentChecked, setPaymentChecked] = useState(false)
  const [showPasscode, setShowPasscode] = useState(false)
  const [showPasscodeSetup, setShowPasscodeSetup] = useState(false)
  const [passcodeVerified, setPasscodeVerified] = useState(false)
  const [hasPasscode, setHasPasscode] = useState(false)
  const [notificationsAllowed, setNotificationsAllowed] = useState(false)
  const [clickedAllowButton, setClickedAllowButton] = useState(false)
  const [subscriptionExpired, setSubscriptionExpired] = useState(false)
  const notificationTimerRef = useRef<NodeJS.Timeout | null>(null)
  const userJustLoggedInRef = useRef(false)
  const subscriptionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [showCalculator, setShowCalculator] = useState(true)
  const [secretCodeEntered, setSecretCodeEntered] = useState(false)
  const [chatLoaded, setChatLoaded] = useState(false)
  const [showOneSignalPrompt, setShowOneSignalPrompt] = useState(false)

  // Reset session verification on page load/refresh
  useEffect(() => {
    // Clear session verification status on page load/refresh
    setSessionVerified(false)

    // Check if notifications are already allowed
    const notificationsAllowedInStorage = localStorage.getItem("notifications_allowed") === "true"
    setNotificationsAllowed(notificationsAllowedInStorage)

    // Check if user has clicked the Allow Notification button
    const clickedAllowButtonInStorage = localStorage.getItem("clicked_allow_notification_button") === "true"
    setClickedAllowButton(clickedAllowButtonInStorage)

    // Also check browser permission
    if (typeof Notification !== "undefined") {
      if (Notification.permission === "granted") {
        setNotificationsAllowed(true)
        localStorage.setItem("notifications_allowed", "true")
      }
    }

    // Clear any existing timer
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current)
    }

    // Clear subscription check interval
    if (subscriptionCheckIntervalRef.current) {
      clearInterval(subscriptionCheckIntervalRef.current)
    }
  }, [])

  // Set user just logged in flag when user changes
  useEffect(() => {
    if (user) {
      userJustLoggedInRef.current = true

      // Show OneSignal prompt after login if notifications not already allowed
      if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
        // Set a timer to show the OneSignal prompt
        notificationTimerRef.current = setTimeout(() => {
          setShowOneSignalPrompt(true)
          if (window.OneSignal) {
            console.log("Showing OneSignal prompt after login")
            window.OneSignal.showSlidedownPrompt()
          }
        }, 3000) // Show after 3 seconds
      }

      // Check if user has clicked the Allow Notification button from database
      const userRef = ref(db, `users/${user.uid}`)
      get(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.val()
            if (userData.clickedAllowNotificationButton) {
              setClickedAllowButton(true)
              localStorage.setItem("clicked_allow_notification_button", "true")
            }

            // Check subscription status
            if (userData.subscription) {
              // Check if subscription has expired
              if (userData.subscription.expiryDate) {
                const expiryDate = new Date(userData.subscription.expiryDate)
                const now = new Date()

                if (expiryDate <= now) {
                  console.log("Subscription has expired, showing payment modal")
                  setSubscriptionExpired(true)
                  // Show payment modal if subscription has expired
                  setShowPaymentModal(true)
                } else {
                  // Set up a check to show payment modal when subscription expires
                  const timeUntilExpiry = expiryDate.getTime() - now.getTime()

                  // If expiry is within the next 24 hours, set a timeout to show payment modal
                  if (timeUntilExpiry <= 24 * 60 * 60 * 1000) {
                    setTimeout(() => {
                      setSubscriptionExpired(true)
                      setShowPaymentModal(true)
                    }, timeUntilExpiry)
                  }
                }
              }
            }
          }
        })
        .catch((err) => console.error("Error checking notification status:", err))

      // Set up periodic check for subscription expiry
      subscriptionCheckIntervalRef.current = setInterval(
        () => {
          checkSubscriptionStatus(user.uid)
        },
        60 * 60 * 1000,
      ) // Check every hour
    }

    return () => {
      // Clear subscription check interval on unmount
      if (subscriptionCheckIntervalRef.current) {
        clearInterval(subscriptionCheckIntervalRef.current)
      }

      // Clear notification timer
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current)
      }
    }
  }, [user])

  // Function to check subscription status
  const checkSubscriptionStatus = (userId: string) => {
    const userRef = ref(db, `users/${userId}`)
    get(userRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.val()

          if (userData.subscription && userData.subscription.expiryDate) {
            const expiryDate = new Date(userData.subscription.expiryDate)
            const now = new Date()

            if (expiryDate <= now && !subscriptionExpired) {
              console.log("Subscription has expired during session, showing payment modal")
              setSubscriptionExpired(true)
              setShowPaymentModal(true)
            }
          }
        }
      })
      .catch((err) => console.error("Error checking subscription status:", err))
  }

  // Show notification guidance after login - DISABLED
  useEffect(() => {
    if (user && userJustLoggedInRef.current && !clickedAllowButton) {
      console.log("User logged in, but notification guidance modal is disabled")

      // Reset the flag
      userJustLoggedInRef.current = false
    }

    return () => {
      // Clean up timer on unmount
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current)
      }
    }
  }, [user, clickedAllowButton])

  // Check if user has a passcode set up - ONLY after secret code is entered
  useEffect(() => {
    if (user && !loading && secretCodeEntered) {
      const userRef = ref(db, `users/${user.uid}`)
      get(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.val()
            const userHasPasscode = !!(userData.passcode?.hash && userData.passcode?.salt)
            const passcodeEnabled = userData.passcode?.isEnabled !== false

            setHasPasscode(userHasPasscode && passcodeEnabled)

            // If user has passcode, show passcode screen
            if (userHasPasscode && passcodeEnabled) {
              setShowPasscode(true)
              setShowPasscodeSetup(false)
            } else {
              // If no passcode, show passcode setup
              setShowPasscode(false)
              setShowPasscodeSetup(true)
              // Mark as verified since they'll either set up or skip
              setPasscodeVerified(true)
              updateLastAccessTime()
            }

            // Check if notifications are allowed in the database
            if (userData.notificationsAllowed) {
              setNotificationsAllowed(true)
              localStorage.setItem("notifications_allowed", "true")
            }

            // Check if user has clicked the Allow Notification button
            if (userData.clickedAllowNotificationButton) {
              setClickedAllowButton(true)
              localStorage.setItem("clicked_allow_notification_button", "true")
            }
          } else {
            // No user data, show passcode setup
            setShowPasscode(false)
            setShowPasscodeSetup(true)
            setPasscodeVerified(true)
            updateLastAccessTime()
          }
        })
        .catch((error) => {
          console.error("Error checking passcode:", error)
          // On error, allow access
          setPasscodeVerified(true)
          updateLastAccessTime()
        })
    }
  }, [user, loading, secretCodeEntered])

  // Show server selection when user logs in and passcode is verified
  useEffect(() => {
    if (user && !loading && !selectedServer && passcodeVerified && !showPasscodeSetup) {
      setShowServerSelection(true)
    }
  }, [user, loading, selectedServer, passcodeVerified, showPasscodeSetup])

  // Check payment status when user logs in
  useEffect(() => {
    if (!user) return

    const userPaymentRef = ref(db, `users/${user.uid}/payment`)

    // First check if payment exists
    get(userPaymentRef).then((snapshot) => {
      setPaymentChecked(true)

      if (snapshot.exists()) {
        const data = snapshot.val()
        setPaymentStatus(data.status)

        // Show payment modal if status is not verified
        if (data.status !== "verified" && isConnected) {
          setShowPaymentModal(true)
        }
      } else {
        setPaymentStatus(null)
        // Show payment modal for users with no payment data once they're connected
        if (isConnected) {
          setShowPaymentModal(true)
        }
      }
    })

    // Then listen for changes
    const unsubscribe = onValue(userPaymentRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()
        setPaymentStatus(data.status)

        // If payment is rejected or pending, show payment modal
        if (data.status !== "verified" && isConnected) {
          setShowPaymentModal(true)
        } else if (data.status === "verified") {
          // Hide modal when payment is verified
          setShowPaymentModal(false)
          // Reset subscription expired flag when payment is verified
          setSubscriptionExpired(false)
        }
      } else {
        setPaymentStatus(null)
        // Show payment modal for users with no payment data
        if (isConnected) {
          setShowPaymentModal(true)
        }
      }
    })

    return () => unsubscribe()
  }, [user, isConnected])

  const handleServerSelect = (serverId: string) => {
    setSelectedServer(serverId)
    setShowServerSelection(false)
    setIsConnected(true)

    // Show payment modal after server selection if no active subscription
    if ((paymentChecked && (!paymentStatus || paymentStatus !== "verified")) || subscriptionExpired) {
      setShowPaymentModal(true)
    }
  }

  const handlePaymentComplete = () => {
    setShowPaymentModal(false)
    setSubscriptionExpired(false)
  }

  const handleNotificationGuidanceClose = () => {
    setShowNotificationGuidance(false)
  }

  const openSettingsForNotifications = () => {
    setShowNotificationGuidance(false)
    setSettingsActiveTab("notifications")
    setShowSettings(true)
  }

  const handleSettingsClose = () => {
    setShowSettings(false)

    // Check if notifications were enabled during settings
    const notificationsAllowedNow = localStorage.getItem("notifications_allowed") === "true"
    setNotificationsAllowed(notificationsAllowedNow)

    // Check if user clicked the Allow Notification button
    const clickedAllowButtonNow = localStorage.getItem("clicked_allow_notification_button") === "true"
    setClickedAllowButton(clickedAllowButtonNow)
  }

  const handlePasscodeVerified = () => {
    setShowPasscode(false)
    setPasscodeVerified(true)
    updateLastAccessTime()
  }

  const handlePasscodeSetupComplete = () => {
    setShowPasscodeSetup(false)
    setPasscodeVerified(true)
    updateLastAccessTime()
  }

  const handlePasscodeSetupSkip = () => {
    setShowPasscodeSetup(false)
    setPasscodeVerified(true)
    updateLastAccessTime()
  }

  const handleSecretCodeEntered = () => {
    setSecretCodeEntered(true)
    setShowCalculator(false)
    // Start loading the chat components
    setChatLoaded(true)
  }

  // Always show calculator during loading
  if (loading) {
    return (
      <>
        <SecretCalculator onSecretCodeEntered={handleSecretCodeEntered} />
        <AddToHomescreen />
      </>
    )
  }

  // Always show calculator until secret code is entered
  if (showCalculator) {
    return (
      <>
        <SecretCalculator onSecretCodeEntered={handleSecretCodeEntered} />
        <AddToHomescreen />
      </>
    )
  }

  // Show passcode screen if needed (only after secret code is entered)
  if (user && secretCodeEntered && showPasscode) {
    return (
      <>
        <PasscodeScreen userId={user.uid} onVerified={handlePasscodeVerified} />
        <AddToHomescreen />
      </>
    )
  }

  // Show passcode setup if needed (only after secret code is entered)
  if (user && secretCodeEntered && showPasscodeSetup) {
    return (
      <>
        <PasscodeSetup userId={user.uid} onComplete={handlePasscodeSetupComplete} onSkip={handlePasscodeSetupSkip} />
        <AddToHomescreen />
      </>
    )
  }

  return (
    <StandaloneCheck>
      <div className="relative w-full h-screen overflow-hidden bg-transparent">
        {/* Always show matrix background but only after calculator is dismissed */}
        {!showCalculator && <MatrixBackground />}

        {/* Content */}
        <div className="relative w-full h-full bg-transparent" style={{ zIndex: 1 }}>
          {!user ? (
            <div className="w-full h-full flex items-center justify-center bg-transparent">
              <AuthScreen />
            </div>
          ) : (
            <>
              <ChatLayout selectedServer={selectedServer} />
              <ServerSelectionModal isOpen={showServerSelection} onServerSelect={handleServerSelect} />
              <PaymentModal isOpen={showPaymentModal} onClose={handlePaymentComplete} />
              {user && showNotificationGuidance && (
                <NotificationGuidanceModal
                  isOpen={showNotificationGuidance}
                  onClose={handleNotificationGuidanceClose}
                  openSettings={openSettingsForNotifications}
                />
              )}
              <SettingsModal
                isOpen={showSettings}
                onClose={handleSettingsClose}
                user={user}
                activeTab={settingsActiveTab}
              />

              {/* Only initialize OneSignal for logged-in users */}
              <OneSignalInitializer />
              <OneSignalModalManager />
            </>
          )}
        </div>
        {/* Keep the iOS PWA Debug component but hide its UI */}
        <div className="hidden">
          <IOSPWADebug />
        </div>

        {/* Always show AddToHomescreen component */}
        <AddToHomescreen />
      </div>
      {/* Then add this component at the bottom of the return statement in the StandaloneCheck component */}
      <PWADebug />
    </StandaloneCheck>
  )
}
