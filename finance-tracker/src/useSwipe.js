import { useRef } from 'react'

// A small horizontal swipe detector. Attach the returned handlers to
// any element's onTouchStart/onTouchMove/onTouchEnd. Calls onSwipeLeft
// or onSwipeRight once a horizontal drag clears the threshold, and
// ignores drags that are more vertical than horizontal (so it doesn't
// fight with normal scrolling).
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60 }) {
  const start = useRef(null)

  function onTouchStart(e) {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
  }

  function onTouchEnd(e) {
    if (!start.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.current.x
    const dy = t.clientY - start.current.y
    start.current = null
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return
    if (dx < 0) onSwipeLeft?.()
    else onSwipeRight?.()
  }

  return { onTouchStart, onTouchEnd }
}

// Detects a swipe starting from within `edgeWidth` px of the left
// screen edge specifically, for a "swipe from the edge to go back"
// gesture, distinct from swipes that can start anywhere.
export function useEdgeSwipeBack(onBack, edgeWidth = 24, threshold = 70) {
  const start = useRef(null)

  function onTouchStart(e) {
    const t = e.touches[0]
    if (t.clientX <= edgeWidth) {
      start.current = { x: t.clientX, y: t.clientY }
    } else {
      start.current = null
    }
  }

  function onTouchEnd(e) {
    if (!start.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.current.x
    const dy = t.clientY - start.current.y
    start.current = null
    if (dx > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
      onBack?.()
    }
  }

  return { onTouchStart, onTouchEnd }
}
