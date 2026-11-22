'use client'

import { useLayoutEffect, useRef, type RefObject } from 'react'

/** Measures the actual text area of an input, including space reserved for controls. */
export default function ResponsivePlaceholder({ field, text, shorter, onFit }: {
  field: RefObject<HTMLInputElement | null>
  text: string
  shorter?: readonly string[]
  onFit: (value: string) => void
}) {
  const measure = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const input = field.current
    const sample = measure.current
    if (!input || !sample) return

    const words = text.trim().split(/\s+/)
    const alternatives = shorter ?? words.slice(1).map((_, index) => words.slice(0, index + 1).join(' ')).reverse()
    const candidates = text ? [text, ...alternatives.map(value => `${value}…`), '…'] : ['']
    let active = true

    const fit = () => {
      if (!active) return
      const box = getComputedStyle(input)
      const font = getComputedStyle(input, '::placeholder')
      Object.assign(sample.style, {
        fontFamily: font.fontFamily, fontSize: font.fontSize, fontWeight: font.fontWeight,
        fontStyle: font.fontStyle, letterSpacing: font.letterSpacing, wordSpacing: font.wordSpacing,
        textTransform: font.textTransform, direction: box.direction,
      })
      const available = input.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)
      const value = candidates.find(candidate => {
        sample.textContent = candidate
        return sample.getBoundingClientRect().width <= available
      }) ?? ''
      sample.textContent = value
      onFit(value)
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(input)
    window.addEventListener('resize', fit)
    void document.fonts.ready.then(fit)
    document.fonts.addEventListener('loadingdone', fit)
    return () => {
      active = false
      observer.disconnect()
      window.removeEventListener('resize', fit)
      document.fonts.removeEventListener('loadingdone', fit)
    }
  }, [field, text, shorter, onFit])

  return <span className="responsive-placeholder-ruler" aria-hidden="true"><span ref={measure} /></span>
}
