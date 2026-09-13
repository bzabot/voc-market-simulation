export const TOTAL_SHARES = 1000
export const IPO_PRICE_CENTS = 10_000
export const V_MIN_CENTS = 2_000
export const V_MAX_CENTS = 18_000
export const TRADE_TICKS = 40

export const OUTCOMES = [
  { key: 'lost', cents: 2_000, label: 'Ship lost' },
  { key: 'poor', cents: 7_000, label: 'Poor expedition' },
  { key: 'normal', cents: 13_000, label: 'Normal expedition' },
  { key: 'excellent', cents: 18_000, label: 'Excellent expedition' },
]

export function money(cents) {
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function signedMoney(cents) {
  if (cents === 0) return '$0.00'
  return `${cents > 0 ? '+' : '\u2212'}${money(Math.abs(cents))}`
}

export function signedPct(pct) {
  if (pct === 0) return '0.0%'
  return `${pct > 0 ? '+' : '\u2212'}${Math.abs(pct).toFixed(1)}%`
}

export function stubbornLabel(s) {
  if (s < 0.45) return 'follows the tape'
  if (s < 0.7) return 'moderate'
  return 'holds own view'
}

/** Parse "12/40" trade headers into a tick number; null otherwise. */
export function tradeTick(header) {
  const m = /^(\d+)\/(\d+)$/.exec(header ?? '')
  return m ? Number(m[1]) : null
}
