import { useRef, useState } from 'react'
import { AnchorIcon, ShipIcon } from './icons'
import { tradeTick, TRADE_TICKS } from '../format'

function journey(frame) {
  const phase = frame?.phase ?? 'ipo'
  const tick = tradeTick(frame?.header) ?? 0
  if (phase === 'ipo') return 0
  if (phase === 'voyage') return 1
  return Math.min(1, tick / TRADE_TICKS)
}

function indexFor(frames, ratio) {
  let best = 0
  let bestDist = Infinity
  frames.forEach((frame, i) => {
    const dist = Math.abs(journey(frame) - ratio)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}

export default function PhaseTimeline({ frame, frames = [], onScrub }) {
  const barRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const progress = journey(frame)
  const canScrub = frames.length > 1 && onScrub
  const move = dragging ? '' : 'phase-move'

  const scrubFrom = (event) => {
    const rect = barRef.current.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    onScrub(indexFor(frames, ratio))
  }

  return (
    <div className="border-b border-line bg-surface/40 px-5 py-2.5">
      <div className="relative flex items-center gap-3">
        <PhaseNode
          active={frame?.phase === 'ipo' || !frame}
          reached
          icon={<AnchorIcon className="size-3.5" />}
          label="IPO"
          tone="text-text"
        />

        <div className="relative h-8 min-w-0 flex-1 overflow-hidden">
          <div ref={barRef} className="absolute inset-x-4 bottom-1 h-1 rounded-full bg-line">
            <div
              className={`${move} h-full origin-left rounded-full bg-accent`}
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          <div
            className={`${move} pointer-events-none absolute inset-x-4 bottom-1`}
            style={{ transform: `translateX(${progress * 100}%)` }}
          >
            <ShipIcon className="absolute bottom-1 left-0 h-5 w-7 -translate-x-1/2 text-text" />
          </div>
          {canScrub && (
            <div
              role="slider"
              aria-label="Scrub the voyage"
              aria-valuemin={0}
              aria-valuemax={frames.length - 1}
              aria-valuenow={indexFor(frames, progress)}
              className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                setDragging(true)
                scrubFrom(event)
              }}
              onPointerMove={(event) => {
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
                scrubFrom(event)
              }}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
            />
          )}
        </div>

        <PhaseNode
          active={frame?.phase === 'voyage'}
          reached={frame?.phase === 'voyage'}
          icon={<ShipIcon className="size-4" />}
          label={frame?.phase === 'voyage' ? 'Voyage returns' : 'Voyage'}
          tone="text-voyage"
        />
      </div>
    </div>
  )
}

function PhaseNode({ active, reached, icon, label, tone }) {
  const color = active ? tone : reached ? 'text-dim' : 'text-mute'
  return (
    <span className={`kicker flex items-center gap-1.5 ${color}`}>
      {icon}
      {label}
    </span>
  )
}
