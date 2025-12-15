"use client"

import { useEffect, useState } from "react"

export default function OneSignalModalManager() {
  const [isOneSignalModalVisible, setIsOneSignalModalVisible] = useState(false)

  useEffect(() => {
    // Function to check if OneSignal modal is visible
    const checkOneSignalModal = () => {
      const oneSignalModal = document.querySelector(".onesignal-slidedown-container")
      const isVisible = oneSignalModal !== null && window.getComputedStyle(oneSignalModal).display !== "none"

      setIsOneSignalModalVisible(isVisible)

      if (isVisible) {
        const oneSignalContainer = document.querySelector(".onesignal-slidedown-container")
        if (oneSignalContainer instanceof HTMLElement) {
          oneSignalContainer.style.zIndex = "2147483647"
          oneSignalContainer.style.pointerEvents = "auto"
        }

        // Ensure buttons are clickable
        const oneSignalButtons = document.querySelectorAll(".onesignal-slidedown-button")
        oneSignalButtons.forEach((button) => {
          if (button instanceof HTMLElement) {
            button.style.pointerEvents = "auto"
            button.style.zIndex = "2147483647"
          }
        })
      }
    }

    // Check immediately and then set up an observer
    checkOneSignalModal()

    // Set up a MutationObserver to detect when the OneSignal modal appears or disappears
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList" || mutation.type === "attributes") {
          checkOneSignalModal()
        }
      }
    })

    // Start observing the body for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"],
    })

    // Also check periodically
    const interval = setInterval(checkOneSignalModal, 500)

    // Add a manual trigger for OneSignal prompt after a delay
    const showPromptTimeout = setTimeout(() => {
      if (window.OneSignal && typeof window.OneSignal.showSlidedownPrompt === "function") {
        console.log("Manually triggering OneSignal prompt from modal manager")
        try {
          window.OneSignal.showSlidedownPrompt()
        } catch (error) {
          console.error("Error showing OneSignal prompt:", error)
        }
      }
    }, 5000)

    return () => {
      observer.disconnect()
      clearInterval(interval)
      clearTimeout(showPromptTimeout)
    }
  }, [])

  useEffect(() => {
    if (isOneSignalModalVisible) {
      const style = document.createElement("style")
      style.id = "onesignal-modal-fix"
      style.innerHTML = `
        /* Make OneSignal modal interactive and on top */
        .onesignal-slidedown-container {
          z-index: 2147483647 !important;
          position: fixed !important;
          pointer-events: auto !important;
        }
        
        /* Make OneSignal buttons clickable */
        .onesignal-slidedown-button {
          z-index: 2147483647 !important;
          position: relative !important;
          pointer-events: auto !important;
        }
        
        /* Keep OneSignal elements interactive */
        .onesignal-slidedown-container, 
        .onesignal-slidedown-container * {
          pointer-events: auto !important;
        }
      `
      document.head.appendChild(style)

      return () => {
        const styleElement = document.getElementById("onesignal-modal-fix")
        if (styleElement) {
          styleElement.remove()
        }
      }
    }
  }, [isOneSignalModalVisible])

  return null
}
