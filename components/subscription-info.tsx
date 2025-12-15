"use client"

import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { ref, onValue } from "firebase/database"
import { useFirebase } from "@/components/firebase-provider"
import { Button } from "@/components/ui/button"
import { Clock, Calendar, CheckCircle } from "lucide-react"
import { differenceInDays } from "date-fns"

interface SubscriptionInfoProps {
  onExtend: () => void
}

export default function SubscriptionInfo({ onExtend }: SubscriptionInfoProps) {
  const { user } = useFirebase()
  const [subscription, setSubscription] = useState<{
    status: string
    plan: string
    planName: string
    expiresAt: string
    daysLeft: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const userPaymentRef = ref(db, `users/${user.uid}/payment`)
    const unsubscribe = onValue(userPaymentRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val()

        if (data.status === "verified" && data.expiresAt) {
          const expiryDate = new Date(data.expiresAt)
          const daysLeft = differenceInDays(expiryDate, new Date())

          setSubscription({
            status: data.status,
            plan: data.plan,
            planName: data.planName,
            expiresAt: data.expiresAt,
            daysLeft: daysLeft > 0 ? daysLeft : 0,
          })
        } else {
          setSubscription(null)
        }
      } else {
        setSubscription(null)
      }

      setIsLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!subscription) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400 mb-4">No active subscription</p>
        <Button onClick={onExtend} className="btn-primary">
          Subscribe Now
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Subscription Status</h3>
        <div className="bg-green-500/20 text-green-400 py-1 px-3 rounded-full text-xs flex items-center">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center">
          <Calendar className="h-5 w-5 text-gray-400 mr-2" />
          <div>
            <p className="text-sm text-gray-400">Current Plan</p>
            <p className="font-medium text-white">{subscription.planName}</p>
          </div>
        </div>

        <div className="flex items-center">
          <Clock className="h-5 w-5 text-gray-400 mr-2" />
          <div>
            <p className="text-sm text-gray-400">Time Remaining</p>
            <p className="font-medium text-white">{subscription.daysLeft} days left</p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <Button onClick={onExtend} className="w-full btn-primary">
          Extend Subscription
        </Button>
      </div>
    </div>
  )
}
