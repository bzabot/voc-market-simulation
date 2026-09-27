import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { investorColor } from './colors.js'
import { NAMES } from './sim.js'

const root = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(root, 'index.css'), 'utf8')
const html = readFileSync(join(root, '../index.html'), 'utf8')

function sources() {
  const files = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (name === 'theme.test.js') continue
      if (name.endsWith('.jsx') || name.endsWith('.js') || name.endsWith('.css')) {
        files.push([path, readFileSync(path, 'utf8')])
      }
    }
  }
  walk(root)
  walk(join(root, 'components'))
  return files
}

function tokens() {
  const out = {}
  const re = /--color-([a-z0-9-]+):\s*oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)(?:\s*\/\s*[0-9.]+%?)?\s*\)/g
  for (const match of css.matchAll(re)) {
    out[match[1]] = { l: Number(match[2]), c: Number(match[3]), h: Number(match[4]) }
  }
  return out
}

function hueDist(a, b) {
  const d = Math.abs(a - b) % 360
  return Math.min(d, 360 - d)
}

function oklchToLinear(l, c, h) {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b
  const L = l_ ** 3
  const M = m_ ** 3
  const S = s_ ** 3
  return [
    Math.min(1, Math.max(0, 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S)),
    Math.min(1, Math.max(0, -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S)),
    Math.min(1, Math.max(0, -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S)),
  ]
}

function luminance({ l, c, h }) {
  const [r, g, b] = oklchToLinear(l, c, h)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a, b) {
  const hi = Math.max(luminance(a), luminance(b))
  const lo = Math.min(luminance(a), luminance(b))
  return (hi + 0.05) / (lo + 0.05)
}

function composite(fg, bg, alpha) {
  const F = oklchToLinear(fg.l, fg.c, fg.h)
  const B = oklchToLinear(bg.l, bg.c, bg.h)
  const mix = F.map((channel, i) => channel * alpha + B[i] * (1 - alpha))
  return 0.2126 * mix[0] + 0.7152 * mix[1] + 0.0722 * mix[2]
}

function contrastLum(a, b) {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

function parseColor(value) {
  const match = value.match(/oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/)
  assert.ok(match, value)
  return { l: Number(match[1]), c: Number(match[2]), h: Number(match[3]) }
}

test('role hues stay at least 20 degrees apart', () => {
  const color = tokens()
  const roles = ['accent', 'loss', 'gain', 'sea', 'voyage']
  for (const name of roles) assert.ok(color[name], name)
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const gap = hueDist(color[roles[i]].h, color[roles[j]].h)
      assert.ok(gap >= 20, `${roles[i]} and ${roles[j]} are ${gap} degrees apart`)
    }
  }
})

test('neutral ramp stays low chroma', () => {
  const color = tokens()
  for (const name of ['page', 'surface', 'raised', 'line', 'text', 'dim', 'mute']) {
    assert.ok(color[name], name)
    assert.ok(color[name].c < 0.05, name)
  }
})

test('text clears the surface it sits on', () => {
  const color = tokens()
  const panel = composite(color.surface, color.page, 0.8)
  const onPanel = ['text', 'dim', 'mute', 'accent', 'gain', 'loss', 'sea', 'voyage']
  for (const name of onPanel) {
    const ratio = contrastLum(luminance(color[name]), panel)
    assert.ok(ratio >= 4.5, `${name} on a panel is ${ratio.toFixed(2)}`)
  }
  assert.ok(contrast(color['accent-ink'], color.accent) >= 4.5)
  assert.ok(contrast(color.accent, color.page) >= 3)
})

test('investor colors avoid the role hues', () => {
  const color = tokens()
  const reserved = ['accent', 'loss', 'gain', 'sea', 'voyage'].map((name) => color[name].h)
  const seen = []
  for (const name of NAMES) {
    const hue = parseColor(investorColor(name)).h
    for (const role of reserved) {
      assert.ok(hueDist(hue, role) >= 15, `${name} hue ${hue} collides with ${role}`)
    }
    for (const other of seen) {
      assert.ok(hueDist(hue, other) >= 15, `${name} repeats another investor hue`)
    }
    seen.push(hue)
  }
  assert.equal(seen.length, 10)
})

test('the page does not keep the old type, gradients, or tiny type', () => {
  const blob = sources().map(([, text]) => text).join('\n') + html
  assert.match(html, /Newsreader/)
  assert.match(html, /Public\+Sans/)
  assert.match(css, /Newsreader/)
  assert.match(css, /Public Sans/)
  assert.doesNotMatch(blob, /Fraunces|IBM Plex/)
  assert.doesNotMatch(blob, /linear-gradient/)
  assert.doesNotMatch(blob, /text-\[(9|10|11)px\]/)
  assert.doesNotMatch(blob, /fontSize="(9|10)"/)
  assert.doesNotMatch(blob, /min-h-screen/)
  assert.match(blob, /min-h-dvh/)
  assert.doesNotMatch(blob, /duration-500/)
  assert.doesNotMatch(blob, /font-bold|fontWeight="900"/)
})
