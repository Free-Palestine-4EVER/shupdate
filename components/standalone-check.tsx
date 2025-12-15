"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Image from "next/image"

export default function StandaloneCheck({ children }: { children: React.ReactNode }) {
  const [isStandalone, setIsStandalone] = useState(true)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if the app is running in standalone mode
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true

    // Check if the device is iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream

    setIsStandalone(isInStandaloneMode)
    setIsIOS(isIOSDevice)
  }, [])

  if (isStandalone || !isIOS) {
    return <>{children}</>
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 z-50">
      <div className="max-w-md w-full bg-gray-900 rounded-lg p-8 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-white mb-4">Install Shhhhh to Home Screen</h1>

        <div className="bg-gray-800 p-4 rounded-lg mb-6 w-full">
          <ol className="list-decimal pl-5 text-gray-300 space-y-6">
            <li>
              <p className="mb-2">Click on the share icon</p>
              <div className="flex justify-center">
                <Image
                  src="/press-share-icon.png"
                  alt="Press share icon"
                  width={400}
                  height={250}
                  className="rounded-lg border border-gray-700"
                />
              </div>
            </li>
            <li>
              <p className="mb-2">Add to home screen</p>
              <div className="flex justify-center">
                <Image
                  src="/add-to-homescreen.png"
                  alt="Add to home screen"
                  width={400}
                  height={400}
                  className="rounded-lg border border-gray-700"
                />
              </div>
            </li>
          </ol>
        </div>

        <p className="text-red-400 text-sm text-center">
          You must add this app to your home screen to use it. This ensures the best security and performance.
        </p>
      </div>
    </div>
  )
}
