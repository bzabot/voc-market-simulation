import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import { investorColor } from '../colors'
import { money, signedMoney } from '../format'
import { kindStyle } from './kindStyle'
import { gatheringReason } from './gatheringCopy'

const SeatCtx = createContext(null)

function Name({ children }) {
  const seats = useContext(SeatCtx)
  return (
    <span className="font-semibold" style={{ color: investorColor(seats?.[children] ?? children) }}>
      {children}
    </span>
  )
}

function Money({ cents }) {
  return <span className="tnum font-semibold text-text">{money(cents)}</span>
}

function tradeInvolves(trade, viewer) {
  return trade.buyer === viewer || trade.seller === viewer
}

function GatheringSummary({ e, viewer }) {
  if (e.trades.length === 0) {
    return <>Turn {e.tick} · no sale</>
  }
  if (viewer) {
    return (
      <>
        Turn {e.tick}
        {e.trades.filter((t) => tradeInvolves(t, viewer)).map((trade) => {
          const sold = trade.seller === viewer
          const counterparty = sold ? trade.buyer : trade.seller
          const cash = sold ? trade.cash_cents : -trade.cash_cents
          return (
            <span key={`${trade.buyer}-${trade.seller}`}>
              {' · '}
              {sold ? 'Sold' : 'Bought'} {trade.quantity} {sold ? 'to' : 'from'}{' '}
              <Name>{counterparty}</Name> @ <Money cents={trade.price_cents} /> ·{' '}
              <span className={cash >= 0 ? 'text-gain' : 'text-loss'}>{signedMoney(cash)}</span>
            </span>
          )
        })}
      </>
    )
  }
  return (
    <>
      Turn {e.tick}
      {e.trades.map((trade) => (
        <span key={`${trade.buyer}-${trade.seller}`}>
          {' · '}
          <Name>{trade.buyer}</Name> buys {trade.quantity} from <Name>{trade.seller}</Name> @{' '}
          <Money cents={trade.price_cents} />
        </span>
      ))}
    </>
  )
}

function GatheringDetails({ e, viewer }) {
  const reason = gatheringReason(e)
  return (
    <div className="mt-2 ml-9 space-y-2 border-t border-line/80 pt-2 text-[13px] text-dim">
      {reason && <p>{reason}</p>}
      {e.trades.length === 0 ? (
        <p className="text-mute">No cash moved.</p>
      ) : (
        e.trades.map((trade) => {
          const focus = viewer && tradeInvolves(trade, viewer)
          return (
            <div key={`${trade.buyer}-${trade.seller}`} className="space-y-1">
              <p>
                <Name>{trade.buyer}</Name> buys {trade.quantity} from <Name>{trade.seller}</Name> @{' '}
                <Money cents={trade.price_cents} /> · cash moved <Money cents={trade.cash_cents} />
              </p>
              {focus && (
                <p className="pl-3 text-mute">
                  After this bargain:{' '}
                  {viewer === trade.buyer ? (
                    <>
                      <Name>{trade.buyer}</Name> holds {trade.buyer_shares} sh ·{' '}
                      <Money cents={trade.buyer_cash_cents} />
                    </>
                  ) : (
                    <>
                      <Name>{trade.seller}</Name> holds {trade.seller_shares} sh ·{' '}
                      <Money cents={trade.seller_cash_cents} />
                    </>
                  )}
                </p>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

export function EventBody({ e, viewer }) {
  switch (e.kind) {
    case 'ipo_fill':
      return <><Name>{e.name}</Name> buys {e.size} @ <Money cents={e.price_cents} /> IPO</>
    case 'ipo_closed':
      return <>The offering is closed</>
    case 'gathering':
      return <GatheringSummary e={e} viewer={viewer} />
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

export function EventRow({ e, index, fresh, viewer }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const style = kindStyle(e)
  const expandable = e.kind === 'gathering'

  return (
    <div
      className={`rounded-lg px-2 py-1 text-dim ${fresh ? 'bg-raised/70' : ''} ${
        expandable ? 'border border-transparent' : ''
      }`}
    >
      {expandable ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={detailsId}
          onClick={() => setExpanded((open) => !open)}
          className="flex w-full cursor-pointer items-start gap-2 text-left focus-visible:outline-2 focus-visible:outline-accent"
        >
          <span className="tnum w-7 shrink-0 pt-px text-right text-mute">{index + 1}</span>
          <span className={`kicker mt-px shrink-0 rounded border px-1.5 py-px ${style.cls}`}>
            {style.label}
          </span>
          <span className="min-w-0 flex-1"><EventBody e={e} viewer={viewer} /></span>
          <svg
            viewBox="0 0 10 6"
            aria-hidden
            className={`mt-1 size-2.5 shrink-0 fill-current text-mute transition-transform duration-200 ease-out ${
              expanded ? 'rotate-180' : ''
            }`}
          >
            <path d="M0 0l5 6 5-6H0z" />
          </svg>
        </button>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="tnum w-7 shrink-0 text-right text-mute">{index + 1}</span>
          <span className={`kicker shrink-0 rounded border px-1.5 py-px ${style.cls}`}>
            {style.label}
          </span>
          <span className="min-w-0"><EventBody e={e} viewer={viewer} /></span>
        </div>
      )}
      {expandable && expanded && (
        <div id={detailsId}>
          <GatheringDetails e={e} viewer={viewer} />
        </div>
      )}
    </div>
  )
}

export default function EventFeed({ events, freshCount, viewer, seatByName }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [events.length])

  return (
    <SeatCtx.Provider value={seatByName ?? null}>
      <section className="panel animate-fade-up self-start lg:sticky lg:top-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="panel-title">Market ticker</h2>
          <span className="text-mute">{events.length} events</span>
        </div>

        <div ref={scrollRef} className="max-h-[24rem] space-y-1 overflow-y-auto lg:max-h-[calc(100dvh-12rem)]">
          {events.length === 0 && (
            <p className="sentence py-8 text-center text-mute">(waiting for the opening bell)</p>
          )}
          {events.map((e, index) => (
            <EventRow
              key={index}
              e={e}
              index={index}
              fresh={index >= events.length - freshCount}
              viewer={viewer}
            />
          ))}
        </div>
      </section>
    </SeatCtx.Provider>
  )
}
