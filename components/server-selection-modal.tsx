"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Shield, Check, Loader2, Sparkles, Lock, Globe } from "lucide-react"
import ElectricBorder from "@/components/electric-border"

interface ServerSelectionModalProps {
  isOpen: boolean
  onServerSelect: (server: string) => void
}

const servers = [
  { id: "russia", name: "Russia Server", flag: "🇷🇺", label: "Fastest", ping: "45ms", color: "#7df9ff" },
  { id: "hongkong", name: "Hong Kong Server", flag: "🇭🇰", ping: "120ms", color: "#ff7d7d" },
  { id: "malta", name: "Malta Server", flag: "🇲🇹", ping: "180ms", color: "#ffd77d" },
  { id: "china", name: "China Server", flag: "🇨🇳", ping: "210ms", color: "#ff7dff" },
]

export default function ServerSelectionModal({ isOpen, onServerSelect }: ServerSelectionModalProps) {
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const handleServerSelect = (serverId: string) => {
    setSelectedServer(serverId)
    setIsConnecting(true)

    // Simulate connection delay
    setTimeout(() => {
      setIsConnecting(false)
      onServerSelect(serverId)
    }, 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="sm:max-w-md border-0 backdrop-blur-xl shadow-2xl" style={{
        background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.95) 0%, rgba(15, 15, 20, 0.98) 100%)'
      }}>
        {/* Floating Security Elements */}
        <div className="absolute -top-2 -left-2 w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute -top-1 -right-3 w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-30 animate-ping"></div>
        <div className="absolute -bottom-2 -left-3 w-4 h-4 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full opacity-25 animate-bounce"></div>

        <DialogHeader className="text-center space-y-4 pb-2">
          {/* Animated Security Icon */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25 animate-pulse">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
              <Globe className="h-6 w-6 text-white animate-spin" style={{ animationDuration: "3s" }} />
            </div>
          </div>

          <DialogTitle className="text-white text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Select Secure Server
          </DialogTitle>

          {/* Security Status */}
          <div className="flex items-center justify-center space-x-2 text-sm">
            <div className="flex items-center space-x-1 px-3 py-1 bg-green-500/20 rounded-full border border-green-500/30">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
              <span className="text-green-400 font-medium">End-to-End Encrypted</span>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Security Notice */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 p-4 rounded-xl backdrop-blur-sm">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/25">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-amber-200 text-sm font-medium mb-1">Security Notice</p>
                <p className="text-amber-100/80 text-xs leading-relaxed">
                  Connect through our secure tunnel network to protect your identity and ensure maximum privacy.
                </p>
              </div>
            </div>
          </div>

          {/* Server List */}
          <div className="space-y-3">
            {servers.map((server) => (
              <ElectricBorder
                key={server.id}
                color={selectedServer === server.id ? server.color : "transparent"}
                speed={selectedServer === server.id ? 1.5 : 0}
                chaos={0.5}
                thickness={2}
                style={{ borderRadius: 12 }}
              >
                <Button
                  variant="outline"
                  className={`w-full h-auto p-4 border-0 text-left transition-all duration-300 hover:scale-[1.02] ${selectedServer === server.id
                    ? "shadow-lg"
                    : ""
                    }`}
                  style={{
                    background: selectedServer === server.id
                      ? 'linear-gradient(135deg, rgba(30, 30, 38, 0.95) 0%, rgba(20, 20, 28, 0.95) 100%)'
                      : 'linear-gradient(135deg, rgba(30, 30, 38, 0.6) 0%, rgba(20, 20, 28, 0.6) 100%)',
                    backdropFilter: 'blur(10px)',
                    border: selectedServer === server.id ? '2px solid #ffffff' : '2px solid transparent'
                  }}
                  disabled={isConnecting}
                  onClick={() => handleServerSelect(server.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-4">
                      {/* Flag with glow effect */}
                      <div className="text-2xl relative">
                        {server.flag}
                        {selectedServer === server.id && (
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-lg opacity-30 animate-pulse"></div>
                        )}
                      </div>

                      <div className="text-left">
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-white text-base">{server.name}</p>
                          {server.label && (
                            <span className="text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 rounded-full font-medium shadow-lg shadow-green-500/25">
                              {server.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="flex items-center space-x-1">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-400 font-medium">Ping: {server.ping}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {selectedServer === server.id && isConnecting ? (
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25">
                          <Loader2 className="h-4 w-4 text-white animate-spin" />
                        </div>
                      ) : selectedServer === server.id ? (
                        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/25 animate-pulse">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gradient-to-r from-slate-600 to-slate-500 rounded-full flex items-center justify-center opacity-50 group-hover:opacity-100 transition-opacity">
                          <div className="w-3 h-3 border-2 border-white rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </Button>
              </ElectricBorder>
            ))}
          </div>

          {/* Connection Status */}
          {isConnecting && (
            <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 p-4 rounded-xl backdrop-blur-sm animate-pulse">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Lock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-blue-200 text-sm font-medium">Establishing Secure Connection</p>
                  <p className="text-blue-100/70 text-xs">Creating encrypted tunnel...</p>
                </div>
                <div className="ml-auto">
                  <Sparkles className="h-5 w-5 text-blue-400 animate-spin" />
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
