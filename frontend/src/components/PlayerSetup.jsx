import { useState } from 'react'
import { NAMES } from '../sim.js'

const NICK_KEY = 'voc-player-nickname'
const SEAT_KEY = 'voc-player-seat'

const FIELD =
  'mt-1 w-full rounded-lg border border-line bg-page px-3 py-2 text-text focus-visible:outline-2 focus-visible:outline-accent'

export default function PlayerSetup({ onStart }) {
  const [nickname, setNickname] = useState(() => localStorage.getItem(NICK_KEY) ?? '')
  const [seat, setSeat] = useState(() => {
    const saved = localStorage.getItem(SEAT_KEY)
    return NAMES.includes(saved) ? saved : ''
  })

  const trimmed = nickname.trim()
  const ready = trimmed !== '' && seat !== ''

  const submit = (ev) => {
    ev.preventDefault()
    if (!ready) return
    localStorage.setItem(NICK_KEY, trimmed)
    localStorage.setItem(SEAT_KEY, seat)
    onStart({ nickname: trimmed, seat })
  }

  return (
    <form className="panel animate-fade-up w-full max-w-md" onSubmit={submit}>
      <div className="px-2 py-1">
        <h1 className="title text-text">Take a seat</h1>
        <p className="sentence mt-1 mb-4 text-mute">
          One of the ten names is you. Your cash comes from the same ladder as everyone else, and the
          board and tape will call you <span className="text-dim">{trimmed || 'Nickname'} (You)</span>.
        </p>

        <label className="block">
          <span className="kicker text-mute">Nickname</span>
          <input
            className={FIELD}
            value={nickname}
            onChange={(ev) => setNickname(ev.target.value)}
            placeholder="Your name on the tape"
            required
          />
        </label>

        <label className="mt-3 block">
          <span className="kicker text-mute">Your seat</span>
          <select
            className={FIELD}
            value={seat}
            onChange={(ev) => setSeat(ev.target.value)}
            required
          >
            <option value="">Choose a seat</option>
            {NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={!ready}>
            Start the run
          </button>
          <span className="text-mute">Both fields are required.</span>
        </div>
      </div>
    </form>
  )
}
