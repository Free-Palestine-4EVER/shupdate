"use client"

import { useEffect, useRef } from "react"

export default function MatrixBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)

    // Matrix characters
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+-=[]{}|;:,./<>?~"
    const charArray = chars.split("")

    // Column setup
    const fontSize = 14
    const columns = Math.ceil(canvas.width / fontSize)

    // Drops array
    const drops = Array(columns).fill(0)

    // Fill initial positions
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.floor(Math.random() * -20)
    }

    // Animation frame ID for cleanup
    let animationFrameId: number
    let lastFrameTime = 0
    const frameDelay = 30 // Much faster animation (lower = faster)

    // Draw function
    function draw(currentTime: number) {
      // Only update if enough time has passed
      if (currentTime - lastFrameTime > frameDelay) {
        lastFrameTime = currentTime

        // Semi-transparent black background to create trail effect
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)"
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Set text color and font
        ctx.fillStyle = "#f4427e"
        ctx.font = `${fontSize}px monospace`

        // Draw characters
        for (let i = 0; i < drops.length; i++) {
          // Get random character
          const text = charArray[Math.floor(Math.random() * charArray.length)]

          // Make some characters brighter
          if (Math.random() > 0.9) {
            ctx.fillStyle = "#ff85a9"
            ctx.font = `bold ${fontSize}px monospace`
          } else {
            ctx.fillStyle = "#f4427e"
            ctx.font = `${fontSize}px monospace`
          }

          // Draw the character
          ctx.fillText(text, i * fontSize, drops[i] * fontSize)

          // Move drop down (faster speed)
          drops[i] += 1

          // Reset drop when it reaches bottom
          if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
            drops[i] = 0
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    // Start animation
    animationFrameId = requestAnimationFrame(draw)

    // Cleanup
    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed top-0 left-0 w-full h-full"
      style={{
        zIndex: -1,
        pointerEvents: "none",
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
      }}
    />
  )
}
