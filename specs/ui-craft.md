# UI craft pass

Visual pass on the single dark page. The simulation, its controls, and its figures stay as they are. The page should look more deliberate: a 1602 room, a real color system, and type that can hold a market board.

Where `baseline-ui`, `better-ui`, `apple-design`, `better-colors`, or `better-typography` disagree with this document, this document wins.

## Scope

Touch the frontend presentation only.

- `frontend/index.html` for the font stylesheet
- `frontend/src/index.css` for tokens, buttons, panels, and motion
- `frontend/src/colors.js` for investor colors
- `frontend/src/App.jsx` and `frontend/src/components/` for layout, type, and color

Leave `frontend/src/sim.js` and `frontend/src/sim.test.js` behavior alone. Keyboard shortcuts stay: space or Enter steps, A toggles auto, S stops auto, Left walks back, L returns to live.

Do not add a light theme, a confirm step on New run, a new page, a gesture, a sheet, or a runtime dependency. No `motion`, no `tw-animate-css`, no `clsx`. Fonts keep loading from the existing Google Fonts stylesheet, which serves woff2.

## Page

The regions stay in this order.

1. Masthead: mark, company name, place and year, phase, last price, implied value, voyage, and the Replay or History chip when those modes are on.
2. Phase timeline.
3. Controls: Step, Auto, Previous, Live, New run, and the shortcut hint.
4. Main grid: price chart and ownership board on the left, event tape on the right.
5. Replay panel under the grid once the voyage has returned.

Spacing, grouping, and hierarchy inside those regions may change. The 24px title and the 12px type floor will make the masthead and the chart taller. Let text wrap. Do not drop a control, a stat, a shortcut, or a figure.

`App` uses `min-h-screen`. Use `min-h-dvh`. Do not pin a new bar to the viewport. If a bar is fixed, inset it by the safe-area.

## Color

Rebuild the palette in OKLCH. One notation for the whole theme. Components read semantic tokens only. A primitive such as a raw gold step never appears in a component or in an SVG attribute.

Ink and parchment are the neutral ramp. They may sit near gold in hue. Their chroma stays low enough that they read as paper and night, not as a second accent. The page background keeps the two faint warm washes already on `body`. Those are the only gradients.

Roles:

| Role | Use |
| --- | --- |
| Gold | Company mark, last price, chart price line, phase progress, scrubber fill, and the Step button |
| Loss red | Negative money, loss flashes, and New run |
| Gain green | Positive money and gain flashes |
| Sea | Open-trading phase and the "at sea" voyage state |
| Voyage | The revealed voyage outcome, and nothing else |
| Parchment neutral | IPO phase chip, structure, muted labels |

Gold, sea, gain, loss, and voyage each sit at least 20 degrees of OKLCH hue apart. Record the measured hue next to each token. The old VOC brick and the old loss color are the same hue, about 11 to 13 degrees. That brick is not a role. New run takes the loss red. The voyage outcome leaves it.

Step is the only solid fill: gold background, text that clears it. The other controls are neutral surface, parchment text, and a structural border. New run shows the loss hue on the border and the label, with a quiet wash if the button needs it. It is not a second solid fill. It still fires on one click.

There are ten investors, from `NAMES` in `sim.js`. `investorColor(name)` keeps its signature and stays stable for a name. Replace the palette. Each investor hue is at least 15 degrees from gold, sea, gain, loss, voyage, and from every other investor hue.

The phase bar, replay banner, scrubber indicator, and stubbornness meter are flat. Progress and the scrubber use gold. Stubbornness uses the neutral ramp. The replay banner has no wash. The ship icon there is gold. The outcome word uses the voyage color.

On the chart, delete the gold area gradient. The price line and the current-price dot stay gold. The IPO band, outcome guides, and axis use the neutral ramp, so the line is the only gold in the plot. Belief ticks keep using `investorColor`.

Measure each text color against the surface it actually sits on, including translucent panels. Body text at 13px and 14px needs at least 4.5:1. The 20px and 24px prices and titles need at least 3:1. Fix a miss by changing lightness, then measure again.

Dark only. `color-scheme: dark` on the document. Do not add a `.dark` class and a `prefers-color-scheme` block that each set different tokens.

