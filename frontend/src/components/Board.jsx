import AnimatedNumber from './AnimatedNumber'
import { investorColor } from '../colors'
import { money, TOTAL_SHARES } from '../format'
import { stanceAt, worthCents } from '../sim.js'

const STANCE_LABEL = { buying: 'Buying', selling: 'Selling', waiting: 'Waiting' }
const STANCE_CLASS = { buying: 'text-sea', selling: 'text-dim', waiting: 'text-mute' }

const COLS =
  'grid grid-cols-[1.4rem_minmax(0,1.1fr)_5.5rem_5.5rem_7.5rem_6.5rem] items-center gap-2 max-lg:grid-cols-[1.4rem_1fr_5rem_5rem_6rem]'

export default function Board({ frame, newEvents }) {
  if (!frame) {
    return (
      <section className="panel animate-fade-up">
        <h2 className="panel-title mb-3">Ownership board</h2>
        <p className="sentence py-10 text-center text-mute">
          No shares are held yet. Press <kbd>space</kbd> to open the offering.
        </p>
      </section>
    )
  }

  const investors = [...frame.investors].sort((a, b) => b.shares - a.shares)
  const maxShares = Math.max(1, ...investors.map((i) => i.shares))
  const price = frame.last_price_cents

  const flash = new Set()
  for (const e of newEvents) {
    if (e.kind === 'gathering') {
      for (const trade of e.trades) {
        flash.add(trade.buyer)
        flash.add(trade.seller)
      }
    } else if (e.kind === 'ipo_fill' || e.kind === 'payout') flash.add(e.name)
  }

  return (
    <section className="panel animate-fade-up">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="panel-title">Ownership board</h2>
        <span className="text-mute">{TOTAL_SHARES} shares issued</span>
      </div>

      <div className={`${COLS} kicker mb-2 px-2 text-mute`}>
        <span>#</span>
        <span>Investor</span>
        <span className="text-right">Cash</span>
        <span className="text-right" title="Cash plus belief times shares">Worth</span>
        <span className="max-lg:hidden">Stake</span>
        <span className="text-right">Belief / share</span>
      </div>

      <ul className="space-y-1">
        {investors.map((inv, rank) => {
          const pct = (100 * inv.shares) / TOTAL_SHARES
          const stance = stanceAt(inv, price)
          const traded = flash.has(inv.name)
          return (
            <li
              key={inv.name}
              className={`${COLS} rounded-lg px-2 py-1.5 ${traded ? 'bg-raised/70' : ''}`}
            >
              <span className="text-mute">{rank + 1}</span>

              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: investorColor(inv.name) }}
                />
                <span className="truncate font-medium text-text">{inv.name}</span>
                <span className="text-mute max-lg:hidden">
                  {inv.shares} sh · {pct.toFixed(1)}%
                </span>
              </span>

              <AnimatedNumber
                value={inv.cash_cents}
                format={money}
                className="text-right text-dim"
              />

              <AnimatedNumber
                value={worthCents(inv)}
                format={money}
                className="text-right text-text"
              />

              <span className="flex items-center gap-2 max-lg:hidden">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                  <span
                    className="phase-move block h-full w-full origin-left rounded-full"
                    style={{
                      transform: `scaleX(${inv.shares / maxShares})`,
                      backgroundColor: investorColor(inv.name),
                    }}
                  />
                </span>
                <span className="tnum w-10 text-right text-[12px] text-mute">
                  {pct.toFixed(1)}%
                </span>
              </span>

              <span className="text-right">
                <AnimatedNumber
                  value={inv.v_cents ?? 0}
                  format={money}
                  className="text-text"
                />
                <span className={`ml-1 text-[12px] ${STANCE_CLASS[stance]}`}>{STANCE_LABEL[stance]}</span>
              </span>
            </li>
          )
        })}

        <li className={`${COLS} mt-2 rounded-lg border-t border-line px-2 pt-2.5 pb-1 opacity-80`}>
          <span />
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-mute" />
            <span className="font-medium text-dim">Company treasury</span>
            <span className="text-mute max-lg:hidden">
              {frame.treasury_shares} sh · {((100 * frame.treasury_shares) / TOTAL_SHARES).toFixed(1)}%
            </span>
          </span>
          <AnimatedNumber
            value={frame.company_cash_cents}
            format={money}
            className="text-right text-dim"
          />
          <span className="text-right text-mute">—</span>
          <span className="flex items-center gap-2 max-lg:hidden">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <span
                className="phase-move block h-full w-full origin-left rounded-full bg-mute"
                style={{ transform: `scaleX(${frame.treasury_shares / TOTAL_SHARES})` }}
              />
            </span>
            <span className="tnum w-10 text-right text-[12px] text-mute">
              {((100 * frame.treasury_shares) / TOTAL_SHARES).toFixed(1)}%
            </span>
          </span>
          <span className="text-right text-mute">—</span>
        </li>
      </ul>
    </section>
  )
}
