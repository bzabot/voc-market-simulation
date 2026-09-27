import {
  IPO_PRICE_CENTS,
  OUTCOMES_CENTS_PER_SHARE,
  TOTAL_SHARES,
  TRADE_TICKS,
  V_MAX_CENTS,
  V_MIN_CENTS,
} from './sim.js'

export { IPO_PRICE_CENTS, TOTAL_SHARES, TRADE_TICKS, V_MAX_CENTS, V_MIN_CENTS }

export const OUTCOMES = [
  { key: 'lost', cents: OUTCOMES_CENTS_PER_SHARE.lost, label: 'Ship lost' },
  { key: 'poor', cents: OUTCOMES_CENTS_PER_SHARE.poor, label: 'Poor expedition' },
  { key: 'normal', cents: OUTCOMES_CENTS_PER_SHARE.normal, label: 'Normal expedition' },
  { key: 'excellent', cents: OUTCOMES_CENTS_PER_SHARE.excellent, label: 'Excellent expedition' },
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

export function tradeTick(header) {
  const m = /^(\d+)\/(\d+)$/.exec(header ?? '')
  return m ? Number(m[1]) : null
}
