import { useEffect, useRef } from 'react'
import { investorColor } from '../colors'
import { money } from '../format'
import { KIND_STYLE } from './kindStyle'
import TradeAttempt from './TradeAttempt'

function Name({ children }) {
  return (
    <span className="font-semibold" style={{ color: investorColor(children) }}>
      {children}
    </span>
  )
}

function Money({ cents }) {
  return <span className="tnum font-semibold text-text">{money(cents)}</span>
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
      return <>The voyage returns: <span className="font-semibold text-voyage capitalize">{e.name}</span> (<Money cents={e.price_cents} />/share)</>
    case 'payout':
      return <><Name>{e.name}</Name> receives {e.size} shares &rarr; <Money cents={e.price_cents} /></>
    case 'treasury_payout':
      return <>Treasury receives {e.size} shares &rarr; <Money cents={e.price_cents} /></>
    default:
      return <>{e.kind}</>
  }
}

export default function EventFeed({ events, freshCount }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [events.length])

  return (
    <section className="panel animate-fade-up self-start lg:sticky lg:top-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="panel-title">Market ticker</h2>
        <span className="text-mute">{events.length} events</span>
      </div>

      <div ref={scrollRef} className="max-h-[24rem] space-y-1 overflow-y-auto lg:max-h-[calc(100dvh-12rem)]">
        {events.length === 0 && (
          <p className="sentence py-8 text-center text-mute">(waiting for the opening bell)</p>
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
              className={`flex items-baseline gap-2 rounded-lg px-2 py-1 text-dim ${
                fresh ? 'bg-raised/70' : ''
              }`}
            >
              <span className="tnum w-7 shrink-0 text-right text-mute">{index + 1}</span>
              <span className={`kicker shrink-0 rounded border px-1.5 py-px ${style.cls}`}>
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
