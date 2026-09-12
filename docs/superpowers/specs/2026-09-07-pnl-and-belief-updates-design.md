# P&L end card and tape-following beliefs

Increment on [2026-09-07-voc-market-sim-design.md](2026-09-07-voc-market-sim-design.md). Spectator terminal, no order book, no LLM. That spec’s non-goal “Updating beliefs from price” is **replaced** by this document.

## Goals

- After voyage payout, show how much each investor won or lost vs their opening cash (dollars and percent).
- During secondary trading, move each investor’s `V` toward filled print prices, like watching deals on the bourse.

## Non-goals

- Running P&L column during play.
- Fake news, rumors, or updates from the hidden voyage outcome.
- Belief updates on IPO fills or on failed shouts (`nobody takes`, `no eligible trader`).
- Showing stubbornness in the UI.
- Updating the four-weight belief vector after opening; only `V` (cents per share) moves.

## Opening cash

On investor creation, store `start_cash_cents` = initial cash (the shuffled ladder). Never change it.

## Beliefs over time

Opening `V` is still computed from the four random weights as in v1, then stored as integer cents.

Each investor also draws stubbornness once:

`s = 0.2 + 0.7 * random.random()`  → Uniform `[0.2, 0.9)`

`s` is not displayed.

**When:** after a **secondary** fill only (buy or sell shout that logs `{name} takes {size} @ ${price}`). Let `P` be that fill price in cents.

**Who:** every investor on the market (including the two counterparties). Treasury is not an investor. (v1 has ten; tests may use fewer.)

**Update** (integer cents):

`V ← round(V + (1 - s) * 0.15 * (P - V))`

Then clamp to `[2000, 18000]` cents ($20 … $180).

Apply this in the **same** playback event as the take, **before** the UI snapshot, so the cap table on that frame already shows the new `V`.

IPO at $100 does not move `V`. A shout with no taker does not move `V`. Voyage does not move `V`.

Shouts, eligibility, and takes on later ticks use the updated `V`. The cap table “belief $/share” column is this `V`.

## End screen (P&L)

Still one voyage playback event: reveal outcome, pay `value_per_share` cash per share, log as today, then **freeze**.

On that frozen frame:

- Header unchanged (now shows the outcome).
- **Replace** the cap table with a results table. Do not show shares or `V` here.
- Log stays in the leftover viewport and still drops old lines.

Results columns:

| Column | Definition |
|--------|------------|
| name | investor name |
| start | `start_cash_cents` |
| end | `cash_cents` after payout |
| total | `end - start` |
| % | `total / start` |

Shares are ignored in `end` (payout already turned them into cash). `start` is never 0 with the v1 ladder.

Format:

- Money: same as the rest of the UI, with an explicit sign on `total` (`+$1,234.56` / `-$1,234.56`). Zero total: `$0.00`.
- `%`: `100 * total / start`, one decimal, with a sign (`+28.0%` / `-12.3%`). Zero: `0.0%`.

Sort rows by `total` descending (best first). Ties: name ascending. No treasury row.

`q` still quits. STEP/AUTO keys do nothing extra on the freeze.

## Tests (`test_sim.py`)

- Fill at `P` moves a low-`s` investor’s `V` toward `P`; a high-`s` investor moves less (same `P`, same starting `V`).
- Failed offer does not change `V`.
- `V` never leaves `[2000, 18000]` after an update.
- After payout, `total == end - start` and displayed `%` is `100 * total / start` for a fixture investor.

## Success

Play looks like v1 until the last frame, except belief `$` drifts after prints. The last frame is a ranking of winners and losers in cash vs opening wallets.