## Type

Two families. Load weights 400, 500, and 600 only. Set `font-synthesis: none` once those faces are the ones in use. Remove Fraunces and IBM Plex Mono, including the Fraunces `fontFamily` on the VOC monogram in `icons.jsx`. The monogram is Public Sans at weight 600.

Newsreader is only the company name and the replay verdict. Both are 24px, weight 600, line-height 1.2, letter-spacing `-0.02em`, and `text-wrap: balance`.

Public Sans is everything else. Changing figures use tabular lining numbers, `font-variant-numeric: tabular-nums lining-nums`. Public Sans has both `tnum` and `lnum`.

| Text | Size | Line-height | Weight |
| --- | --- | --- | --- |
| Hero prices, implied value | 20px | 1.2 | 600 |
| Sentences, empty states, replay lede | 14px | 1.5 | 400 |
| Board, tape, controls | 13px | 1.4 | 400, or 500 for emphasis |
| Uppercase labels | 12px | 1.4 | 500 |

Nothing renders below 12px. That includes chart axis labels, outcome names, kind chips, and shortcut keys, which are 9px to 11px today. Uppercase labels use letter-spacing `0.05em`. Body and UI text get no extra letter-spacing. Sentences use `text-wrap: pretty`.

Panel titles are Public Sans overlines, not Newsreader. A heading inside a panel stays at or above the 13px board size. The company name and the replay verdict are the only 24px titles, so a panel title must not outrank them.

`-webkit-font-smoothing: antialiased` stays on the root, once.

## Surfaces and motion

Outer radius equals inner radius plus padding. Panels are `rounded-xl` at 12px with 16px of padding, so nested rows and chips cannot satisfy the formula today. Raise the outer radius or lower the padding until they do. Keep the current radius steps everywhere the formula already holds.

Borders mark structure: panel edges, dividers, selected and focus rings. Shadows mark elevation. The scrubber thumb's gold glow becomes a normal focus outline.

Buttons scale to `0.96` on press, with a transform transition of about 150ms, ease-out. Disabled buttons do not scale. Hover styles stay inside `@media (hover: hover) and (pointer: fine)`. Name the transition properties. Do not use `transition: all`.

Do not add entrances, sheets, or drag gestures. Do not add an animation library. The existing fade on first paint of a panel may stay. Do not stagger new ones, and do not replay them on every step.

The phase ship and the progress fill move with `transform` only, ease-out, in at most 200ms, so the move finishes inside the 400ms auto interval. Do not change that interval. Row flashes stay on the investors who just traded, as a background cue on top of the gain or loss color, and finish in under 400ms. `AnimatedNumber` keeps its retargeting tween at or under 400ms, and still snaps when reduced motion is on.

The price dot and the "at sea" dot may keep a pulse. Pause looping animation while the element is off-screen. Under `prefers-reduced-motion: reduce`, drop movement and keep opacity and color.

Do not add `will-change` unless a first frame actually stutters. Do not add a new easing curve. The icon swap on Auto may keep its current crossfade.

Icon-only controls need an accessible name. The Auto control already has a visible label, and its glyphs stay `aria-hidden`. Icons use `currentColor`. One stroke weight per icon set, matched to the text beside it: 1.5px next to weight 400, 2px next to weight 600.

## Check

From `frontend/`:

- `npm test` passes with no edits required in the market rules.
- `npm run dev`, then walk a run.

On that walk:

- The empty board still offers one next action, the space key.
- Step, Auto, Previous, Live, and New run do what they did before. New run does not ask for confirmation.
- Gold appears on the mark, the last price, the price line, the phase progress, the scrubber, and a solid Step button.
- A losing trade and the voyage outcome are different hues. New run matches loss, not the voyage.
- Investor dots do not reuse gold, sea, gain, loss, or the voyage hue.
- The background washes are the only gradients.
- The company name and the replay verdict are Newsreader at 24px. Everything else is Public Sans. No text is under 12px.
- Prices do not jitter sideways as the digits change.
- During auto, the ship and a row flash finish before the next step.
- With reduced motion, numbers jump and nothing travels.
- At a narrow width, the same controls and figures are still reachable. The title may wrap.
