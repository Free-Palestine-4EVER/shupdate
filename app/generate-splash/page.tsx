"use client"

import { useState, useRef, useEffect } from "react"

const SPLASH_SIZES = [
  { width: 640, height: 1136, name: "splash-640x1136.png" },
  { width: 750, height: 1334, name: "splash-750x1334.png" },
  { width: 1242, height: 2208, name: "splash-1242x2208.png" },
  { width: 1125, height: 2436, name: "splash-1125x2436.png" },
  { width: 1536, height: 2048, name: "splash-1536x2048.png" },
  { width: 1668, height: 2224, name: "splash-1668x2224.png" },
  { width: 2048, height: 2732, name: "splash-2048x2732.png" },
]

export default function GenerateSplash() {
  const [generated, setGenerated] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || generated) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Function to generate and download a splash screen
    const generateSplash = (width: number, height: number, name: string) => {
      canvas.width = width
      canvas.height = height

      // Background
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, width, height)

      // Logo
      const logoSize = Math.min(width, height) * 0.3
      const centerX = width / 2
      const centerY = height / 2

      // Circle background
      ctx.fillStyle = "#f4427e"
      ctx.beginPath()
      ctx.arc(centerX, centerY, logoSize / 2, 0, Math.PI * 2)
      ctx.fill()

      // Text
      ctx.fillStyle = "black"
      ctx.font = `bold ${logoSize * 0.6}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("S", centerX, centerY)

      // App name
      ctx.fillStyle = "white"
      ctx.font = `bold ${logoSize * 0.2}px sans-serif`
      ctx.fillText("Shhhh Chat", centerX, centerY + logoSize * 0.8)

      // Create download link
      const link = document.createElement("a")
      link.download = name
      link.href = canvas.toDataURL("image/png")
      link.click()
    }

    // Generate all splash screens
    SPLASH_SIZES.forEach((size) => {
      generateSplash(size.width, size.height, size.name)
    })

    setGenerated(true)
  }, [generated])

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Splash Screen Generator</h1>
      <p className="mb-4">
        {generated
          ? "Splash screens have been generated and downloaded. Place them in the /public/icons directory."
          : "Click the button below to generate and download all required splash screens."}
      </p>
      <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={() => setGenerated(false)}>
        Generate Splash Screens
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
