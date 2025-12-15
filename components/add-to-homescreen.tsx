"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export default function AddToHomescreen() {
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if the device is iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    console.log("iOS device detected:", isIOSDevice)

    // Check if the app is already installed
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true
    console.log("Is in standalone mode:", isInStandaloneMode)

    setIsIOS(isIOSDevice)
    setIsStandalone(isInStandaloneMode)
  }, [])

  // Debug log
  useEffect(() => {
    console.log("AddToHomescreen component state:", { isIOS, isStandalone })
  }, [isIOS, isStandalone])

  if (!isIOS || isStandalone) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md mx-auto text-white">
        <h2 className="text-2xl font-bold mb-6 text-center">Install Calculator to Home Screen</h2>

        <div className="space-y-8">
          <ol className="list-decimal pl-5 space-y-8">
            <li>
              <p className="mb-3 text-lg">Click on the share icon</p>
              <div className="flex justify-center">
                <Image
                  src="/press-share-icon.png"
                  alt="Press share icon"
                  width={280}
                  height={180}
                  className="rounded-lg border border-gray-600"
                />
              </div>
            </li>
            <li>
              <p className="mb-3 text-lg">Add to home screen</p>
              <div className="flex justify-center">
                <Image
                  src="/add-to-homescreen.png"
                  alt="Add to home screen"
                  width={280}
                  height={280}
                  className="rounded-lg border border-gray-600"
                />
              </div>
            </li>
          </ol>

          <p className="text-center text-gray-400 mt-8">
            Adding to home screen will give you the full app experience with offline capabilities.
          </p>
        </div>
      </div>
    </div>
  )
}
