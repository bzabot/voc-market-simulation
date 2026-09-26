import { useEffect, useRef, useState } from 'react'

/**
 * Tweens between numeric values so cash / price figures glide
 * instead of jumping. Renders through `format`.
 */
export default function AnimatedNumber({ value, format, duration = 350, className }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (from === value) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = value
      rafRef.current = requestAnimationFrame(() => setDisplay(value))
      return () => cancelAnimationFrame(rafRef.current)
    }
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      // track the live value so a mid-tween retarget glides from here
      const current = Math.round(from + (value - from) * eased)
      fromRef.current = current
      setDisplay(current)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className={`tnum ${className ?? ''}`}>{format(display)}</span>
}
