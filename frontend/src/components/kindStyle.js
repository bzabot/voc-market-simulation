export const KIND_STYLE = {
  ipo_fill: { label: 'IPO', cls: 'border-line bg-raised text-dim' },
  ipo_closed: { label: 'IPO', cls: 'border-line bg-raised text-mute' },
  trade: { label: 'Trade', cls: 'border-gain/50 bg-gain/10 text-gain' },
  nobody_takes: { label: 'Miss', cls: 'border-line bg-raised text-mute' },
  voyage: { label: 'Voyage', cls: 'border-voyage/60 bg-voyage/10 text-voyage' },
  payout: { label: 'Payout', cls: 'border-gain/50 bg-gain/10 text-gain' },
  treasury_payout: { label: 'Payout', cls: 'border-gain/50 bg-gain/10 text-gain' },
}

export function kindStyle(event) {
  if (event.kind === 'gathering') {
    return event.trades.length > 0 ? KIND_STYLE.trade : KIND_STYLE.nobody_takes
  }
  return KIND_STYLE[event.kind] ?? KIND_STYLE.nobody_takes
}
