import { NAMES } from './sim.js'

const PALETTE = [
  'oklch(0.78 0.09 48)',
  'oklch(0.78 0.09 63)',
  'oklch(0.78 0.09 108)',
  'oklch(0.78 0.09 123)',
  'oklch(0.78 0.09 255)',
  'oklch(0.78 0.09 273)',
  'oklch(0.78 0.09 291)',
  'oklch(0.78 0.09 309)',
  'oklch(0.78 0.09 327)',
  'oklch(0.78 0.09 345)',
]

export function investorColor(name) {
  const slot = NAMES.indexOf(name)
  if (slot !== -1) return PALETTE[slot]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
