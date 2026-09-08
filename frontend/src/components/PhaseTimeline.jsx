import { AnchorIcon, ShipIcon } from './icons'
import { tradeTick, TRADE_TICKS } from '../format'

/**
 * The journey of a run: IPO -> 40 trading ticks -> the voyage's return.
 * The ship sails across as trading progresses.
 */
export default function PhaseTimeline({ frame }) {
  const phase = frame?.phase ?? 'ipo'
  const tick = tradeTick(frame?.header) ?? 0
  const progress =
    phase === 'ipo' ? 0 : phase === 'voyage' ? 1 : Math.min(1, tick / TRADE_TICKS)

  return (
    <div className="border-b border-ink-700 bg-ink-900/40 px-5 py-2.5">
      <div className="relative flex items-center gap-3">
        <PhaseNode
          active={phase === 'ipo'}
          reached
          icon={<AnchorIcon className="h-3.5 w-3.5" />}
          label="IPO"
        />

        <div className="relative h-1 flex-1 overflow-visible rounded-full bg-ink-700">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-600 via-gold-500 to-sea-400 transition-[width] duration-500 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
          <ShipIcon
            className="absolute h-5 w-7 -translate-x-1/2 text-parch-200 transition-[left] duration-500 ease-out"
            style={{ left: `${progress * 100}%`, top: '-14px' }}
          />
        </div>

        <PhaseNode
          active={phase === 'voyage'}
          reached={phase === 'voyage'}
          icon={<ShipIcon className="h-4 w-4" />}
          label={phase === 'voyage' ? 'Voyage returns' : 'Voyage'}
        />
      </div>
    </div>
  )
}

function PhaseNode({ active, reached, icon, label }) {
  return (
    <span
      className={`flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors ${
        active ? 'text-gold-300' : reached ? 'text-parch-300' : 'text-parch-600'
      }`}
    >
      {icon}
      {label}
    </span>
  )
}
