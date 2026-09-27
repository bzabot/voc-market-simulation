import { useCallback, useEffect, useState } from 'react'
import { inspectInvestor, marketNew } from './sim.js'
import BeliefChart from './components/BeliefChart'
import Board from './components/Board'
import Controls from './components/Controls'
import EventFeed from './components/EventFeed'
import Floor from './components/Floor'
import Masthead from './components/Masthead'
import PhaseTimeline from './components/PhaseTimeline'
import ReplayPanel from './components/ReplayPanel'

const AUTO_MS = 400

export default function App() {
  const [market, setMarket] = useState(() => marketNew())
  const [history, setHistory] = useState([])
  const [done, setDone] = useState(false)
  const [auto, setAuto] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [viewIndex, setViewIndex] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(null)
  const [selectedName, setSelectedName] = useState(null)
  const inspect =
    replaying && selectedName ? inspectInvestor(market, selectedName) : null

  const liveFrame = history.length ? history[history.length - 1] : null
  const viewingHistory = !replaying && historyIndex != null
  const shownIndex = replaying ? viewIndex : historyIndex
  const frame = shownIndex == null ? liveFrame : history[shownIndex]
  const prevFrame = shownIndex == null ? history[history.length - 2] : history[shownIndex - 1]

  const prevEventCount = prevFrame?.events.length ?? 0
  const newEvents = frame ? frame.events.slice(prevEventCount) : []

  const enterReplay = useCallback(() => {
    const frames = market.frames
    setAuto(false)
    setHistory(frames)
    setViewIndex(frames.length - 1)
    setHistoryIndex(null)
    setDone(true)
    setReplaying(true)
    const leaders = [...frames[frames.length - 1].investors].sort(
      (a, b) => b.cash_cents - (b.start_cash_cents || 0) - (a.cash_cents - (a.start_cash_cents || 0)),
    )
    setSelectedName((name) => name ?? leaders[0]?.name ?? null)
  }, [market])

  const stepOnce = useCallback(() => {
    const ok = market.step()
    if (!ok) {
      enterReplay()
      return
    }
    const frame = market.frames.at(-1)
    if (market.done) enterReplay()
    else setHistory((h) => [...h, frame])
  }, [enterReplay, market])

  const newRun = useCallback(() => {
    setAuto(false)
    setDone(false)
    setReplaying(false)
    setHistory([])
    setViewIndex(0)
    setHistoryIndex(null)
    setSelectedName(null)
    setMarket(marketNew())
  }, [])

  const showPrevious = useCallback(() => {
    setAuto(false)
    setHistoryIndex((current) => {
      if (history.length < 2) return null
      if (current == null) return history.length - 2
      return Math.max(0, current - 1)
    })
  }, [history.length])

  const showLive = useCallback(() => setHistoryIndex(null), [])

  const scrubTo = useCallback((index) => {
    setAuto(false)
    if (replaying) {
      setViewIndex(index)
      return
    }
    if (index >= history.length - 1) setHistoryIndex(null)
    else setHistoryIndex(index)
  }, [history.length, replaying])

  useEffect(() => {
    if (!auto) return
    const timer = setInterval(() => stepOnce(), AUTO_MS)
    return () => clearInterval(timer)
  }, [auto, stepOnce])

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.target.matches('input, select, textarea')) return
      if (ev.key === 'ArrowLeft' && !replaying) {
        ev.preventDefault()
        showPrevious()
      } else if ((ev.key === 'l' || ev.key === 'L') && viewingHistory) {
        showLive()
      } else if ((ev.key === ' ' || ev.key === 'Enter') && !viewingHistory) {
        ev.preventDefault()
        setAuto(false)
        stepOnce()
      } else if ((ev.key === 'a' || ev.key === 'A') && !viewingHistory) {
        setAuto((a) => !a)
      } else if (ev.key === 's' || ev.key === 'S') {
        setAuto(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [replaying, showLive, showPrevious, stepOnce, viewingHistory])

  return (
    <div className="flex min-h-dvh flex-col">
      <Masthead
        frame={frame}
        prevFrame={prevFrame}
        replaying={replaying}
        viewingHistory={viewingHistory}
      />
      <PhaseTimeline frame={frame} frames={history} onScrub={scrubTo} />
      <Controls
        auto={auto}
        done={done}
        viewingHistory={viewingHistory}
        canGoPrevious={!done && history.length > 1 && historyIndex !== 0}
        historyPosition={viewingHistory ? `${historyIndex + 1} / ${history.length}` : null}
        onStep={() => {
          setAuto(false)
          stepOnce()
        }}
        onToggleAuto={() => setAuto((a) => !a)}
        onPrevious={showPrevious}
        onLive={showLive}
        onNewRun={newRun}
      />

      <main className="grid flex-1 items-start gap-4 px-5 pb-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0 space-y-4">
          <BeliefChart
            history={history}
            upto={shownIndex == null ? history.length : shownIndex + 1}
          />
          <Floor gathering={newEvents.findLast((e) => e.kind === 'gathering') ?? null} />
          <Board frame={frame} newEvents={newEvents} />
        </div>
        <EventFeed events={frame?.events ?? []} freshCount={replaying || viewingHistory ? 0 : newEvents.length} />
      </main>

      {replaying && history.length > 0 && (
        <div className="px-5 pb-6">
          <ReplayPanel
            finalFrame={history[history.length - 1]}
            selectedName={selectedName}
            onSelectInvestor={setSelectedName}
            inspect={inspect}
          />
        </div>
      )}
    </div>
  )
}
