"use client"

import { useState, useEffect, useRef } from "react"
import { Play, Pause } from "lucide-react"

interface VoiceMessageProps {
  audioUrl: string
  duration: number
  isCurrentUser: boolean
}

export default function VoiceMessage({ audioUrl, duration, isCurrentUser }: VoiceMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // Use a ref to keep track of the audio element
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio on mount and when audioUrl changes
  useEffect(() => {
    // Clean up previous audio instance if it exists
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ""
    }

    // Create a new audio element
    const audio = new Audio()
    audio.preload = "metadata"
    audio.src = audioUrl
    audioRef.current = audio

    console.log(`Initializing audio for URL: ${audioUrl}`)

    // Set up event listeners
    const handlePlay = () => {
      console.log("Audio playing")
      setIsPlaying(true)
    }

    const handlePause = () => {
      console.log("Audio paused")
      setIsPlaying(false)
    }

    const handleEnded = () => {
      console.log("Audio ended")
      setIsPlaying(false)
      setCurrentTime(0)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }

    const handleError = (e: any) => {
      console.error("Audio playback error:", e, audio.error)
      setError(`Playback error: ${audio.error?.message || "Unknown error"}`)
    }

    const handleCanPlay = () => {
      console.log("Audio can play")
      setError(null)
    }

    // Add event listeners
    audio.addEventListener("play", handlePlay)
    audio.addEventListener("pause", handlePause)
    audio.addEventListener("ended", handleEnded)
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("error", handleError)
    audio.addEventListener("canplay", handleCanPlay)

    // Clean up on unmount or when audioUrl changes
    return () => {
      console.log("Cleaning up audio element")
      audio.pause()
      audio.src = ""
      audio.removeEventListener("play", handlePlay)
      audio.removeEventListener("pause", handlePause)
      audio.removeEventListener("ended", handleEnded)
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("error", handleError)
      audio.removeEventListener("canplay", handleCanPlay)
      audioRef.current = null
    }
  }, [audioUrl]) // Re-initialize when audioUrl changes

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      // Reset to beginning if at the end
      if (audioRef.current.currentTime >= duration) {
        audioRef.current.currentTime = 0
      }

      // Play with error handling
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error)
        setError("Couldn't play audio. Please try again.")
      })
    }
  }

  // Format time as mm:ss
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Calculate progress percentage
  const progress = (currentTime / duration) * 100

  return (
    <div
      className={`flex items-center py-2 px-3 rounded-2xl ${isCurrentUser ? "bg-[#f4427e]" : "bg-gray-700"} relative`}
    >
      <button
        onClick={togglePlayPause}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isCurrentUser ? "bg-[#d13a6e]" : "bg-gray-600"
        }`}
      >
        {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white ml-0.5" />}
      </button>

      <div className="flex-1 mx-2 h-10 flex items-center">
        <div className="w-full h-8 flex items-center">
          {/* Waveform visualization */}
          <div className="w-full h-6 flex items-center space-x-0.5">
            {Array.from({ length: 25 }).map((_, i) => {
              // Create a dynamic waveform pattern
              const height = Math.sin((i / 25) * Math.PI * 4) * 0.5 + 0.5
              const barHeight = 4 + height * 12

              // Determine if this bar should be highlighted based on progress
              const isActive = (i / 25) * 100 <= progress

              return (
                <div
                  key={i}
                  className={`w-1 rounded-full ${
                    isActive
                      ? isCurrentUser
                        ? "bg-white"
                        : "bg-[#f4427e]"
                      : isCurrentUser
                        ? "bg-[#ff85a9]"
                        : "bg-gray-500"
                  }`}
                  style={{ height: `${barHeight}px` }}
                ></div>
              )
            })}
          </div>
        </div>
      </div>

      <span className="text-xs text-white flex-shrink-0 min-w-[35px] text-right">{formatTime(duration)}</span>

      {/* Error message */}
      {error && <div className="absolute bottom-[-20px] left-0 right-0 text-center text-xs text-red-400">{error}</div>}
    </div>
  )
}
