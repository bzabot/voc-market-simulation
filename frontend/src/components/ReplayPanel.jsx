import { Select } from '@base-ui/react/select'
import { Slider } from '@base-ui/react/slider'
import { investorColor } from '../colors'
import { money, signedMoney, signedPct, stubbornLabel } from '../format'
import { EventBody, KIND_STYLE } from './EventFeed'
import { ShipIcon } from './icons'

/**
 * Everything unlocked once the voyage returns: the final ledger,
 * a per-investor inspector with their personal tape, and the
 * time scrubber that rewinds the whole board.
 */
export default function ReplayPanel({
  finalFrame,
  frameCount,
  viewIndex,
  viewHeader,
  onScrub,
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
      <section className="panel relative overflow-hidden p-5">
        <div className="absolute inset-0 bg-gradient-to-r from-voc-500/10 via-transparent to-gold-500/10" />
        <div className="relative flex items-center gap-4">
          <ShipIcon className="h-9 w-14 shrink-0 text-gold-400" />
          <div>
            <h2 className="font-display text-xl font-bold text-parch-100">
              The voyage has returned &mdash;{' '}
              <span className="text-gold-300 capitalize">{finalFrame.voyage_shown}</span>
            </h2>
            <p className="text-[12px] text-parch-500">
              Final ledger settled. Rewind time below to inspect any moment of the run.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* final P&L leaderboard */}
        <section className="panel p-4">
          <h2 className="panel-title mb-3">Final ledger</h2>
          <ul className="space-y-1.5">
            {rows.map((r, rank) => (
              <li key={r.name}>
                <button
                  type="button"
                  onClick={() => onSelectInvestor(r.name)}
                  className={`group grid w-full cursor-pointer grid-cols-[1.4rem_1fr_6.5rem_6.5rem_4.5rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-ink-800 ${
                    r.name === selectedName ? 'bg-ink-800 ring-1 ring-gold-600/40' : ''
                  }`}
                >
                  <span className="text-[11px] text-parch-600">{rank + 1}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: investorColor(r.name) }} />
                    <span className="truncate text-[13px] font-medium text-parch-100">{r.name}</span>
                  </span>
                  <span className="tnum text-right text-[12px] text-parch-500">{money(r.start)}</span>
                  <span className="flex items-center justify-end gap-2">
                    <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-ink-700">
                      <span
                        className={`absolute inset-y-0 rounded-full ${r.total >= 0 ? 'bg-gain-400' : 'bg-loss-400'}`}
                        style={{
                          width: `${(Math.abs(r.total) / maxAbs) * 100}%`,
                          ...(r.total >= 0 ? { left: 0 } : { right: 0 }),
                        }}
                      />
                    </span>
                    <span className={`tnum text-[12px] font-semibold ${r.total >= 0 ? 'text-gain-300' : 'text-loss-300'}`}>
                      {signedMoney(r.total)}
                    </span>
                  </span>
                  <span className={`tnum text-right text-[12px] ${r.pct >= 0 ? 'text-gain-400' : 'text-loss-400'}`}>
                    {signedPct(r.pct)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* investor inspector */}
        <section className="panel flex flex-col p-4">
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
                <div className="mb-1 flex items-baseline justify-between text-[11px]">
                  <span className="tracking-[0.14em] text-parch-600 uppercase">Stubbornness</span>
                  <span className="text-parch-400">
                    {inspect.stubbornness.toFixed(2)} &middot; {stubbornLabel(inspect.stubbornness)}
                  </span>
                </div>
                <div className="relative h-1.5 rounded-full bg-ink-700">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-sea-400 to-gold-500"
                    style={{ width: `${((inspect.stubbornness - 0.2) / 0.7) * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-parch-600">
                  <span>follows the tape</span>
                  <span>conservative</span>
                </div>
              </div>

              <h3 className="panel-title mt-4 mb-2">Personal tape</h3>
              <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" style={{ maxHeight: '14rem' }}>
                {inspect.tape.length === 0 && (
                  <li className="py-4 text-center text-sm text-parch-600">(never traded)</li>
                )}
                {inspect.tape.map((e, i) => {
                  const style = KIND_STYLE[e.kind] ?? KIND_STYLE.nobody_takes
                  return (
                    <li key={i} className="flex items-baseline gap-2 rounded-md px-2 py-1 text-[12.5px] text-parch-300 odd:bg-ink-850">
                      <span className={`shrink-0 rounded border px-1.5 py-px text-[9px] font-semibold tracking-[0.1em] uppercase ${style.cls}`}>
                        {style.label}
                      </span>
                      <span className="min-w-0"><EventBody e={e} /></span>
                    </li>
                  )
                })}
              </ol>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-parch-600">Select an investor to inspect their run.</p>
          )}
        </section>
      </div>

      {/* time scrubber */}
      <section className="panel p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="panel-title">Time travel</h2>
          <span className="tnum text-[12px] text-parch-400">
            frame {viewIndex + 1} / {frameCount} &middot; <span className="text-gold-300">{viewHeader}</span>
          </span>
        </div>
        <Slider.Root
          className="flex items-center"
          value={viewIndex}
          onValueChange={(v) => onScrub(v)}
          min={0}
          max={Math.max(0, frameCount - 1)}
          step={1}
        >
          <Slider.Control className="flex w-full touch-none items-center py-2 select-none">
            <Slider.Track className="relative h-1.5 w-full rounded-full bg-ink-700">
              <Slider.Indicator className="rounded-full bg-gradient-to-r from-gold-600 to-gold-400" />
              <Slider.Thumb className="block h-4 w-4 cursor-grab rounded-full border-2 border-gold-400 bg-ink-900 shadow-[0_0_0_4px_rgb(212_162_78/0.15)] transition-shadow hover:shadow-[0_0_0_6px_rgb(212_162_78/0.25)] focus-visible:outline-2 focus-visible:outline-gold-400 active:cursor-grabbing" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        <div className="flex justify-between text-[10px] text-parch-600">
          <span>opening bell</span>
          <span>voyage returns</span>
        </div>
      </section>
    </div>
  )
}

function InspectStat({ label, value, tone }) {
  const toneCls = tone === 'gain' ? 'text-gain-300' : tone === 'loss' ? 'text-loss-300' : 'text-parch-100'
  return (
    <div>
      <dt className="text-[10px] tracking-[0.16em] text-parch-600 uppercase">{label}</dt>
      <dd className={`tnum text-[15px] font-semibold ${toneCls}`}>{value}</dd>
    </div>
  )
}

function InvestorSelect({ names, value, onChange }) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="flex cursor-pointer items-center gap-2 rounded-lg border border-ink-600 bg-ink-950 px-3 py-1.5 text-[13px] text-parch-100 transition-colors hover:border-gold-600/60 focus-visible:outline-2 focus-visible:outline-gold-500">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: investorColor(value ?? '') }} />
        <Select.Value placeholder="Choose investor" />
        <Select.Icon className="text-parch-500">
          <svg viewBox="0 0 10 6" className="h-2 w-2.5 fill-current" aria-hidden>
            <path d="M0 0l5 6 5-6H0z" />
          </svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className="z-50" sideOffset={6}>
          <Select.Popup className="min-w-40 rounded-lg border border-ink-600 bg-ink-900 p-1 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)]">
            {names.map((n) => (
              <Select.Item
                key={n}
                value={n}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-parch-200 outline-none data-highlighted:bg-ink-700 data-selected:text-gold-300"
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: investorColor(n) }} />
                <Select.ItemText>{n}</Select.ItemText>
                <Select.ItemIndicator className="ml-auto text-gold-400">
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
