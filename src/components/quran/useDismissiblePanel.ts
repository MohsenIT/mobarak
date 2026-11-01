'use client'

import { useEffect, useRef } from 'react'

/** Closes a transient panel when its trigger and contents lose pointer focus. */
export function useDismissiblePanel<T extends HTMLElement>(open: boolean, onDismiss: () => void) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (!open) return
    const dismissWhenOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) onDismiss()
    }
    document.addEventListener('pointerdown', dismissWhenOutside, true)
    return () => document.removeEventListener('pointerdown', dismissWhenOutside, true)
  }, [open, onDismiss])

  return ref
}
