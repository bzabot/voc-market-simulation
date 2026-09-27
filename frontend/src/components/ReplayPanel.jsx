import { Select } from '@base-ui/react/select'
import { investorColor } from '../colors'
import { money, signedMoney, signedPct, stubbornLabel } from '../format'
import { EventRow } from './EventFeed'
import { ShipIcon } from './icons'

export default function ReplayPanel({
  finalFrame,
  selectedName,
  onSelectInvestor,
  inspect,
}) {
  const rows = finalFrame.investors
    .map((i) => {
      const start = i.start_cash_cents || 0
      const total = i.cash_cents - start
      return { name: i.name, start, end: i.cash_cents, total, pct: start ? (100 * total) / start : 0 }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.total)))
  const names = finalFrame.investors.map((i) => i.name).sort()

  return (
    <div className="animate-fade-up space-y-4">
      {/* verdict banner */}
      <section className="panel relative overflow-hidden">
        <div className="flex items-center gap-4">
          <ShipIcon className="h-9 w-14 shrink-0 text-accent" />
          <div>
            <h2 className="title text-text">
              The voyage has returned &mdash;{' '}
              <span className="text-voyage capitalize">{finalFrame.voyage_shown}</span>
            </h2>
            <p className="sentence text-mute">
              Final ledger settled. Rewind time below to inspect any moment of the run.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* final P&L leaderboard */}
        <section className="panel">
          <h2 className="panel-title mb-3">Final ledger</h2>
          <ul className="space-y-1.5">
            {rows.map((r, rank) => (
              <li key={r.name}>
                <button
                  type="button"
                  onClick={() => onSelectInvestor(r.name)}
                  className={`grid w-full cursor-pointer grid-cols-[1.4rem_1fr_6.5rem_6.5rem_4.5rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-[background-color] duration-150 ease-out hover-raise ${
                    r.name === selectedName ? 'bg-raised ring-1 ring-line' : ''
                  }`}
                >
                  <span className="text-mute">{rank + 1}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: investorColor(r.name) }} />
                    <span className="truncate font-medium text-text">{r.name}</span>
                  </span>
                  <span className="tnum text-right text-mute">{money(r.start)}</span>
                  <span className="flex items-center justify-end gap-2">
                    <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-line">
                      <span
                        className={`absolute inset-y-0 rounded-full ${r.total >= 0 ? 'bg-gain' : 'bg-loss'}`}
                        style={{
                          width: `${(Math.abs(r.total) / maxAbs) * 100}%`,
                          ...(r.total >= 0 ? { left: 0 } : { right: 0 }),
                        }}
                      />
                    </span>
                    <span className={`tnum font-semibold ${r.total >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {signedMoney(r.total)}
                    </span>
                  </span>
                  <span className={`tnum text-right ${r.pct >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {signedPct(r.pct)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* investor inspector */}
        <section className="panel flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="panel-title">Investor inspector</h2>
            <InvestorSelect names={names} value={selectedName} onChange={onSelectInvestor} />
          </div>

          {inspect ? (
            <>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px] sm:grid-cols-4">
                <InspectStat label="Started with" value={money(inspect.start_cents)} />
                <InspectStat label="Ended with" value={money(inspect.end_cents)} />
                <InspectStat
                  label="Total"
                  value={signedMoney(inspect.total_cents)}
                  tone={inspect.total_cents >= 0 ? 'gain' : 'loss'}
                />
                <InspectStat
                  label="Return"
                  value={signedPct(inspect.pct)}
                  tone={inspect.pct >= 0 ? 'gain' : 'loss'}
                />
              </dl>

              <div className="mt-4">
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="kicker text-mute">Stubbornness</span>
                  <span className="text-dim">
                    {inspect.stubbornness.toFixed(2)} &middot; {stubbornLabel(inspect.stubbornness)}
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-line">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-mute"
                    style={{ width: `${((inspect.stubbornness - 0.2) / 0.7) * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-mute">
                  <span>follows the tape</span>
                  <span>holds own view</span>
                </div>
              </div>

              <h3 className="panel-title mt-4 mb-2">Personal tape</h3>
              <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: '14rem' }}>
                {inspect.tape.length === 0 && (
                  <li className="sentence py-4 text-center text-mute">(never traded)</li>
                )}
                {inspect.tape.map((e, i) => (
                  <li key={i}>
                    <EventRow e={e} index={i} fresh={false} viewer={selectedName} />
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="sentence py-8 text-center text-mute">Select an investor to inspect their run.</p>
          )}
        </section>
      </div>

    </div>
  )
}

function InspectStat({ label, value, tone }) {
  const toneCls = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-text'
  return (
    <div>
      <dt className="kicker text-mute">{label}</dt>
      <dd className={`tnum text-[13px] font-medium ${toneCls}`}>{value}</dd>
    </div>
  )
}

function InvestorSelect({ names, value, onChange }) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="hover-accent flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-page px-3 py-1.5 text-text transition-[border-color] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-accent">
        <span className="size-2 rounded-full" style={{ backgroundColor: investorColor(value ?? '') }} />
        <Select.Value placeholder="Choose investor" />
        <Select.Icon className="text-mute">
          <svg viewBox="0 0 10 6" className="h-2 w-2.5 fill-current" aria-hidden>
            <path d="M0 0l5 6 5-6H0z" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-50" sideOffset={6}>
          <Select.Popup className="min-w-40 origin-(--transform-origin) rounded-lg border border-line bg-surface p-1 shadow-[0_16px_40px_-12px_oklch(0_0_0/0.8)] transition-[opacity,scale] duration-150 ease-out data-starting-style:scale-[0.97] data-starting-style:opacity-0 data-ending-style:scale-[0.97] data-ending-style:opacity-0">
            {names.map((n) => (
              <Select.Item
                key={n}
                value={n}
                className="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-dim outline-none data-highlighted:bg-raised data-selected:text-text"
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: investorColor(n) }} />
                <Select.ItemText>{n}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto text-dim">
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-current" strokeWidth="2" aria-hidden>
                    <path d="M2 6.5L5 9.5L10 2.5" />
                  </svg>
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
