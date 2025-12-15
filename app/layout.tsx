import type React from "react"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import Script from "next/script"

export const metadata = {
  title: "Calculator",
  description: "A simple calculator app",
  manifest: "/manifest.json",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Calculator",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    other: [
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
    generator: 'v0.app'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Critical CSS Fallback - ensures styling works even if Tailwind fails */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
          /* Critical CSS Fallback - ensures styling works even if Tailwind fails */
          *, *::before, *::after { box-sizing: border-box !important; }
          html, body { margin: 0 !important; padding: 0 !important; min-height: 100vh !important; }
          body { background-color: #000 !important; color: #fff !important; font-family: system-ui, -apple-system, sans-serif !important; }
          
          /* Flexbox utilities */
          .flex { display: flex !important; }
          .flex-col { flex-direction: column !important; }
          .flex-row { flex-direction: row !important; }
          .flex-1 { flex: 1 1 0% !important; }
          .flex-shrink-0 { flex-shrink: 0 !important; }
          .items-center { align-items: center !important; }
          .items-start { align-items: flex-start !important; }
          .items-end { align-items: flex-end !important; }
          .justify-center { justify-content: center !important; }
          .justify-between { justify-content: space-between !important; }
          .justify-start { justify-content: flex-start !important; }
          .justify-end { justify-content: flex-end !important; }
          .flex-wrap { flex-wrap: wrap !important; }
          .gap-1 { gap: 0.25rem !important; }
          .gap-2 { gap: 0.5rem !important; }
          .gap-3 { gap: 0.75rem !important; }
          .gap-4 { gap: 1rem !important; }
          .gap-6 { gap: 1.5rem !important; }
          
          /* Grid utilities */
          .grid { display: grid !important; }
          .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
          .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          
          /* Display utilities */
          .hidden { display: none !important; }
          .block { display: block !important; }
          .inline { display: inline !important; }
          .inline-block { display: inline-block !important; }
          .inline-flex { display: inline-flex !important; }
          
          /* Position utilities */
          .relative { position: relative !important; }
          .absolute { position: absolute !important; }
          .fixed { position: fixed !important; }
          .sticky { position: sticky !important; }
          .inset-0 { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
          .top-0 { top: 0 !important; }
          .right-0 { right: 0 !important; }
          .bottom-0 { bottom: 0 !important; }
          .left-0 { left: 0 !important; }
          .top-1 { top: 0.25rem !important; }
          .top-2 { top: 0.5rem !important; }
          .right-1 { right: 0.25rem !important; }
          .right-2 { right: 0.5rem !important; }
          .right-4 { right: 1rem !important; }
          .bottom-4 { bottom: 1rem !important; }
          
          /* Sizing utilities */
          .w-full { width: 100% !important; }
          .w-auto { width: auto !important; }
          .w-4 { width: 1rem !important; }
          .w-5 { width: 1.25rem !important; }
          .w-6 { width: 1.5rem !important; }
          .w-8 { width: 2rem !important; }
          .w-10 { width: 2.5rem !important; }
          .w-12 { width: 3rem !important; }
          .w-16 { width: 4rem !important; }
          .w-20 { width: 5rem !important; }
          .w-24 { width: 6rem !important; }
          .w-32 { width: 8rem !important; }
          .w-48 { width: 12rem !important; }
          .w-64 { width: 16rem !important; }
          .w-72 { width: 18rem !important; }
          .w-80 { width: 20rem !important; }
          .w-96 { width: 24rem !important; }
          .h-full { height: 100% !important; }
          .h-auto { height: auto !important; }
          .h-4 { height: 1rem !important; }
          .h-5 { height: 1.25rem !important; }
          .h-6 { height: 1.5rem !important; }
          .h-8 { height: 2rem !important; }
          .h-10 { height: 2.5rem !important; }
          .h-12 { height: 3rem !important; }
          .h-16 { height: 4rem !important; }
          .h-screen { height: 100vh !important; }
          .min-h-screen { min-height: 100vh !important; }
          .min-h-full { min-height: 100% !important; }
          .min-w-0 { min-width: 0 !important; }
          .max-w-full { max-width: 100% !important; }
          .max-w-sm { max-width: 24rem !important; }
          .max-w-md { max-width: 28rem !important; }
          .max-w-lg { max-width: 32rem !important; }
          .max-w-xl { max-width: 36rem !important; }
          .max-w-2xl { max-width: 42rem !important; }
          .max-h-full { max-height: 100% !important; }
          .max-h-screen { max-height: 100vh !important; }
          
          /* Spacing utilities */
          .p-0 { padding: 0 !important; }
          .p-1 { padding: 0.25rem !important; }
          .p-2 { padding: 0.5rem !important; }
          .p-3 { padding: 0.75rem !important; }
          .p-4 { padding: 1rem !important; }
          .p-5 { padding: 1.25rem !important; }
          .p-6 { padding: 1.5rem !important; }
          .p-8 { padding: 2rem !important; }
          .px-1 { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
          .px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
          .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
          .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
          .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
          .py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
          .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
          .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
          .py-4 { padding-top: 1rem !important; padding-bottom: 1rem !important; }
          .pt-2 { padding-top: 0.5rem !important; }
          .pt-4 { padding-top: 1rem !important; }
          .pb-2 { padding-bottom: 0.5rem !important; }
          .pb-4 { padding-bottom: 1rem !important; }
          .pb-20 { padding-bottom: 5rem !important; }
          .m-0 { margin: 0 !important; }
          .m-1 { margin: 0.25rem !important; }
          .m-2 { margin: 0.5rem !important; }
          .m-4 { margin: 1rem !important; }
          .mx-auto { margin-left: auto !important; margin-right: auto !important; }
          .mx-2 { margin-left: 0.5rem !important; margin-right: 0.5rem !important; }
          .my-2 { margin-top: 0.5rem !important; margin-bottom: 0.5rem !important; }
          .my-4 { margin-top: 1rem !important; margin-bottom: 1rem !important; }
          .mt-1 { margin-top: 0.25rem !important; }
          .mt-2 { margin-top: 0.5rem !important; }
          .mt-4 { margin-top: 1rem !important; }
          .mt-auto { margin-top: auto !important; }
          .mb-1 { margin-bottom: 0.25rem !important; }
          .mb-2 { margin-bottom: 0.5rem !important; }
          .mb-4 { margin-bottom: 1rem !important; }
          .ml-1 { margin-left: 0.25rem !important; }
          .ml-2 { margin-left: 0.5rem !important; }
          .ml-auto { margin-left: auto !important; }
          .mr-1 { margin-right: 0.25rem !important; }
          .mr-2 { margin-right: 0.5rem !important; }
          .mr-auto { margin-right: auto !important; }
          .-mt-1 { margin-top: -0.25rem !important; }
          .space-y-1 > * + * { margin-top: 0.25rem !important; }
          .space-y-2 > * + * { margin-top: 0.5rem !important; }
          .space-y-4 > * + * { margin-top: 1rem !important; }
          .space-x-1 > * + * { margin-left: 0.25rem !important; }
          .space-x-2 > * + * { margin-left: 0.5rem !important; }
          .space-x-4 > * + * { margin-left: 1rem !important; }
          
          /* Typography */
          .text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
          .text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
          .text-base { font-size: 1rem !important; line-height: 1.5rem !important; }
          .text-lg { font-size: 1.125rem !important; line-height: 1.75rem !important; }
          .text-xl { font-size: 1.25rem !important; line-height: 1.75rem !important; }
          .text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
          .text-3xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }
          .text-4xl { font-size: 2.25rem !important; line-height: 2.5rem !important; }
          .font-normal { font-weight: 400 !important; }
          .font-medium { font-weight: 500 !important; }
          .font-semibold { font-weight: 600 !important; }
          .font-bold { font-weight: 700 !important; }
          .text-left { text-align: left !important; }
          .text-center { text-align: center !important; }
          .text-right { text-align: right !important; }
          .leading-none { line-height: 1 !important; }
          .leading-tight { line-height: 1.25 !important; }
          .leading-relaxed { line-height: 1.625 !important; }
          .tracking-tight { letter-spacing: -0.025em !important; }
          .truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
          .whitespace-nowrap { white-space: nowrap !important; }
          .whitespace-pre-wrap { white-space: pre-wrap !important; }
          .break-words { word-wrap: break-word !important; overflow-wrap: break-word !important; }
          .break-all { word-break: break-all !important; }
          .line-clamp-1 { display: -webkit-box !important; -webkit-line-clamp: 1 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }
          .line-clamp-2 { display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }
          
          /* Colors */
          .text-white { color: #fff !important; }
          .text-black { color: #000 !important; }
          .text-gray-100 { color: #f3f4f6 !important; }
          .text-gray-200 { color: #e5e7eb !important; }
          .text-gray-300 { color: #d1d5db !important; }
          .text-gray-400 { color: #9ca3af !important; }
          .text-gray-500 { color: #6b7280 !important; }
          .text-gray-600 { color: #4b5563 !important; }
          .text-gray-700 { color: #374151 !important; }
          .text-gray-800 { color: #1f2937 !important; }
          .text-gray-900 { color: #111827 !important; }
          .text-zinc-100 { color: #f4f4f5 !important; }
          .text-zinc-200 { color: #e4e4e7 !important; }
          .text-zinc-300 { color: #d4d4d8 !important; }
          .text-zinc-400 { color: #a1a1aa !important; }
          .text-zinc-500 { color: #71717a !important; }
          .text-zinc-600 { color: #52525b !important; }
          .text-zinc-700 { color: #3f3f46 !important; }
          .text-zinc-800 { color: #27272a !important; }
          .text-zinc-900 { color: #18181b !important; }
          .text-pink-500 { color: #ec4899 !important; }
          .text-pink-400 { color: #f472b6 !important; }
          .text-red-500 { color: #ef4444 !important; }
          .text-red-400 { color: #f87171 !important; }
          .text-green-500 { color: #22c55e !important; }
          .text-green-400 { color: #4ade80 !important; }
          .text-blue-500 { color: #3b82f6 !important; }
          .text-blue-400 { color: #60a5fa !important; }
          .text-yellow-500 { color: #eab308 !important; }
          .text-muted-foreground { color: #a1a1aa !important; }
          
          .bg-transparent { background-color: transparent !important; }
          .bg-white { background-color: #fff !important; }
          .bg-black { background-color: #000 !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-gray-200 { background-color: #e5e7eb !important; }
          .bg-gray-800 { background-color: #1f2937 !important; }
          .bg-gray-900 { background-color: #111827 !important; }
          .bg-zinc-800 { background-color: #27272a !important; }
          .bg-zinc-900 { background-color: #18181b !important; }
          .bg-zinc-950 { background-color: #09090b !important; }
          .bg-pink-500 { background-color: #ec4899 !important; }
          .bg-pink-600 { background-color: #db2777 !important; }
          .bg-red-500 { background-color: #ef4444 !important; }
          .bg-green-500 { background-color: #22c55e !important; }
          .bg-blue-500 { background-color: #3b82f6 !important; }
          .bg-background { background-color: #000 !important; }
          .bg-card { background-color: #18181b !important; }
          .bg-muted { background-color: #27272a !important; }
          .bg-primary { background-color: #ec4899 !important; }
          .bg-secondary { background-color: #27272a !important; }
          .bg-destructive { background-color: #ef4444 !important; }
          .bg-opacity-50 { --tw-bg-opacity: 0.5 !important; }
          .bg-opacity-80 { --tw-bg-opacity: 0.8 !important; }
          .bg-black\\/50 { background-color: rgba(0, 0, 0, 0.5) !important; }
          .bg-black\\/80 { background-color: rgba(0, 0, 0, 0.8) !important; }
          
          /* Borders */
          .border { border-width: 1px !important; border-style: solid !important; }
          .border-0 { border-width: 0 !important; }
          .border-2 { border-width: 2px !important; }
          .border-t { border-top-width: 1px !important; border-top-style: solid !important; }
          .border-b { border-bottom-width: 1px !important; border-bottom-style: solid !important; }
          .border-l { border-left-width: 1px !important; border-left-style: solid !important; }
          .border-r { border-right-width: 1px !important; border-right-style: solid !important; }
          .border-gray-200 { border-color: #e5e7eb !important; }
          .border-gray-700 { border-color: #374151 !important; }
          .border-gray-800 { border-color: #1f2937 !important; }
          .border-zinc-700 { border-color: #3f3f46 !important; }
          .border-zinc-800 { border-color: #27272a !important; }
          .border-pink-500 { border-color: #ec4899 !important; }
          .border-transparent { border-color: transparent !important; }
          .border-border { border-color: #27272a !important; }
          .rounded { border-radius: 0.25rem !important; }
          .rounded-sm { border-radius: 0.125rem !important; }
          .rounded-md { border-radius: 0.375rem !important; }
          .rounded-lg { border-radius: 0.5rem !important; }
          .rounded-xl { border-radius: 0.75rem !important; }
          .rounded-2xl { border-radius: 1rem !important; }
          .rounded-3xl { border-radius: 1.5rem !important; }
          .rounded-full { border-radius: 9999px !important; }
          .rounded-t-lg { border-top-left-radius: 0.5rem !important; border-top-right-radius: 0.5rem !important; }
          .rounded-b-lg { border-bottom-left-radius: 0.5rem !important; border-bottom-right-radius: 0.5rem !important; }
          
          /* Shadows */
          .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06) !important; }
          .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important; }
          .shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important; }
          .shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important; }
          .shadow-xl { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04) !important; }
          .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; }
          .shadow-none { box-shadow: none !important; }
          
          /* Effects */
          .opacity-0 { opacity: 0 !important; }
          .opacity-25 { opacity: 0.25 !important; }
          .opacity-50 { opacity: 0.5 !important; }
          .opacity-75 { opacity: 0.75 !important; }
          .opacity-100 { opacity: 1 !important; }
          
          /* Overflow */
          .overflow-hidden { overflow: hidden !important; }
          .overflow-auto { overflow: auto !important; }
          .overflow-scroll { overflow: scroll !important; }
          .overflow-visible { overflow: visible !important; }
          .overflow-x-auto { overflow-x: auto !important; }
          .overflow-y-auto { overflow-y: auto !important; }
          .overflow-x-hidden { overflow-x: hidden !important; }
          .overflow-y-hidden { overflow-y: hidden !important; }
          .overflow-y-scroll { overflow-y: scroll !important; }
          
          /* Z-index */
          .z-0 { z-index: 0 !important; }
          .z-10 { z-index: 10 !important; }
          .z-20 { z-index: 20 !important; }
          .z-30 { z-index: 30 !important; }
          .z-40 { z-index: 40 !important; }
          .z-50 { z-index: 50 !important; }
          
          /* Cursor */
          .cursor-pointer { cursor: pointer !important; }
          .cursor-default { cursor: default !important; }
          .cursor-not-allowed { cursor: not-allowed !important; }
          
          /* Pointer events */
          .pointer-events-none { pointer-events: none !important; }
          .pointer-events-auto { pointer-events: auto !important; }
          
          /* Select */
          .select-none { user-select: none !important; }
          .select-text { user-select: text !important; }
          .select-all { user-select: all !important; }
          
          /* Transitions */
          .transition { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter !important; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important; transition-duration: 150ms !important; }
          .transition-all { transition-property: all !important; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important; transition-duration: 150ms !important; }
          .transition-colors { transition-property: color, background-color, border-color, text-decoration-color, fill, stroke !important; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important; transition-duration: 150ms !important; }
          .transition-opacity { transition-property: opacity !important; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important; transition-duration: 150ms !important; }
          .transition-transform { transition-property: transform !important; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1) !important; transition-duration: 150ms !important; }
          .duration-150 { transition-duration: 150ms !important; }
          .duration-200 { transition-duration: 200ms !important; }
          .duration-300 { transition-duration: 300ms !important; }
          .ease-in-out { transition-timing-function: cubic-bezier(0.4, 0, 0.6, 1) !important; }
          
          /* Transforms */
          .transform { transform: translateX(var(--tw-translate-x, 0)) translateY(var(--tw-translate-y, 0)) rotate(var(--tw-rotate, 0)) skewX(var(--tw-skew-x, 0)) skewY(var(--tw-skew-y, 0)) scaleX(var(--tw-scale-x, 1)) scaleY(var(--tw-scale-y, 1)) !important; }
          .scale-95 { transform: scale(0.95) !important; }
          .scale-100 { transform: scale(1) !important; }
          .scale-105 { transform: scale(1.05) !important; }
          .rotate-180 { transform: rotate(180deg) !important; }
          .translate-x-0 { transform: translateX(0) !important; }
          .translate-y-0 { transform: translateY(0) !important; }
          .-translate-x-full { transform: translateX(-100%) !important; }
          .translate-x-full { transform: translateX(100%) !important; }
          .-translate-y-1 { transform: translateY(-0.25rem) !important; }
          .translate-y-1 { transform: translateY(0.25rem) !important; }
          
          /* Animations */
          .animate-spin { animation: spin 1s linear infinite !important; }
          .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; }
          .animate-bounce { animation: bounce 1s infinite !important; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
          @keyframes bounce { 0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); } 50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); } }
          
          /* Focus states */
          .outline-none { outline: 2px solid transparent !important; outline-offset: 2px !important; }
          .focus\\:outline-none:focus { outline: 2px solid transparent !important; outline-offset: 2px !important; }
          .focus\\:ring-2:focus { box-shadow: 0 0 0 2px var(--tw-ring-color, #ec4899) !important; }
          .ring-offset-background { --tw-ring-offset-color: #000 !important; }
          
          /* Hover states */
          .hover\\:bg-zinc-800:hover { background-color: #27272a !important; }
          .hover\\:bg-zinc-700:hover { background-color: #3f3f46 !important; }
          .hover\\:bg-pink-600:hover { background-color: #db2777 !important; }
          .hover\\:bg-gray-800:hover { background-color: #1f2937 !important; }
          .hover\\:text-white:hover { color: #fff !important; }
          .hover\\:text-pink-400:hover { color: #f472b6 !important; }
          .hover\\:opacity-100:hover { opacity: 1 !important; }
          .hover\\:scale-105:hover { transform: scale(1.05) !important; }
          
          /* Active states */
          .active\\:scale-95:active { transform: scale(0.95) !important; }
          
          /* Disabled states */
          .disabled\\:opacity-50:disabled { opacity: 0.5 !important; }
          .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed !important; }
          .disabled\\:pointer-events-none:disabled { pointer-events: none !important; }
          
          /* Group hover */
          .group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }
          .group:hover .group-hover\\:visible { visibility: visible !important; }
          
          /* Responsive - md breakpoint (768px) */
          @media (min-width: 768px) {
            .md\\:flex { display: flex !important; }
            .md\\:hidden { display: none !important; }
            .md\\:block { display: block !important; }
            .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .md\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            .md\\:w-80 { width: 20rem !important; }
            .md\\:w-96 { width: 24rem !important; }
            .md\\:flex-row { flex-direction: row !important; }
            .md\\:text-xl { font-size: 1.25rem !important; }
            .md\\:text-2xl { font-size: 1.5rem !important; }
            .md\\:p-6 { padding: 1.5rem !important; }
            .md\\:px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
          }
          
          /* Responsive - lg breakpoint (1024px) */
          @media (min-width: 1024px) {
            .lg\\:flex { display: flex !important; }
            .lg\\:hidden { display: none !important; }
            .lg\\:grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
            .lg\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
            .lg\\:w-96 { width: 24rem !important; }
            .lg\\:text-3xl { font-size: 1.875rem !important; }
          }
          
          /* Scrollbar styling */
          .scrollbar-thin::-webkit-scrollbar { width: 6px !important; height: 6px !important; }
          .scrollbar-thin::-webkit-scrollbar-track { background: transparent !important; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background-color: #3f3f46 !important; border-radius: 3px !important; }
          .scrollbar-thin::-webkit-scrollbar-thumb:hover { background-color: #52525b !important; }
          
          /* Aspect ratio */
          .aspect-square { aspect-ratio: 1 / 1 !important; }
          .aspect-video { aspect-ratio: 16 / 9 !important; }
          
          /* Object fit */
          .object-cover { object-fit: cover !important; }
          .object-contain { object-fit: contain !important; }
          .object-center { object-position: center !important; }
          
          /* Visibility */
          .visible { visibility: visible !important; }
          .invisible { visibility: hidden !important; }
          
          /* Backdrop */
          .backdrop-blur { backdrop-filter: blur(8px) !important; }
          .backdrop-blur-sm { backdrop-filter: blur(4px) !important; }
          .backdrop-blur-md { backdrop-filter: blur(12px) !important; }
          .backdrop-blur-lg { backdrop-filter: blur(16px) !important; }
          
          /* SVG */
          .fill-current { fill: currentColor !important; }
          .stroke-current { stroke: currentColor !important; }
          
          /* Flex grow/shrink */
          .grow { flex-grow: 1 !important; }
          .grow-0 { flex-grow: 0 !important; }
          .shrink { flex-shrink: 1 !important; }
          .shrink-0 { flex-shrink: 0 !important; }
          
          /* Text decoration */
          .underline { text-decoration: underline !important; }
          .no-underline { text-decoration: none !important; }
          .line-through { text-decoration: line-through !important; }
          
          /* List style */
          .list-none { list-style: none !important; }
          .list-disc { list-style-type: disc !important; }
          
          /* Table */
          .table { display: table !important; }
          .table-auto { table-layout: auto !important; }
          .border-collapse { border-collapse: collapse !important; }
          
          /* sr-only for accessibility */
          .sr-only { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border-width: 0 !important; }
        `,
          }}
        />

        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Calculator" />
        <meta name="theme-color" content="#000000" />

        {/* OneSignal Web Push Notifications Setup */}
        <Script id="onesignal-sdk" src="https://cdn.onesignal.com/sdks/OneSignalSDK.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-black">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
