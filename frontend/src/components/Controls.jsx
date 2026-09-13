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
      <button type="button" className="btn" onClick={onPrevious} disabled={!canGoPrevious}>
        Previous
        <kbd>&larr;</kbd>
      </button>
      <button type="button" className="btn" onClick={onLive} disabled={!viewingHistory}>
        Live
        {historyPosition && <span className="tnum text-[10px] text-parch-500">{historyPosition}</span>}
      </button>
      <button type="button" className="btn btn-danger" onClick={onNewRun}>
        New run
      </button>

      <p className="ml-auto hidden text-[11px] text-parch-600 lg:block">
        <kbd>space</kbd> step &middot; <kbd>A</kbd> auto &middot; <kbd>&larr;</kbd> previous &middot; <kbd>L</kbd> live
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
