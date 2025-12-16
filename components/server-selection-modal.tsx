"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Shield, Check, Loader2, Sparkles, Lock, Globe } from "lucide-react"

interface ServerSelectionModalProps {
  isOpen: boolean
  onServerSelect: (server: string) => void
}

const servers = [
  { id: "russia", name: "Russia", flag: "🇷🇺", label: "Fastest", ping: "45ms", color: "#7df9ff" },
  { id: "hongkong", name: "Hong Kong", flag: "🇭🇰", ping: "120ms", color: "#ff7d7d" },
  { id: "malta", name: "Malta", flag: "🇲🇹", ping: "180ms", color: "#ffd77d" },
  { id: "china", name: "China", flag: "🇨🇳", ping: "210ms", color: "#ff7dff" },
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
    }, 1500)
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => { }}>
      <DialogContent className="w-[95vw] max-w-sm sm:max-w-md border-0 bg-gray-900/95 backdrop-blur-xl shadow-2xl p-4 gap-4 rounded-xl" style={{
        background: 'linear-gradient(135deg, rgba(20, 20, 28, 0.98) 0%, rgba(10, 10, 15, 0.99) 100%)'
      }}>
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-3">
            <Globe className="h-6 w-6 text-blue-400 animate-pulse" />
          </div>

          <DialogTitle className="text-white text-lg font-bold">
            Select Server
          </DialogTitle>

          <div className="flex items-center justify-center space-x-2 text-xs mt-2">
            <div className="flex items-center space-x-1 px-2 py-0.5 bg-green-500/20 rounded-full border border-green-500/30">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping"></div>
              <span className="text-green-400">Encrypted</span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Security Notice */}
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-100/80 text-xs leading-relaxed">
                Traffic is routed through secure offshore servers.
              </p>
            </div>
          </div>

          {/* Server List */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {servers.map((server) => (
              <div
                key={server.id}
                onClick={() => !isConnecting && handleServerSelect(server.id)}
                className={`
                  relative overflow-hidden rounded-xl p-3 cursor-pointer transition-all duration-200
                  border
                  ${selectedServer === server.id
                    ? 'bg-white/10 border-white/40 shadow-lg scale-[1.02]'
                    : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{server.flag}</span>
                    <div>
                      <h3 className="text-white font-medium text-sm">{server.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${selectedServer === server.id ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-400'}`}>
                          {server.ping}
                        </span>
                        {server.label && (
                          <span className="text-[10px] text-green-400 font-medium">
                            {server.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedServer === server.id ? (
                    isConnecting ? (
                      <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                    ) : (
                      <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    )
                  ) : (
                    <div className="h-5 w-5 rounded-full border border-white/20" />
                  )}
                </div>

                {selectedServer === server.id && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 pointer-events-none" />
                )}
              </div>
            ))}
          </div>

          {isConnecting && (
            <div className="text-center pb-2">
              <p className="text-blue-300 text-xs animate-pulse flex items-center justify-center gap-2">
                <Lock className="w-3 h-3" /> Encrypting connection...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
