import AnimatedNumber from './AnimatedNumber'
import { VocMark } from './icons'
import { money, TOTAL_SHARES } from '../format'
import { useOnScreen } from '../useOnScreen'

const PHASE_STYLE = {
  ipo: 'border-line bg-raised text-dim',
  trade: 'border-sea/60 bg-sea/10 text-sea',
  voyage: 'border-voyage/60 bg-voyage/10 text-voyage',
}

const PHASE_LABEL = { ipo: 'Initial Offering', trade: 'Open Trading', voyage: 'The Voyage' }

export default function Masthead({ frame, prevFrame, replaying, viewingHistory }) {
  const price = frame?.last_price_cents ?? null
  const prev = prevFrame?.last_price_cents ?? null
  const delta = price != null && prev != null ? price - prev : 0
  const voyage = frame?.voyage_shown
  const phase = frame?.phase ?? 'ipo'
  const [setSea, seaOn] = useOnScreen()

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line bg-surface/60 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <VocMark className="size-10 text-accent" />
        <div className="leading-tight">
          <h1 className="title text-text">Vereenigde Oostindische Compagnie</h1>
          <p className="kicker text-mute">Amsterdam &middot; Anno 1602</p>
        </div>
      </div>

      <span className={`kicker rounded-full border px-3 py-1 ${PHASE_STYLE[phase]}`}>
        {PHASE_LABEL[phase]}
        {frame && phase === 'trade' ? ` \u00b7 ${frame.header}` : ''}
      </span>

      <div className="ml-auto flex items-center gap-7">
        <Stat label="Last price">
          {price == null ? (
            <Placeholder />
          ) : (
            <span className="flex items-baseline gap-2">
              <AnimatedNumber value={price} format={money} className="figure text-accent" />
              {delta !== 0 && (
                <span className={`text-[13px] font-medium ${delta > 0 ? 'text-gain' : 'text-loss'}`}>
                  {delta > 0 ? '\u25b2' : '\u25bc'} {money(Math.abs(delta))}
                </span>
              )}
            </span>
          )}
        </Stat>

        <Stat label="Implied value">
          {price == null ? (
            <Placeholder />
          ) : (
            <AnimatedNumber
              value={price * TOTAL_SHARES}
              format={money}
              className="figure text-text"
            />
          )}
        </Stat>

        <Stat label="Voyage">
          {voyage ? (
            <span className="text-[13px] font-medium text-voyage capitalize">{voyage}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-[13px] text-sea">
              <span
                ref={setSea}
                className={`pulse-dot inline-block size-1.5 rounded-full bg-sea ${seaOn ? 'is-on' : ''}`}
              />
              at sea
            </span>
          )}
        </Stat>

        {replaying && (
          <span className="kicker rounded-full border border-line bg-raised px-3 py-1 text-dim">
            Replay
          </span>
        )}
        {viewingHistory && (
          <span className="kicker rounded-full border border-line bg-raised px-3 py-1 text-dim">
            History
          </span>
        )}
      </div>
    </header>
  )
}

function Stat({ label, children }) {
  return (
    <div className="leading-tight">
      <div className="kicker mb-0.5 text-mute">{label}</div>
      {children}
    </div>
  )
}

function Placeholder() {
  return <span className="figure text-mute">&mdash;</span>
}
