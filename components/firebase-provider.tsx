"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { type User as FirebaseUser, onAuthStateChanged } from "firebase/auth"

interface FirebaseContextType {
  user: FirebaseUser | null
  loading: boolean
  firebaseInitialized: boolean
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  loading: true,
  firebaseInitialized: false,
})

export const useFirebase = () => useContext(FirebaseContext)
export const useAuth = useFirebase

export default function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [firebaseInitialized, setFirebaseInitialized] = useState(false)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    const initAuth = async () => {
      try {
        // Dynamic import to ensure this only runs on client
        const { getFirebaseAuth } = await import("@/lib/firebase")
        const auth = getFirebaseAuth()

        setFirebaseInitialized(true)

        unsubscribe = onAuthStateChanged(auth, (user) => {
          setUser(user)
          setLoading(false)
        })
      } catch (error) {
        console.error("Error initializing Firebase auth:", error)
        setLoading(false)
        setFirebaseInitialized(true)
      }
    }

    initAuth()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [])

  return <FirebaseContext.Provider value={{ user, loading, firebaseInitialized }}>{children}</FirebaseContext.Provider>
}
