import { useEffect, useState } from 'react'

export function useOnScreen() {
  const [node, setNode] = useState(null)
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (!node) return undefined
    const watcher = new IntersectionObserver(([entry]) => setOn(entry.isIntersecting))
    watcher.observe(node)
    return () => watcher.disconnect()
  }, [node])

  return [setNode, on]
}
