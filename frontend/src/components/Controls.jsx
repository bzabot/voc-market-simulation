export default function Controls({
  auto,
  done,
  viewingHistory,
  canGoPrevious,
  historyPosition,
  onStep,
  onToggleAuto,
  onPrevious,
  onLive,
  onNewRun,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 px-5 py-3">
      <button type="button" className="btn btn-primary" onClick={onStep} disabled={done || viewingHistory}>
        Step
        <kbd>space</kbd>
      </button>
      <button type="button" className="btn" onClick={onToggleAuto} disabled={(done && !auto) || viewingHistory}>
        <span className="relative h-2.5 w-2.5" aria-hidden>
          <PlayGlyph
            className={
              auto
                ? 'scale-[0.25] opacity-0 blur-[4px]'
                : 'scale-100 opacity-100 blur-[0px]'
            }
          />
          <PauseGlyph
            className={
              auto
                ? 'scale-100 opacity-100 blur-[0px]'
                : 'scale-[0.25] opacity-0 blur-[4px]'
            }
          />
        </span>
        {auto ? 'Pause' : 'Auto'}
        <kbd>A</kbd>
      </button>
      <button type="button" className="btn" onClick={onPrevious} disabled={!canGoPrevious}>
        Previous
        <kbd>&larr;</kbd>
      </button>
      <button type="button" className="btn" onClick={onLive} disabled={!viewingHistory}>
        Live
        {historyPosition && <span className="tnum text-mute">{historyPosition}</span>}
      </button>
      <button type="button" className="btn btn-danger" onClick={onNewRun}>
        New run
      </button>

      <p className="ml-auto hidden text-mute lg:block">
        <kbd>space</kbd> step &middot; <kbd>A</kbd> auto &middot; <kbd>&larr;</kbd> previous &middot; <kbd>L</kbd> live
      </p>
    </div>
  )
}

const ICON_SWAP = 'icon-swap'

function PlayGlyph({ className = '' }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 fill-current ${ICON_SWAP} ${className}`} aria-hidden>
      <path d="M2 1l9 5-9 5V1z" />
    </svg>
  )
}

function PauseGlyph({ className = '' }) {
  return (
    <svg viewBox="0 0 12 12" className={`h-2.5 w-2.5 fill-current ${ICON_SWAP} ${className}`} aria-hidden>
      <path d="M2 1h3v10H2zM7 1h3v10H7z" />
    </svg>
  )
}
