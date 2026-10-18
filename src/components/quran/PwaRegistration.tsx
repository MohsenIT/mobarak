'use client'
import { useEffect } from 'react'

export default function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
      // Reading the site remains available if the browser disables installation support.
    })
  }, [])
  return null
}
