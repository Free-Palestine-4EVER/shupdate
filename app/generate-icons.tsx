"use client"

import { useState, useRef, useEffect } from "react"

export default function GenerateIcons() {
  const [generated, setGenerated] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || generated) return

    const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Function to generate and download an icon
    const generateIcon = (size: number) => {
      canvas.width = size
      canvas.height = size

      // Background
      ctx.fillStyle = "#f4427e"
      ctx.fillRect(0, 0, size, size)

      // Text
      ctx.fillStyle = "black"
      ctx.font = `bold ${size * 0.6}px sans-serif`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText("S", size / 2, size / 2)

      // Create download link
      const link = document.createElement("a")
      link.download = `icon-${size}x${size}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    }

    // Generate all icons
    sizes.forEach((size) => generateIcon(size))
    setGenerated(true)
  }, [generated])

  return (
    <div className="p-4">
      <h1 className="text-xl mb-4">Icon Generator</h1>
      <p className="mb-4">
        {generated
          ? "Icons have been generated and downloaded. Place them in the /public/icons directory."
          : "Click the button below to generate and download all required icons."}
      </p>
      <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={() => setGenerated(false)}>
        Generate Icons
      </button>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
