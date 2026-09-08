async function api(path, opts) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!r.ok) {
    const err = new Error(r.statusText)
    err.status = r.status
    throw err
  }
  return r.json()
}

export const newSession = (seed) =>
  api('/api/session', { method: 'POST', body: JSON.stringify({ seed }) })

export const stepSession = () => api('/api/session/step', { method: 'POST' })

export const getFrames = () => api('/api/session/frames')

export const getInvestor = (name) =>
  api(`/api/session/investors/${encodeURIComponent(name)}`)
