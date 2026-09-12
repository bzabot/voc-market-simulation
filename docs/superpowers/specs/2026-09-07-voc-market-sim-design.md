# VOC market simulation (v1)

Spectator terminal simulation of a single-company share market in the spirit of the VOC: ownership is issued, then traded between investors who disagree about the voyage, then a hidden outcome pays cash to shareholders.

## Goals

- Watch agents buy at IPO, shout take-it-or-leave-it bids/offers, and sometimes trade.
- Show **current state** (cap table) and a **log** of what just happened.
- Keep the world random (`random`); no LLM for beliefs, names, or outcomes.

## Non-goals (v1)

- Order book, bid/ask spread, market makers, candles, technical indicators.
- Player as an investor; forcing trades by hand.
- Browser UI (v2). Drawings/sprites of merchants or ships.
- OpenAI / `OPEN_AI_API_KEY`.
- Updating beliefs from news or the true voyage outcome (price-following `V` is specified in `2026-09-07-pnl-and-belief-updates-design.md`).

## Domain numbers

- One company, **1000** shares outstanding (issued).
- IPO price **$100** / share. Full subscription would raise **$100,000**.
- Ownership of an investor is `shares / 1000`.
- Unsold IPO shares sit in **treasury** (company-owned). They count in the 1000 and receive payout the company keeps.

Voyage terminal **company value** (drawn once at **process start**, independent of all beliefs, kept hidden until voyage resolution):

| Outcome   | Company value | Value per share |
|-----------|---------------|-----------------|
| Lost      | $20,000       | $20             |
| Poor      | $70,000       | $70             |
| Normal    | $130,000      | $130            |
| Excellent | $180,000      | $180            |

Draw with `random.choice` over these four equally. The draw is **hidden** until voyage resolution.

## Agents

- **10** investors. Shuffle this name list (stdlib `random.shuffle`); no API:  
  `Willem, Anna, Pieter, Jan, Maria, Dirck, Geert, Trijn, Hendrick, Lijsbet`.
- Starting cash: use exactly this ladder, then shuffle onto names:  
  `$3,000, $5,000, $8,000, $10,000, $12,000, $15,000, $20,000, $25,000, $40,000, $60,000`  
  (sum $198,000 > $100,000). Full IPO is possible in principle; it need not occur.
- Each investor has a belief vector `(p_lost, p_poor, p_normal, p_excellent)`:
  - Draw four i.i.d. values with `random.random()` (each in `[0, 1)`).
  - If `sum == 0`, retry (vanishingly rare).
  - Normalize: `p_i = x_i / sum(x)` so they **sum to 1**.
  - Beliefs are **uninformed**: they do not depend on the hidden voyage draw.
- Reservation value per share:  
  `V = 20*p_lost + 70*p_poor + 130*p_normal + 180*p_excellent`, then round to **integer cents**. Use this same `V` for the cap table, IPO (`V >= 10000` cents i.e. $100), eligibility, shouts, and takes. An equal-weight belief values a share at the $100 IPO price.

## Clock

**One playback event** = one STEP keypress, or 0.4s in AUTO. Do not batch a whole phase into one event.

1. **IPO events.** 1000 shares at $100. Repeat **passes** until sold out or a pass has zero fills: each pass shuffles investor order and walks it. Each willing buyer (`V >= $100` i.e. `>= 10000` cents, and `cash >= 10000` cents) produces **one event**: they buy `min(shares_left, floor(cash_cents / 10000))`. Log the fill. Unwilling names: no event. After a pass with **no** fills, or when `shares_left == 0`, emit **one** `IPO closed` event (remainder → treasury). Company cash = `100 * shares_sold`. Header during IPO: `IPO` (not `i/40`). Last price during/after IPO is $100 until a secondary fill.
2. **Secondary ticks.** Exactly 40 events, header `1/40` … `40/40`. See trade tick.
3. **Voyage event.** One event after tick 40: header `voyage`, reveal outcome, pay `value_per_share` cash per share to each holder. Treasury payout stays with the company. Log outcome and each investor’s payout. Then freeze (not another 0.4s tick).

