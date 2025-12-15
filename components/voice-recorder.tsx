"use client"

import { useState, useRef, useEffect } from "react"
import { Mic, Square, Send, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VoiceRecorderProps {
  onVoiceRecorded: (blob: Blob, duration: number) => void
  onCancel: () => void
}

export default function VoiceRecorder({ onVoiceRecorded, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [isMobile, setIsMobile] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const waveformRef = useRef<HTMLDivElement>(null)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera
      return /android|iPad|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
    }

    setIsMobile(checkMobile())
  }, [])

  // Start recording immediately when component mounts
  useEffect(() => {
    startRecording()

    // Clean up on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }

      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [])

  // Start recording
  const startRecording = async () => {
    try {
      console.log("Starting recording...")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log("Got media stream:", stream)

      // Use a simple, widely supported audio format
      // For iOS compatibility, we'll use a basic audio format
      let options: MediaRecorderOptions | undefined = undefined

      // Try to use MP3 if supported (most compatible)
      if (MediaRecorder.isTypeSupported("audio/mpeg")) {
        options = { mimeType: "audio/mpeg" }
        console.log("Using MP3 format (mpeg)")
      }
      // Try MP3 alternative mime type
      else if (MediaRecorder.isTypeSupported("audio/mp3")) {
        options = { mimeType: "audio/mp3" }
        console.log("Using MP3 format")
      }
      // Fallback to WebM (widely supported on Android)
      else if (MediaRecorder.isTypeSupported("audio/webm")) {
        options = { mimeType: "audio/webm" }
        console.log("Using WebM format")
      }
      // Fallback to WAV (basic format)
      else if (MediaRecorder.isTypeSupported("audio/wav")) {
        options = { mimeType: "audio/wav" }
        console.log("Using WAV format")
      }
      // Last resort - no specified format
      else {
        console.log("No specific audio format supported, using default")
      }

      console.log("MediaRecorder options:", options)

      const mediaRecorder = new MediaRecorder(stream, options)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        console.log("Data available:", event.data.size, "type:", event.data.type)
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        console.log("MediaRecorder stopped, chunks:", audioChunksRef.current.length)
        if (audioChunksRef.current.length > 0) {
          // Use the actual MIME type from the recorder
          const mimeType = mediaRecorder.mimeType || "audio/webm"
          console.log("Creating blob with MIME type:", mimeType)
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          setAudioBlob(audioBlob)
          console.log("Audio blob created:", audioBlob.size, "type:", audioBlob.type)
        }

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop())
      }

      // Start recording
      mediaRecorder.start(100) // Collect data every 100ms
      console.log("MediaRecorder started with MIME type:", mediaRecorder.mimeType)
      setIsRecording(true)
      startTimeRef.current = Date.now()

      // Start timer
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setRecordingTime(elapsed)
        animateWaveform()
      }, 100)
    } catch (error) {
      console.error("Error accessing microphone:", error)
      alert("Could not access microphone. Please check permissions.")
      onCancel()
    }
  }

  // Stop recording
  const stopRecording = () => {
    console.log("Stopping recording...")
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  // Cancel recording
  const cancelRecording = () => {
    console.log("Canceling recording...")
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)

      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    setAudioBlob(null)
    setRecordingTime(0)
    onCancel()
  }

  // Send recorded audio
  const sendRecording = () => {
    console.log("Sending recording, blob:", audioBlob)
    if (audioBlob) {
      onVoiceRecorded(audioBlob, recordingTime)
      setAudioBlob(null)
      setRecordingTime(0)
    } else {
      console.log("No audio blob to send")
      stopRecording()
      setTimeout(() => {
        if (audioChunksRef.current.length > 0) {
          // Use the actual MIME type from the recorder if available
          const mimeType = mediaRecorderRef.current?.mimeType || "audio/webm"
          console.log("Creating blob with MIME type:", mimeType)
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
          onVoiceRecorded(audioBlob, recordingTime)
        } else {
          alert("Failed to record audio. Please try again.")
          onCancel()
        }
      }, 500)
    }
  }

  // Animate waveform during recording
  const animateWaveform = () => {
    if (!waveformRef.current || !isRecording) return

    const bars = waveformRef.current.querySelectorAll(".waveform-bar")
    bars.forEach((bar) => {
      // Random height for waveform animation
      const height = 4 + Math.random() * 12
      ;(bar as HTMLElement).style.height = `${height}px`
    })
  }

  // Format time as mm:ss
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60)
    const seconds = Math.floor(timeInSeconds % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex flex-col items-center w-full">
      {/* Cancel button */}
      <div className="flex flex-col items-center mb-2 cursor-pointer" onClick={cancelRecording}>
        <div className="bg-gray-800 rounded-full p-2 mb-1">
          <Trash2 className="h-5 w-5 text-red-500" />
        </div>
        <span className="text-xs text-gray-400">Click to cancel</span>
      </div>

      {/* Recording interface */}
      <div className="flex items-center space-x-2 w-full">
        <div className="flex items-center space-x-2 w-full bg-gray-800 rounded-full p-2">
          {isRecording ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={stopRecording}
                className="bg-[#f4427e] hover:bg-[#d13a6e] text-white rounded-full h-8 w-8 flex-shrink-0"
              >
                <Square className="h-4 w-4" />
              </Button>

              <div className="flex-1 flex items-center">
                <div className="w-full h-8 flex items-center">
                  <div ref={waveformRef} className="w-full h-6 flex items-center space-x-0.5">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div
                        key={i}
                        className="waveform-bar w-1 bg-[#f4427e] rounded-full"
                        style={{ height: `${4 + Math.random() * 12}px` }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>

              <span className="text-xs text-white flex-shrink-0">{formatTime(recordingTime)}</span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={sendRecording}
                className="bg-[#f4427e] hover:bg-[#d13a6e] text-white rounded-full h-8 w-8 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={startRecording}
                className="bg-[#f4427e] hover:bg-[#d13a6e] text-white rounded-full h-8 w-8 flex-shrink-0"
              >
                <Mic className="h-4 w-4" />
              </Button>

              <div className="flex-1 flex items-center">
                <div className="w-full h-8 flex items-center">
                  <div className="w-full h-6 flex items-center space-x-0.5">
                    {Array.from({ length: 30 }).map((_, i) => {
                      // Create a static waveform pattern
                      const height = Math.sin((i / 30) * Math.PI * 4) * 0.5 + 0.5
                      const barHeight = 4 + height * 12

                      return (
                        <div
                          key={i}
                          className="w-1 bg-[#f4427e] rounded-full"
                          style={{ height: `${barHeight}px` }}
                        ></div>
                      )
                    })}
                  </div>
                </div>
              </div>

              <span className="text-xs text-white flex-shrink-0">{formatTime(recordingTime)}</span>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={cancelRecording}
                className="text-gray-400 hover:text-white hover:bg-gray-700 h-8 w-8 flex-shrink-0 mr-1"
              >
                <X className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={sendRecording}
                className="bg-[#f4427e] hover:bg-[#d13a6e] text-white rounded-full h-8 w-8 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
