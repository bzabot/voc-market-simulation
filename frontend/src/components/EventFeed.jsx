import { useEffect, useRef } from 'react'
import { investorColor } from '../colors'
import { money } from '../format'
import TradeAttempt from './TradeAttempt'

export const KIND_STYLE = {
  ipo_fill: { label: 'IPO', cls: 'border-gold-600/50 bg-gold-500/10 text-gold-300' },
  ipo_closed: { label: 'IPO', cls: 'border-ink-600 bg-ink-800 text-parch-400' },
  offer: { label: 'Offer', cls: 'border-loss-500/50 bg-loss-500/10 text-loss-300' },
  bid: { label: 'Bid', cls: 'border-sea-500/50 bg-sea-500/10 text-sea-300' },
  trade: { label: 'Trade', cls: 'border-gain-500/50 bg-gain-500/10 text-gain-300' },
  nobody_takes: { label: 'Miss', cls: 'border-ink-600 bg-ink-800 text-parch-500' },
  no_eligible: { label: 'Miss', cls: 'border-ink-600 bg-ink-800 text-parch-500' },
  voyage: { label: 'Voyage', cls: 'border-voc-500/60 bg-voc-500/10 text-voc-400' },
  payout: { label: 'Payout', cls: 'border-gold-600/50 bg-gold-500/10 text-gold-300' },
  treasury_payout: { label: 'Payout', cls: 'border-gold-600/50 bg-gold-500/10 text-gold-300' },
}

function Name({ children }) {
  return (
    <span className="font-semibold" style={{ color: investorColor(children) }}>
      {children}
    </span>
  )
}

function Money({ cents }) {
  return <span className="tnum font-semibold text-parch-100">{money(cents)}</span>
}

export function EventBody({ e }) {
  switch (e.kind) {
    case 'ipo_fill':
      return <><Name>{e.name}</Name> buys {e.size} @ <Money cents={e.price_cents} /> IPO</>
    case 'ipo_closed':
      return <>The offering is closed</>
    case 'offer':
      return <><Name>{e.name}</Name> offers {e.size} @ <Money cents={e.price_cents} /></>
    case 'bid':
      return <><Name>{e.name}</Name> bids {e.size} @ <Money cents={e.price_cents} /></>
    case 'trade':
      return (
        <>
          <Name>{e.buyer}</Name> buys {e.quantity} from <Name>{e.seller}</Name> @{' '}
          <Money cents={e.price_cents} />
        </>
      )
    case 'nobody_takes':
      if (e.side === 'sell') return <>No buyer accepts the offer</>
      if (e.side === 'buy') return <>No seller accepts the bid</>
      return <>No trader accepts the order</>
    case 'no_eligible':
      return <>No eligible trader</>
    case 'voyage':
      return <>The voyage returns: <span className="font-semibold capitalize">{e.name}</span> (<Money cents={e.price_cents} />/share)</>
    case 'payout':
      return <><Name>{e.name}</Name> receives {e.size} shares &rarr; <Money cents={e.price_cents} /></>
    case 'treasury_payout':
      return <>Treasury receives {e.size} shares &rarr; <Money cents={e.price_cents} /></>
    default:
      return <>{e.kind}</>
  }
}

/** The market ticker: every event of the run, newest at the bottom. */
export default function EventFeed({ events, freshCount }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [events.length])

  return (
    <section
      className="panel animate-fade-up flex max-h-[28rem] min-h-0 flex-col self-start p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]"
      style={{ animationDelay: '120ms' }}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="panel-title">Market ticker</h2>
        <span className="text-[11px] text-parch-600">{events.length} events</span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {events.length === 0 && (
          <p className="py-8 text-center text-sm text-parch-600">(waiting for the opening bell)</p>
        )}
        {groupTradeAttempts(events).map(({ e, order, result, index, lastIndex }) => {
          if (order) {
            return (
              <TradeAttempt
                key={`trade-${order.tick}-${index}`}
                order={order}
                result={result}
                number={index + 1}
                fresh={lastIndex >= events.length - freshCount}
              />
            )
          }
          const style = KIND_STYLE[e.kind] ?? KIND_STYLE.nobody_takes
          const fresh = index >= events.length - freshCount
          return (
            <div
              key={index}
              className={`flex items-baseline gap-2 rounded-md px-2 py-1 text-[12.5px] leading-snug text-parch-300 ${
                fresh ? 'animate-fade-up bg-ink-800/70' : ''
              }`}
            >
              <span className="tnum w-7 shrink-0 text-right text-[10px] text-parch-600">{index + 1}</span>
              <span
                className={`shrink-0 rounded border px-1.5 py-px text-[9px] font-semibold tracking-[0.1em] uppercase ${style.cls}`}
              >
                {style.label}
              </span>
              <span className="min-w-0"><EventBody e={e} /></span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function groupTradeAttempts(events) {
  const attempts = new Map()
  const items = []

  events.forEach((e, index) => {
    if ((e.kind === 'offer' || e.kind === 'bid') && e.tick != null) {
      const attempt = { order: e, result: null, index, lastIndex: index }
      attempts.set(e.tick, attempt)
      items.push(attempt)
      return
    }

    if ((e.kind === 'trade' || e.kind === 'nobody_takes') && attempts.has(e.tick)) {
      const attempt = attempts.get(e.tick)
      attempt.result = e
      attempt.lastIndex = index
      return
    }

    items.push({ e, index, lastIndex: index })
  })

  return items
}
