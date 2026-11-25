/**
 * PWA Install Prompt Component
 *
 * Shows a custom "Add to Home Screen" banner after 10 seconds on mobile.
 * - Persists dismissal in localStorage (re-shows after 7 days)
 * - On iOS: shows manual instructions since beforeinstallprompt isn't supported
 * - Detects if already installed via display-mode: standalone
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import { X, Download, Share } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'healthbridge_pwa_dismissed'
const INSTALL_KEY = 'healthbridge_pwa_installed'
const SHOW_DELAY_MS = 3000
const RE_SHOW_DAYS = 7

function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream
}

function isMobile(): boolean {
  if (typeof window === 'undefined') return false
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

export function PWAInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
   if (process.env.NODE_ENV === 'development') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister()
      })
    })
  }

  if ('caches' in window) {
    window.caches.keys().then((keys) => {
      keys.forEach((key) => {
        window.caches.delete(key)
      })
    })
  }

  return
}

    // Don't show if already installed
    if (isStandalone()) {
      // Show installed confirmation once
      const wasInstalled = localStorage.getItem(INSTALL_KEY)
      if (!wasInstalled) {
        localStorage.setItem(INSTALL_KEY, 'true')
      }
      return
    }

    // Check if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY)
    if (dismissedAt) {
      const dismissedDate = new Date(dismissedAt)
      const daysSinceDismiss = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceDismiss < RE_SHOW_DAYS) return
    }

    // Listen for the beforeinstallprompt event (Chrome/Android)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Show banner after delay
    const timer = setTimeout(() => {
      setShowBanner(true)
    }, SHOW_DELAY_MS)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      clearTimeout(timer)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        localStorage.setItem(INSTALL_KEY, 'true')
        setShowBanner(false)
      }
      setDeferredPrompt(null)
    } else if (isIOS()) {
      setShowIOSInstructions(true)
    }
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setShowBanner(false)
    setShowIOSInstructions(false)
  }, [])

  if (!showBanner) return null

  return (
    <div className="fixed inset-x-4 bottom-20 z-[100] animate-slide-up">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xl">
        {showIOSInstructions ? (
          // iOS Manual Instructions
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-bold text-text">Install HealthBridge</h3>
              <button
                onClick={handleDismiss}
                className="rounded-full p-1 text-muted hover:bg-bg"
                aria-label="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-xs text-muted">
              <p className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
                Tap the <Share size={14} className="inline text-primary" /> Share button in Safari
              </p>
              <p className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
                Scroll down and tap &quot;Add to Home Screen&quot;
              </p>
              <p className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
                Tap &quot;Add&quot; to confirm
              </p>
            </div>
          </div>
        ) : (
          // Standard Install Banner
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Download size={20} className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">Install HealthBridge</p>
              <p className="text-xs text-muted">Works like a native app, no App Store needed</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleDismiss}
                className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-bg"
              >
                Later
              </button>
              <button
                onClick={handleInstall}
                className="btn-primary !min-h-[36px] !px-3 !py-1.5 text-xs"
              >
                Install
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
