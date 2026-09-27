import { useState } from 'react'
import { investorColor } from '../colors'
import { IPO_PRICE_CENTS, money } from '../format'

const MOMENT = {
  human_ipo: 'The offering',
  npc_ipo: 'The offering',
  ipo_close: 'The offering',
  voyage: 'The voyage',
  done: 'Settled',
}

function Stat({ label, value }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="kicker text-mute">{label}</span>
      <span className="tnum font-medium text-text">{value}</span>
    </span>
  )
}

function QtyField({ value, onChange, max }) {
  return (
    <span className="flex items-center gap-1.5">
      <label className="kicker text-mute" htmlFor="dock-qty">
        Shares
      </label>
      <input
        id="dock-qty"
        type="number"
        min="1"
        max={Math.max(1, max)}
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        className="tnum w-20 rounded-lg border border-line bg-page px-2 py-1.5 text-text focus-visible:outline-2 focus-visible:outline-accent"
      />
      <button type="button" className="btn" onClick={() => onChange(max)} disabled={max < 1}>
        Max {max}
      </button>
    </span>
  )
}

export default function PlayerDock({
  auto,
  peek,
  human,
  treasury,
  pending,
  onPending,
  onStep,
  ipoResolved,
}) {
  const kind = peek?.kind ?? null
  const tick = peek?.tick ?? null
  const turnKey = `${kind}:${tick}`
  const [qtyTurn, setQtyTurn] = useState({ key: turnKey, qty: 1 })
  const qty = qtyTurn.key === turnKey ? qtyTurn.qty : 1
  const setQty = (value) => setQtyTurn({ key: turnKey, qty: value })

  if (!human) return null

  const preview = peek?.open_preview_cents ?? 0
  const ipoMax = Math.min(Math.floor(human.cash_cents / IPO_PRICE_CENTS), treasury)
  const buyMax = preview > 0 ? Math.floor(human.cash_cents / preview) : 0
  const clamp = (value, limit) => Math.max(1, Math.min(limit, Math.floor(Number(value) || 1)))
  const sideMax = (type) => (type === 'sell' ? human.shares : buyMax)

  const choose = (type) => {
    onPending(type === 'skip' ? { type } : { type, quantity: clamp(qty, sideMax(type)) })
  }

  const changeQty = (value) => {
    setQty(value)
    if (pending && pending.type !== 'skip') {
      onPending({ ...pending, quantity: clamp(value, sideMax(pending.type)) })
    }
  }

  const sideClass = (type) => (pending?.type === type ? 'btn btn-primary' : 'btn')

  let body
  if (auto) {
    body = (
      <p className="sentence text-mute">
        Spectator while Auto runs &mdash; your seat sits out every bargain.
      </p>
    )
  } else if (kind === 'human_ipo') {
    body = (
      <>
        <QtyField value={qty} onChange={setQty} max={ipoMax} />
        <button
          type="button"
          className="btn btn-primary"
          disabled={ipoMax < 1}
          onClick={() => onStep({ type: 'ipo_subscribe', quantity: clamp(qty, ipoMax) })}
        >
          Subscribe
        </button>
        <button type="button" className="btn" onClick={() => onStep({ type: 'skip' })}>
          Skip
        </button>
        <span className="text-mute">
          Your pass &middot; {money(IPO_PRICE_CENTS)} a share &middot; up to {ipoMax}
        </span>
      </>
    )
  } else if (kind === 'npc_ipo' || kind === 'ipo_close') {
    body = ipoResolved ? (
      <p className="sentence text-dim">
        {ipoResolved === 'subscribed' ? 'Subscribed' : 'Passed'} &mdash; {human.shares} shares from the
        offering.
      </p>
    ) : (
      <>
        <button type="button" className="btn" disabled>
          Subscribe
        </button>
        <span className="text-mute">Waiting for your turn in the offering&hellip;</span>
      </>
    )
  } else if (kind === 'trade') {
    body = (
      <>
        <QtyField value={qty} onChange={changeQty} max={sideMax(pending?.type)} />
        <button
          type="button"
          className={sideClass('buy')}
          aria-pressed={pending?.type === 'buy'}
          disabled={buyMax < 1}
          onClick={() => choose('buy')}
        >
          Buy
        </button>
        <button
          type="button"
          className={sideClass('sell')}
          aria-pressed={pending?.type === 'sell'}
          disabled={human.shares < 1}
          onClick={() => choose('sell')}
        >
          Sell
        </button>
        <button
          type="button"
          className={sideClass('skip')}
          aria-pressed={pending?.type === 'skip'}
          onClick={() => choose('skip')}
        >
          Skip
        </button>
        <span className="text-mute">
          {pending
            ? 'Press Step to run the gathering with this choice.'
            : `Buy up to ${buyMax} · sell up to ${human.shares} at the preview.`}
        </span>
      </>
    )
  } else {
    body = (
      <p className="sentence text-mute">
        {peek ? 'Nothing to decide.' : 'Past frames are read-only.'}
      </p>
    )
  }

  return (
    <section className="panel animate-fade-up">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="panel-title">Your seat</h2>
        <span className="text-mute">{kind === 'trade' ? `Turn ${tick}` : (MOMENT[kind] ?? 'History')}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 px-2">
        <span className="flex items-baseline gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: investorColor(human.seat ?? human.name) }}
          />
          <span className="font-medium text-text">{human.name}</span>
        </span>
        <Stat label="Cash" value={money(human.cash_cents)} />
        <Stat label="Shares" value={human.shares} />
        {kind === 'trade' && <Stat label="Open preview" value={money(preview)} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line px-2 pt-3">{body}</div>
    </section>
  )
}
