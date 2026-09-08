// Stable per-investor palette so a name keeps its color everywhere
// (board rows, chart belief ticks, P&L bars, tape chips).
const PALETTE = [
  '#e0b25e', // gold
  '#8fb8c4', // sea
  '#c65a3d', // voc red
  '#9dc48a', // gain
  '#c9a0c8', // mauve
  '#d98e5f', // clay
  '#7fa8a0', // jade
  '#d3c29e', // parch
  '#a0b8dd', // steel blue
  '#c8b06b', // olive gold
]

export function investorColor(name) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}
