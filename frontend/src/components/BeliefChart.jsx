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

const HEIGHT = 440
const PAD = { top: 28, right: 48, bottom: 44, left: 80 }
const PAD_CENTS = 600
const WINDOW = 5

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

function valueRange(frames) {
  let lo = Infinity
  let hi = -Infinity
  for (const frame of frames) {
    lo = Math.min(lo, frame.last_price_cents)
    hi = Math.max(hi, frame.last_price_cents)
    for (const inv of frame.investors) {
      if (inv.v_cents == null) continue
      lo = Math.min(lo, inv.v_cents)
      hi = Math.max(hi, inv.v_cents)
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return { lo: V_MIN_CENTS, hi: V_MAX_CENTS }
  }
  lo = Math.max(V_MIN_CENTS, lo - PAD_CENTS)
  hi = Math.min(V_MAX_CENTS, hi + PAD_CENTS)
  if (hi - lo < 1_500) {
    const mid = (lo + hi) / 2
    lo = Math.max(V_MIN_CENTS, mid - 750)
    hi = Math.min(V_MAX_CENTS, mid + 750)
  }
  return { lo, hi }
}

function turnLabel(frame) {
  const match = String(frame.header ?? '').match(/^(\d+)\//)
  return match ? Number(match[1]) : null
}

export default function BeliefChart({ history, upto }) {
  const [wrapRef, width] = useWidth()
  const [setSeen, onScreen] = useOnScreen()
  const [hover, setHover] = useState(null)
  const setWrap = useCallback((node) => {
    wrapRef.current = node
    setSeen(node)
  }, [setSeen, wrapRef])

  const allTrade = history.slice(0, upto).filter((f) => f.phase === 'trade')
  const tradeFrames = allTrade.slice(-WINDOW)
  const { lo, hi } = valueRange(tradeFrames)

  const innerW = Math.max(10, width - PAD.left - PAD.right)
  const innerH = HEIGHT - PAD.top - PAD.bottom
  const x = (i) => PAD.left + (tradeFrames.length <= 1 ? innerW / 2 : (i / (tradeFrames.length - 1)) * innerW)
  const y = (cents) => PAD.top + (1 - (cents - lo) / (hi - lo)) * innerH

  const plaquePts = tradeFrames.map((f, i) => [x(i), y(f.last_price_cents)])
  const plaqueLine = plaquePts
    .map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`)
    .join(' ')

  const names = tradeFrames[0]?.investors.filter((inv) => !inv.is_human).map((inv) => inv.name) ?? []
  const figure = { fontSize: 13, fontVariantNumeric: 'tabular-nums lining-nums' }
  const last = tradeFrames[tradeFrames.length - 1]
  const guides = [
    ...OUTCOMES.map((o) => ({ key: o.key, cents: o.cents, label: o.key, dashed: true })),
    { key: 'ipo', cents: IPO_PRICE_CENTS, label: 'ipo', dashed: false },
  ].filter((g) => g.cents >= lo && g.cents <= hi)

  return (
    <section className="panel animate-fade-up">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="panel-title">Beliefs and the plaque</h2>
        <span className="text-mute">
          Last {WINDOW} turns · dots: beliefs · gold line: plaque · hover a dot for the wallet
        </span>
      </div>

      <div ref={setWrap} className="relative w-full">
        <svg width={width} height={HEIGHT} className="block">
          {guides.map((g) => (
            <g key={g.key}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(g.cents)}
                y2={y(g.cents)}
                stroke="var(--color-line)"
                strokeDasharray={g.dashed ? '3 5' : undefined}
                strokeWidth={g.dashed ? 1 : 1.2}
              />
              <text x={PAD.left - 10} y={y(g.cents) + 4} textAnchor="end" fill="var(--color-mute)" style={figure}>
                {money(g.cents)}
              </text>
              <text
                x={width - PAD.right - 4}
                y={y(g.cents) - 8}
                textAnchor="end"
                fill="var(--color-mute)"
                style={{ ...figure, textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                {g.label}
              </text>
            </g>
          ))}

          {names.map((name) =>
            tradeFrames.map((frame, i) => {
              const inv = frame.investors.find((row) => row.name === name)
              if (!inv) return null
              const active = hover?.name === name && hover?.index === i
              return (
                <g key={`${name}-${i}`}>
                  <circle
                    cx={x(i)}
                    cy={y(inv.v_cents)}
                    r="14"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={(ev) => {
                      const box = ev.currentTarget.ownerSVGElement?.getBoundingClientRect()
                      setHover({
                        name,
                        index: i,
                        turn: turnLabel(frame) ?? frame.header,
                        shares: inv.shares,
                        cash_cents: inv.cash_cents,
                        v_cents: inv.v_cents,
                        x: ev.clientX - (box?.left ?? 0),
                        y: ev.clientY - (box?.top ?? 0),
                      })
                    }}
                    onMouseLeave={() => setHover(null)}
                  />
                  <circle
                    cx={x(i)}
                    cy={y(inv.v_cents)}
                    r={active ? 6 : 4.5}
                    fill={investorColor(name)}
                    opacity={active ? 1 : 0.85}
                    pointerEvents="none"
                  />
                </g>
              )
            }),
          )}

          {plaqueLine && (
            <path
              d={plaqueLine}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}

          {last && plaquePts.length > 0 && (
            <g pointerEvents="none">
              <circle
                cx={plaquePts[plaquePts.length - 1][0]}
                cy={plaquePts[plaquePts.length - 1][1]}
                r="5"
                fill="var(--color-accent)"
                className={`pulse-dot ${onScreen ? 'is-on' : ''}`}
              />
              <text
                x={Math.min(plaquePts[plaquePts.length - 1][0], width - PAD.right - 72)}
                y={plaquePts[plaquePts.length - 1][1] - 12}
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
          {tradeFrames.map((frame, i) => {
            const turn = turnLabel(frame)
            return (
              <text
                key={`axis-${i}`}
                x={x(i)}
                y={HEIGHT - 14}
                textAnchor="middle"
                fill="var(--color-mute)"
                style={{ ...figure, letterSpacing: '0.04em' }}
              >
                {turn == null ? frame.header : `TURN ${turn}`}
              </text>
            )
          })}
          {tradeFrames.length === 0 && (
            <text
              x={PAD.left + innerW / 2}
              y={PAD.top + innerH / 2}
              textAnchor="middle"
              fill="var(--color-mute)"
              style={figure}
            >
              Beliefs appear once trading opens
            </text>
          )}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 min-w-[11rem] rounded-lg border border-line bg-surface px-3 py-2.5 text-[13px] leading-relaxed text-dim shadow-lg"
            style={{
              left: Math.min(hover.x + 14, Math.max(8, width - 200)),
              top: Math.max(8, hover.y - 88),
            }}
          >
            <p className="font-semibold" style={{ color: investorColor(hover.name) }}>
              {hover.name}
            </p>
            <p className="text-mute">Turn {hover.turn}</p>
            <p>Belief / share {money(hover.v_cents)}</p>
            <p>{hover.shares} shares</p>
            <p>Cash {money(hover.cash_cents)}</p>
          </div>
        )}
      </div>
    </section>
  )
}