**Last trade price:** $100 from IPO; then the last **filled** secondary trade. If no secondary fill, stays $100. **Implied company value** = last price × 1000. Not the hidden truth.

## A trade tick (no order book)

Each of the 40 ticks always consumes one playback event (header `i/40`).

1. Flip 50/50: intended side **sell** or **buy**.
2. If that side has **no eligible** investor, **re-flip once** to the other side.
3. If that side also has none, **skip**: log `no eligible trader`. Do not pick from an empty set.
4. Otherwise shout on the chosen side as below.

**Sell eligible:** `shares >= 1`. **Buy eligible:** `cash >=` that investor’s `V` rounded to cents (enough for 1 share at their own `V`). Treasury never shouts.

**Sell shout**

- Eligible: investors with `shares >= 1`.
- Pick one uniformly.
- Price = that seller’s `V`, rounded to the nearest cent (2 decimal places).
- Size = integer uniform in `1 .. shares_held`.
- Log: `{name} offers {size} @ ${price}`.
- Walk **other** investors in random order. First with `V >= price` and `cash >= price * size` **takes** the full size at `price`. Transfer shares and cash. Log `{taker} takes {size} @ ${price}`.
- If nobody takes, log `nobody takes`.

**Buy shout**

- Eligible: investors with `cash` enough for at least 1 share at their own `V` (`cash >= V` after rounding).
- Pick one uniformly.
- Price = that buyer’s `V`, rounded to nearest cent.
- Max affordable = `floor(cash / price)`. Size = integer uniform in `1 .. max_affordable`.
- Log: `{name} bids {size} @ ${price}`.
- Walk other investors in random order. First with `shares >= size` and `V <= price` sells the full size at `price`.
- Else `nobody takes`.

No partial fills. No standing quotes. One shout per tick.

## Terminal UI

Dependency: `uv add rich`. Sim code must not import `rich`.

`rich.live` layout:

- Header: tick `i/T`, last price, implied value, `voyage: at sea | {outcome}`, `mode: STEP | AUTO`.
- Cap table: name, cash, shares, `%` of 1000, belief `$V/share`. Last row: treasury shares and `%`.
- Log: newest events at the bottom (chronological, last ~20 lines visible). Include IPO fills, shouts, passes/takes, skips, voyage, payouts.

Do **not** show the hidden outcome until voyage resolution.

Pace in AUTO: **0.4s** per tick.

## Playback

Default **STEP**. CLI `--auto` starts in AUTO.

| Key | Action |
|-----|--------|
| Enter or space | Advance one event in STEP |
| `a` | AUTO |
| `s` | STEP |
| `q` | Quit (works in STEP and AUTO) |
| any **other** key while AUTO (including Enter/space) | pause to STEP |

After voyage + payout, freeze on the final frame until `q`.

Implementation: non-blocking stdin on Linux (`termios` / `select`); no extra key-reading library.

## Repo layout

- `sim.py` — state, IPO, ticks, voyage, payout. Stdlib only.
- `ui.py` — Rich table + log. Imports `sim` types/snapshots, not the other way around.
- `main.py` — loop, keys, `--auto`.
- `test_sim.py` — IPO remaining shares / cash; fill when `V` crosses; reject when it does not; payout `value/1000` per share; belief vectors sum to 1.

Run: `uv run python main.py`.

## Error handling

- Rounding: money in cents as `int` internally, or `float` rounded to 2 decimals at every cash/price mutation; pick **integer cents** in implementation so tests are exact.
- If AUTO and the terminal cannot set raw mode, fall back to STEP with Enter.

## Success

A run shows IPO, at least some shouts (takes and/or nobody takes), a moving cap table, then a voyage line and cash payouts, all without touching an LLM.
