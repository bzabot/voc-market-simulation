import AnimatedNumber from './AnimatedNumber'
import { investorColor } from '../colors'
import { money, TOTAL_SHARES } from '../format'

/**
 * The ownership board: every investor's cash, stake and belief,
 * with the company's treasury beneath. Rows flash when their
 * owner traded in the latest frame.
 */
export default function Board({ frame, newEvents }) {
  if (!frame) {
    return (
      <section className="panel animate-fade-up p-4">
        <h2 className="panel-title mb-3">Ownership board</h2>
        <p className="py-10 text-center text-sm text-parch-600">
          The floor is empty &mdash; press <kbd>space</kbd> to open the offering.
        </p>
      </section>
    )
  }

  const investors = [...frame.investors].sort((a, b) => b.shares - a.shares)
  const maxShares = Math.max(1, ...investors.map((i) => i.shares))
  const price = frame.last_price_cents

  // Who was involved in the newest events, and did they gain or spend?
  const flash = new Map()
  for (const e of newEvents) {
    if (e.kind === 'trade') {
      flash.set(e.buyer, 'gain')
      flash.set(e.seller, 'loss')
    } else if (e.kind === 'ipo_fill' || e.kind === 'payout') flash.set(e.name, 'gain')
  }

  return (
    <section className="panel animate-fade-up p-4" style={{ animationDelay: '60ms' }}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="panel-title">Ownership board</h2>
        <span className="text-[11px] text-parch-600">{TOTAL_SHARES} shares issued</span>
      </div>

      <div className="mb-2 grid grid-cols-[1.4rem_1fr_6.5rem_9rem_7rem] items-center gap-3 px-2 text-[10px] tracking-[0.16em] text-parch-600 uppercase max-lg:grid-cols-[1.4rem_1fr_5.5rem_6rem]">
        <span>#</span>
        <span>Investor</span>
        <span className="text-right">Cash</span>
        <span className="max-lg:hidden">Stake</span>
        <span className="text-right">Belief / share</span>
      </div>

      <ul className="space-y-1">
        {investors.map((inv, rank) => {
          const pct = (100 * inv.shares) / TOTAL_SHARES
          const above = inv.v_cents >= price
          const flashKind = flash.get(inv.name)
          return (
            <li
              key={inv.name}
              className={`grid grid-cols-[1.4rem_1fr_6.5rem_9rem_7rem] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors max-lg:grid-cols-[1.4rem_1fr_5.5rem_6rem] ${
                flashKind === 'gain'
                  ? 'row-flash-gain'
                  : flashKind === 'loss'
                    ? 'row-flash-loss'
                    : ''
              }`}
            >
              <span className="text-[11px] text-parch-600">{rank + 1}</span>

              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: investorColor(inv.name) }}
                />
                <span className="truncate text-[13px] font-medium text-parch-100">{inv.name}</span>
                <span className="text-[11px] text-parch-600 max-lg:hidden">
                  {inv.shares} sh &middot; {pct.toFixed(1)}%
                </span>
              </span>

              <AnimatedNumber
                value={inv.cash_cents}
                format={money}
                className="text-right text-[13px] text-parch-200"
              />

              <span className="flex items-center gap-2 max-lg:hidden">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                  <span
                    className="block h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{
                      width: `${(inv.shares / maxShares) * 100}%`,
                      backgroundColor: investorColor(inv.name),
                    }}
                  />
                </span>
                <span className="tnum w-10 text-right text-[11px] text-parch-400">
                  {pct.toFixed(1)}%
                </span>
              </span>

              <span className="text-right text-[13px]">
                <AnimatedNumber
                  value={inv.v_cents ?? 0}
                  format={money}
                  className={above ? 'text-gain-300' : 'text-loss-300'}
                />
                <span className="ml-1 text-[10px] text-parch-600">{above ? '\u2265 mkt' : '< mkt'}</span>
              </span>
            </li>
          )
        })}

        {/* treasury */}
        <li className="mt-2 grid grid-cols-[1.4rem_1fr_6.5rem_9rem_7rem] items-center gap-3 rounded-lg border-t border-ink-700 px-2 pt-2.5 pb-1 opacity-80 max-lg:grid-cols-[1.4rem_1fr_5.5rem_6rem]">
          <span />
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-parch-600" />
            <span className="font-display text-[13px] font-semibold tracking-wide text-parch-300 italic">
              Company treasury
            </span>
            <span className="text-[11px] text-parch-600 max-lg:hidden">
              {frame.treasury_shares} sh &middot; {((100 * frame.treasury_shares) / TOTAL_SHARES).toFixed(1)}%
            </span>
          </span>
          <AnimatedNumber
            value={frame.company_cash_cents}
            format={money}
            className="text-right text-[13px] text-parch-300"
          />
          <span className="flex items-center gap-2 max-lg:hidden">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
              <span
                className="block h-full rounded-full bg-parch-600 transition-[width] duration-500 ease-out"
                style={{ width: `${(frame.treasury_shares / TOTAL_SHARES) * 100}%` }}
              />
            </span>
            <span className="tnum w-10 text-right text-[11px] text-parch-400">
              {((100 * frame.treasury_shares) / TOTAL_SHARES).toFixed(1)}%
            </span>
          </span>
          <span className="text-right text-[13px] text-parch-600">&mdash;</span>
        </li>
      </ul>
    </section>
  )
}
