import AnimatedNumber from './AnimatedNumber'
import { VocMark } from './icons'
import { money, TOTAL_SHARES } from '../format'

const PHASE_STYLE = {
  ipo: 'border-gold-600/60 bg-gold-500/10 text-gold-300',
  trade: 'border-sea-500/60 bg-sea-500/10 text-sea-300',
  voyage: 'border-voc-500/60 bg-voc-500/10 text-voc-400',
}

const PHASE_LABEL = { ipo: 'Initial Offering', trade: 'Open Trading', voyage: 'The Voyage' }

export default function Masthead({ frame, prevFrame, replaying, viewingHistory }) {
  const price = frame?.last_price_cents ?? null
  const prev = prevFrame?.last_price_cents ?? null
  const delta = price != null && prev != null ? price - prev : 0
  const voyage = frame?.voyage_shown
  const phase = frame?.phase ?? 'ipo'

  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-ink-700 bg-ink-900/60 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <VocMark className="h-10 w-10 text-gold-500" />
        <div className="leading-tight">
          <h1 className="font-display text-lg font-bold tracking-wide text-parch-100">
            Vereenigde Oostindische Compagnie
          </h1>
          <p className="text-[11px] tracking-[0.22em] text-parch-500 uppercase">
            Amsterdam &middot; Anno 1602
          </p>
        </div>
      </div>

      <span
        className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase ${PHASE_STYLE[phase]}`}
      >
        {PHASE_LABEL[phase]}
        {frame && phase === 'trade' ? ` \u00b7 ${frame.header}` : ''}
      </span>

      <div className="ml-auto flex items-center gap-7">
        <Stat label="Last price">
          {price == null ? (
            <Placeholder />
          ) : (
            <span className="flex items-baseline gap-2">
              <AnimatedNumber
                value={price}
                format={money}
                className="text-xl font-semibold text-gold-300"
              />
              {delta !== 0 && (
                <span
                  className={`text-xs font-semibold ${delta > 0 ? 'text-gain-400' : 'text-loss-400'}`}
                >
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
              className="text-xl font-semibold text-parch-100"
            />
          )}
        </Stat>

        <Stat label="Voyage">
          {voyage ? (
            <span className="text-sm font-semibold text-voc-400 capitalize">{voyage}</span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-sea-300">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sea-400" />
              at sea
            </span>
          )}
        </Stat>

        {replaying && (
          <span className="rounded-full border border-parch-600/50 bg-parch-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-parch-300 uppercase">
            Replay
          </span>
        )}
        {viewingHistory && (
          <span className="rounded-full border border-parch-600/50 bg-parch-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-parch-300 uppercase">
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
      <div className="mb-0.5 text-[10px] tracking-[0.18em] text-parch-500 uppercase">{label}</div>
      {children}
    </div>
  )
}

function Placeholder() {
  return <span className="text-xl text-parch-600">&mdash;</span>
}
