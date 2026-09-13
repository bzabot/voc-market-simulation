import { useCallback, useEffect, useRef, useState } from 'react'
import { getFrames, getInvestor, newSession, stepSession } from './api'
import Board from './components/Board'
import Controls from './components/Controls'
import EventFeed from './components/EventFeed'
import Masthead from './components/Masthead'
import PhaseTimeline from './components/PhaseTimeline'
import PriceChart from './components/PriceChart'
import ReplayPanel from './components/ReplayPanel'

const AUTO_MS = 400

export default function App() {
  const [history, setHistory] = useState([])
  const [done, setDone] = useState(false)
  const [auto, setAuto] = useState(false)
  const [replaying, setReplaying] = useState(false)
  const [viewIndex, setViewIndex] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(null)
  const [selectedName, setSelectedName] = useState(null)
  const [inspect, setInspect] = useState(null)

  const liveFrame = history.length ? history[history.length - 1] : null
  const viewingHistory = !replaying && historyIndex != null
  const shownIndex = replaying ? viewIndex : historyIndex
  const frame = shownIndex == null ? liveFrame : history[shownIndex]
  const prevFrame = shownIndex == null ? history[history.length - 2] : history[shownIndex - 1]

  const prevEventCount = prevFrame?.events.length ?? 0
  const newEvents = frame ? frame.events.slice(prevEventCount) : []

  const enterReplay = useCallback(async () => {
    setAuto(false)
    const data = await getFrames()
    setHistory(data.frames)
    setViewIndex(data.frames.length - 1)
    setHistoryIndex(null)
    setDone(true)
    setReplaying(true)
    const leaders = [...data.frames[data.frames.length - 1].investors].sort(
      (a, b) => b.cash_cents - (b.start_cash_cents || 0) - (a.cash_cents - (a.start_cash_cents || 0)),
    )
    setSelectedName((name) => name ?? leaders[0]?.name ?? null)
  }, [])

  const applyStep = useCallback(
    async (body) => {
      if (body.frame) setHistory((h) => [...h, body.frame])
      if (body.done) await enterReplay()
    },
    [enterReplay],
  )

  const stepOnce = useCallback(async () => {
    try {
      await applyStep(await stepSession())
    } catch (err) {
      if (err.status === 409) await enterReplay()
    }
  }, [applyStep, enterReplay])

  const newRun = useCallback(async () => {
    setAuto(false)
    setDone(false)
    setReplaying(false)
    setHistory([])
    setViewIndex(0)
    setHistoryIndex(null)
    setSelectedName(null)
    setInspect(null)
    await newSession()
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

  // auto-play
  const stepRef = useRef(stepOnce)
  stepRef.current = stepOnce
  useEffect(() => {
    if (!auto) return
    const timer = setInterval(() => stepRef.current(), AUTO_MS)
    return () => clearInterval(timer)
  }, [auto])

  // start a run on load
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    newRun()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fetch investor inspection when the replay inspector changes target
  useEffect(() => {
    if (!replaying || !selectedName) return
    let stale = false
    getInvestor(selectedName).then((body) => {
      if (!stale) setInspect(body)
    })
    return () => {
      stale = true
    }
  }, [replaying, selectedName])

  // keyboard shortcuts (mirrors the original app)
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
        stepRef.current()
      } else if ((ev.key === 'a' || ev.key === 'A') && !viewingHistory) {
        setAuto((a) => !a)
      } else if (ev.key === 's' || ev.key === 'S') {
        setAuto(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [replaying, showLive, showPrevious, viewingHistory])

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead
        frame={frame}
        prevFrame={prevFrame}
        replaying={replaying}
        viewingHistory={viewingHistory}
      />
      <PhaseTimeline frame={frame} />
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
          <PriceChart
            history={history}
            upto={shownIndex == null ? history.length : shownIndex + 1}
            frame={frame}
          />
          <Board frame={frame} newEvents={newEvents} />
        </div>
        <EventFeed events={frame?.events ?? []} freshCount={replaying || viewingHistory ? 0 : newEvents.length} />
      </main>

      {replaying && history.length > 0 && (
        <div className="px-5 pb-6">
          <ReplayPanel
            finalFrame={history[history.length - 1]}
            frameCount={history.length}
            viewIndex={viewIndex}
            viewHeader={frame?.header ?? ''}
            onScrub={setViewIndex}
            selectedName={selectedName}
            onSelectInvestor={setSelectedName}
            inspect={inspect}
          />
        </div>
      )}
    </div>
  )
}
