"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BellRing, Settings } from "lucide-react"

interface NotificationGuidanceModalProps {
  isOpen: boolean
  onClose: () => void
  openSettings: () => void
}

export default function NotificationGuidanceModal({ isOpen, onClose, openSettings }: NotificationGuidanceModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-gray-900 text-white border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">Enable Notifications</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-gray-800/50 p-4 rounded-md border border-gray-700">
            <p className="text-center mb-4">
              To receive important messages and updates, please enable notifications by following these steps:
            </p>

            <div className="flex flex-col items-center space-y-4">
              <div className="flex items-center space-x-2 text-sm">
                <Settings className="h-4 w-4 text-blue-400" />
                <span>Go to Settings</span>
              </div>

              <div className="flex items-center space-x-2 text-sm">
                <span className="inline-block w-4 h-4 bg-blue-500 rounded-md"></span>
                <span>Select "Notifications" tab</span>
              </div>

              <div className="flex items-center space-x-2 text-sm">
                <BellRing className="h-4 w-4 text-green-400" />
                <span>Click "Always Allow Notification"</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={openSettings}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Settings className="mr-2 h-4 w-4" />
              Open Settings
            </Button>
          </div>

          <div className="text-center">
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-white underline">
              Maybe later
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
