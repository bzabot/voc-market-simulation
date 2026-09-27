import { useCallback, useEffect, useRef, useState } from 'react'
import { investorColor } from '../colors'
import {
  IPO_PRICE_CENTS,
  money,
  OUTCOMES,
  V_MAX_CENTS,
  V_MIN_CENTS,
} from '../format'
import { useOnScreen } from '../useOnScreen'

const HEIGHT = 300
const PAD = { top: 22, right: 36, bottom: 36, left: 72 }

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return undefined
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

export default function PriceChart({ history, upto, frame }) {
  const [wrapRef, width] = useWidth()
  const [setSeen, onScreen] = useOnScreen()
  const setWrap = useCallback((node) => {
    wrapRef.current = node
    setSeen(node)
  }, [setSeen, wrapRef])
  const frames = history.slice(0, upto)
  const n = frames.length

  const innerW = Math.max(10, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (cents) =>
    PAD.top + (1 - (cents - V_MIN_CENTS) / (V_MAX_CENTS - V_MIN_CENTS)) * innerH

  const pts = frames.map((f, i) => [x(i), y(f.last_price_cents)])
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')

  const ipoEnd = frames.findIndex((f) => f.phase !== 'ipo')
  const ipoWidth = ipoEnd > 0 ? x(ipoEnd - 1) - PAD.left : 0

  const last = frames[frames.length - 1]
  const beliefs = (frame?.investors ?? []).filter((i) => i.v_cents != null)
  const figure = { fontSize: 12, fontVariantNumeric: 'tabular-nums lining-nums' }

  return (
    <section className="panel animate-fade-up">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="panel-title">Price discovery</h2>
        <span className="text-mute">
          {n} frame{n === 1 ? '' : 's'} &middot; dashed lines: voyage outcomes &middot; right-edge ticks: investor
          beliefs
        </span>
      </div>

      <div
        ref={setWrap}
        className="w-full"
      >
        <svg width={width} height={HEIGHT} className="block">
          {ipoWidth > 0 && (
            <rect x={PAD.left} y={PAD.top} width={ipoWidth} height={innerH} fill="var(--color-line)" opacity="0.35" />
          )}

          {OUTCOMES.map((o) => (
            <g key={o.key}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(o.cents)}
                y2={y(o.cents)}
                stroke="var(--color-line)"
                strokeDasharray="3 5"
              />
              <text x={PAD.left - 8} y={y(o.cents) + 4} textAnchor="end" fill="var(--color-mute)" style={figure}>
                {money(o.cents)}
              </text>
              <text
                x={width - PAD.right - 4}
                y={y(o.cents) - 6}
                textAnchor="end"
                fill="var(--color-mute)"
                style={{ ...figure, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {o.key}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(IPO_PRICE_CENTS)}
            y2={y(IPO_PRICE_CENTS)}
            stroke="var(--color-mute)"
            strokeWidth="1.2"
          />
          <text
            x={PAD.left - 8}
            y={y(IPO_PRICE_CENTS) + 4}
            textAnchor="end"
            fill="var(--color-dim)"
            style={{ ...figure, fontWeight: 600 }}
          >
            {money(IPO_PRICE_CENTS)}
          </text>

          {beliefs.map((inv) => (
            <line
              key={inv.name}
              x1={width - PAD.right + 2}
              x2={width - PAD.right + 12}
              y1={y(inv.v_cents)}
              y2={y(inv.v_cents)}
              stroke={investorColor(inv.name)}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.85"
            >
              <title>
                {inv.name} believes {money(inv.v_cents)}
              </title>
            </line>
          ))}

          {line && (
            <path d={line} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {last && (
            <g>
              <circle
                cx={pts[pts.length - 1][0]}
                cy={pts[pts.length - 1][1]}
                r="4"
                fill="var(--color-accent)"
                className={`pulse-dot ${onScreen ? 'is-on' : ''}`}
              />
              <text
                x={Math.min(pts[pts.length - 1][0], width - PAD.right - 64)}
                y={pts[pts.length - 1][1] - 10}
                fill="var(--color-accent)"
                style={{ ...figure, fontWeight: 600 }}
              >
                {money(last.last_price_cents)}
              </text>
            </g>
          )}

          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={HEIGHT - PAD.bottom}
            y2={HEIGHT - PAD.bottom}
            stroke="var(--color-line)"
          />
          <text x={PAD.left} y={HEIGHT - 10} fill="var(--color-mute)" style={{ ...figure, letterSpacing: '0.05em' }}>
            FIRST FRAME
          </text>
          {n > 1 && (
            <text
              x={width - PAD.right}
              y={HEIGHT - 10}
              textAnchor="end"
              fill="var(--color-mute)"
              style={{ ...figure, letterSpacing: '0.05em' }}
            >
              FRAME {n}
            </text>
          )}
        </svg>
      </div>
    </section>
  )
}
