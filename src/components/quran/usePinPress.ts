'use client'

import { useEffect, useRef, type MouseEvent, type PointerEvent, type KeyboardEvent } from 'react'

export function usePinPress() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const suppressClick = useRef(false)

  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    origin.current = null
  }

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  return (onOpen: () => void, onPin: () => void) => ({
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (!event.isPrimary) return
      cancel()
      suppressClick.current = false
      if (event.button !== 0) return
      origin.current = { x: event.clientX, y: event.clientY }
      timer.current = setTimeout(() => {
        suppressClick.current = true
        cancel()
        onPin()
      }, 550)
    },
    onPointerMove(event: PointerEvent<HTMLButtonElement>) {
      if (!event.isPrimary || !origin.current) return
      if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) {
        suppressClick.current = true
        cancel()
      }
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onContextMenu(event: MouseEvent<HTMLButtonElement>) {
      event.preventDefault()
      if (suppressClick.current) return
      cancel()
      suppressClick.current = true
      onPin()
    },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
      event.preventDefault()
      cancel()
      suppressClick.current = false
      if (!event.repeat) onPin()
    },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      const suppressed = suppressClick.current && event.detail !== 0
      suppressClick.current = false
      if (!suppressed) onOpen()
    },
  })
}
