import { useEffect, useRef, useState } from 'react'
import { investorColor } from '../colors'
import {
  IPO_PRICE_CENTS,
  money,
  OUTCOMES,
  V_MAX_CENTS,
  V_MIN_CENTS,
} from '../format'

const HEIGHT = 300
const PAD = { top: 18, right: 30, bottom: 26, left: 56 }

function useWidth() {
  const ref = useRef(null)
  const [width, setWidth] = useState(800)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

/**
 * Price history with the four possible voyage outcomes as reference
 * lines, the IPO price, and each investor's current belief as a tick
 * on the right margin — the "belief cloud" the price is pulled toward.
 */
export default function PriceChart({ history, upto, frame }) {
  const [wrapRef, width] = useWidth()
  const frames = history.slice(0, upto)
  const n = frames.length

  const innerW = Math.max(10, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW)
  const y = (cents) =>
    PAD.top + (1 - (cents - V_MIN_CENTS) / (V_MAX_CENTS - V_MIN_CENTS)) * innerH

  const pts = frames.map((f, i) => [x(i), y(f.last_price_cents)])
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area =
    pts.length > 1
      ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${y(V_MIN_CENTS)} L${pts[0][0].toFixed(1)},${y(V_MIN_CENTS)} Z`
      : null

  // IPO frames occupy the opening stretch of the run — shade that region.
  const ipoEnd = frames.findIndex((f) => f.phase !== 'ipo')
  const ipoWidth = ipoEnd > 0 ? x(ipoEnd - 1) - PAD.left : 0

  const last = frames[frames.length - 1]
  const beliefs = (frame?.investors ?? []).filter((i) => i.v_cents != null)

  return (
    <section className="panel animate-fade-up p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="panel-title">Price discovery</h2>
        <span className="text-[11px] text-parch-600">
          {n} frame{n === 1 ? '' : 's'} &middot; dashed lines: voyage outcomes &middot; right-edge ticks: investor
          beliefs
        </span>
      </div>

      <div ref={wrapRef} className="w-full">
        <svg width={width} height={HEIGHT} className="block">
          <defs>
            <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4a24e" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#d4a24e" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* IPO region */}
          {ipoWidth > 0 && (
            <rect x={PAD.left} y={PAD.top} width={ipoWidth} height={innerH} fill="#d4a24e" opacity="0.05" />
          )}

          {/* outcome reference lines */}
          {OUTCOMES.map((o) => (
            <g key={o.key}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(o.cents)}
                y2={y(o.cents)}
                stroke="#3d3423"
                strokeDasharray="3 5"
              />
              <text x={PAD.left - 8} y={y(o.cents) + 3.5} textAnchor="end" className="fill-parch-500" fontSize="10">
                {money(o.cents)}
              </text>
              <text
                x={width - PAD.right - 4}
                y={y(o.cents) - 4}
                textAnchor="end"
                className="fill-parch-600"
                fontSize="9"
                style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                {o.key}
              </text>
            </g>
          ))}

          {/* IPO price line */}
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(IPO_PRICE_CENTS)}
            y2={y(IPO_PRICE_CENTS)}
            stroke="#544931"
            strokeWidth="1.2"
          />
          <text x={PAD.left - 8} y={y(IPO_PRICE_CENTS) + 3.5} textAnchor="end" className="fill-parch-300" fontSize="10" fontWeight="600">
            {money(IPO_PRICE_CENTS)}
          </text>

          {/* belief cloud on the right margin */}
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

          {/* price area + line */}
          {area && <path d={area} fill="url(#price-fill)" />}
          {line && (
            <path d={line} fill="none" stroke="#e0b25e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* current price dot */}
          {last && (
            <g>
              <circle
                cx={pts[pts.length - 1][0]}
                cy={pts[pts.length - 1][1]}
                r="4"
                fill="#e0b25e"
                className="animate-pulse-dot"
              />
              <text
                x={Math.min(pts[pts.length - 1][0], width - PAD.right - 52)}
                y={pts[pts.length - 1][1] - 10}
                className="fill-gold-300"
                fontSize="12"
                fontWeight="600"
              >
                {money(last.last_price_cents)}
              </text>
            </g>
          )}

          {/* x axis */}
          <line x1={PAD.left} x2={width - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} stroke="#2c2519" />
          <text x={PAD.left} y={HEIGHT - 8} className="fill-parch-600" fontSize="9" style={{ letterSpacing: '0.1em' }}>
            FIRST FRAME
          </text>
          {n > 1 && (
            <text x={width - PAD.right} y={HEIGHT - 8} textAnchor="end" className="fill-parch-600" fontSize="9" style={{ letterSpacing: '0.1em' }}>
              FRAME {n}
            </text>
          )}
        </svg>
      </div>
    </section>
  )
}
