import { useId, useState } from 'react'
import { investorColor } from '../colors'
import { money } from '../format'

function Name({ children }) {
  return (
    <span className="font-semibold" style={{ color: investorColor(children) }}>
      {children}
    </span>
  )
}

function conviction(value) {
  return `${Math.round(value * 100)}%`
}

export default function TradeAttempt({ order, result, number, fresh }) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const success = result?.kind === 'trade'
  const expired = success ? order.size - result.quantity : 0
  const sell = result?.kind === 'nobody_takes' ? result.side === 'sell' : order.kind === 'offer'
  const initiator = sell ? result?.seller : result?.buyer
  const counterparty = sell ? result?.buyer : result?.seller
  const initiatorValue = sell ? result?.seller_value_cents : result?.buyer_value_cents
  const counterpartyValue = sell ? result?.buyer_value_cents : result?.seller_value_cents
  const initiatorConviction = sell ? result?.seller_conviction : result?.buyer_conviction
  const counterpartyConviction = sell ? result?.buyer_conviction : result?.seller_conviction

  return (
    <div
      className={`rounded-lg border px-2 py-2 ${
        success
          ? 'border-gain/40 bg-gain/10 text-dim'
          : 'border-line bg-surface/50 text-mute'
      } ${fresh ? 'bg-raised/40' : ''}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full cursor-pointer items-start gap-2 text-left focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="tnum w-7 shrink-0 pt-px text-right text-mute">{number}</span>
        <span
          className={`kicker mt-px shrink-0 rounded border px-1.5 py-px ${
            success
              ? 'border-gain/50 bg-gain/10 text-gain'
              : 'border-line bg-raised text-mute'
          }`}
        >
          {success ? 'Trade' : 'Miss'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block">
            Turn {order.tick} &middot; <Name>{order.name}</Name>{' '}
            {sell ? 'offered' : 'bid for'} {order.size} shares at {money(order.price_cents)}
          </span>
          <span className={`block ${success ? 'font-semibold text-gain' : 'text-mute'}`}>
            {success ? (
              <>
                <Name>{result.buyer}</Name> bought {result.quantity} shares &middot; {expired} expired
              </>
            ) : sell ? (
              'No buyer accepted'
            ) : (
              'No seller accepted'
            )}
          </span>
        </span>
        <svg
          viewBox="0 0 10 6"
          aria-hidden
          className={`mt-1 size-2.5 shrink-0 fill-current text-mute transition-transform duration-200 ease-out ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M0 0l5 6 5-6H0z" />
        </svg>
      </button>

      {expanded && (
        <div id={detailsId} className="mt-3 ml-9 space-y-2 border-t border-line/80 pt-3 text-dim">
          {success ? (
            <>
              <p>
                <Name>{initiator}</Name> valued each share at {money(initiatorValue)} &middot; conviction{' '}
                {conviction(initiatorConviction)}
                <span className="block pl-3 text-mute">
                  Initial proposal: {sell ? 'sell' : 'buy'} {order.size} shares
                </span>
              </p>
              <p>
                <Name>{counterparty}</Name> valued each share at {money(counterpartyValue)} &middot; conviction{' '}
                {conviction(counterpartyConviction)}
                <span className="block pl-3 text-mute">
                  Counterproposal: {sell ? 'buy' : 'sell'} {result.counterproposal} shares
                </span>
              </p>
              <p className="font-semibold text-gain">
                Agreement: <Name>{result.buyer}</Name> bought {result.quantity} shares from{' '}
                <Name>{result.seller}</Name> at {money(result.price_cents)} each
              </p>
              {expired > 0 && <p className="text-mute">{expired} shares expired.</p>}
            </>
          ) : (
            <p>{sell ? 'No buyer accepted the offer.' : 'No seller accepted the bid.'}</p>
          )}
        </div>
      )}
    </div>
  )
}
