export default function Controls({ auto, done, seed, onSeedChange, onStep, onToggleAuto, onNewRun }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-5 py-3">
      <button type="button" className="btn btn-primary" onClick={onStep} disabled={done}>
        Step
        <kbd>space</kbd>
      </button>
      <button type="button" className="btn" onClick={onToggleAuto} disabled={done && !auto}>
        {auto ? (
          <>
            <PauseGlyph /> Pause
          </>
        ) : (
          <>
            <PlayGlyph /> Auto
          </>
        )}
        <kbd>A</kbd>
      </button>
      <button type="button" className="btn btn-danger" onClick={onNewRun}>
        New run
      </button>

      <label className="ml-1 flex items-center gap-2 text-[12px] text-parch-500">
        seed
        <input
          type="number"
          value={seed}
          onChange={(e) => onSeedChange(e.target.value)}
          className="tnum w-20 rounded-lg border border-ink-600 bg-ink-950 px-2.5 py-1.5 text-[13px] text-parch-200 outline-none transition-colors focus:border-gold-600/70"
          placeholder="random"
        />
      </label>

      <p className="ml-auto hidden text-[11px] text-parch-600 lg:block">
        <kbd>space</kbd> step &middot; <kbd>A</kbd> auto &middot; <kbd>S</kbd> stop
      </p>
    </div>
  )
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden>
      <path d="M2 1l9 5-9 5V1z" />
    </svg>
  )
}

function PauseGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current" aria-hidden>
      <path d="M2 1h3v10H2zM7 1h3v10H7z" />
    </svg>
  )
}
