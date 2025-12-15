"use client"

import type React from "react"

import "./globals.css"
import { Inter } from "next/font/google"
import Script from "next/script"
import { useEffect } from "react"

const inter = Inter({ subsets: ["latin"] })

declare global {
  interface Window {
    OneSignal: any
  }
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only initialize OneSignal if the user is logged in
    const isLoggedIn = localStorage.getItem("user_logged_in") === "true"

    if (isLoggedIn) {
      if (typeof window !== "undefined") {
        window.OneSignal = window.OneSignal || []
        const OneSignal = window.OneSignal // Assign to a local variable
        OneSignal.push(() => {
          window.OneSignal.init({
            appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || "",
            safari_web_id: "web.onesignal.auto.3c5e9739-5d23-4b67-8983-4f5de1f54a3c",
            notifyButton: {
              enable: false,
            },
            allowLocalhostAsSecureOrigin: true,
            promptOptions: {
              slidedown: {
                prompts: [
                  {
                    type: "push",
                    autoPrompt: false,
                    text: {
                      actionMessage: "Subscribe to our notifications for the latest news and updates.",
                      acceptButton: "Subscribe",
                      cancelButton: "Later",
                    },
                  },
                ],
              },
            },
          })
        })
      }
    }
  }, [])

  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Script src="/register-sw.js" strategy="beforeInteractive" />
      </head>
      <body className={inter.className}>
        {children}
        <Script src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" strategy="beforeInteractive" />
      </body>
    </html>
  )
}
