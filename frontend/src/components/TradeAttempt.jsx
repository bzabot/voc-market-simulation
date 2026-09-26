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
      className={`rounded-md border px-2 py-2 text-[12.5px] leading-snug ${
        success
          ? 'border-gain-500/40 bg-gain-500/10 text-parch-200'
          : 'border-ink-700 bg-ink-900/50 text-parch-500'
      } ${fresh ? 'animate-fade-up' : ''}`}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailsId}
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full cursor-pointer items-start gap-2 text-left focus-visible:outline-2 focus-visible:outline-gold-500"
      >
        <span className="tnum w-7 shrink-0 pt-px text-right text-[10px] text-parch-600">{number}</span>
        <span
          className={`mt-px shrink-0 rounded border px-1.5 py-px text-[9px] font-semibold tracking-[0.1em] uppercase ${
            success
              ? 'border-gain-500/50 bg-gain-500/10 text-gain-300'
              : 'border-ink-600 bg-ink-800 text-parch-500'
          }`}
        >
          {success ? 'Trade' : 'Miss'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block">
            Turn {order.tick} &middot; <Name>{order.name}</Name>{' '}
            {sell ? 'offered' : 'bid for'} {order.size} shares at {money(order.price_cents)}
          </span>
          <span className={`block ${success ? 'font-semibold text-gain-300' : 'text-parch-600'}`}>
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
          className={`mt-1 h-1.5 w-2.5 shrink-0 fill-current text-parch-600 transition-transform duration-200 ease-out ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M0 0l5 6 5-6H0z" />
        </svg>
      </button>

      {expanded && (
        <div id={detailsId} className="mt-3 ml-9 space-y-2 border-t border-ink-700/80 pt-3 text-parch-400">
          {success ? (
            <>
              <p>
                <Name>{initiator}</Name> valued each share at {money(initiatorValue)} &middot; conviction{' '}
                {conviction(initiatorConviction)}
                <span className="block pl-3 text-parch-500">
                  Initial proposal: {sell ? 'sell' : 'buy'} {order.size} shares
                </span>
              </p>
              <p>
                <Name>{counterparty}</Name> valued each share at {money(counterpartyValue)} &middot; conviction{' '}
                {conviction(counterpartyConviction)}
                <span className="block pl-3 text-parch-500">
                  Counterproposal: {sell ? 'buy' : 'sell'} {result.counterproposal} shares
                </span>
              </p>
              <p className="font-semibold text-gain-300">
                Agreement: <Name>{result.buyer}</Name> bought {result.quantity} shares from{' '}
                <Name>{result.seller}</Name> at {money(result.price_cents)} each
              </p>
              {expired > 0 && <p className="text-parch-500">{expired} shares expired.</p>}
            </>
          ) : (
            <p>{sell ? 'No buyer accepted the offer.' : 'No seller accepted the bid.'}</p>
          )}
        </div>
      )}
    </div>
  )
}
