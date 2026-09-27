# Human player

Make one of the ten investors playable in the browser. No backend, no database, no new market rules beyond letting that seat act with permission. Prioritize a clear dock and honest previews over clever automation.

Gathering, IPO shuffle, forty trade turns, voyage payout, and NPC behavior stay as in `gathering-turn.md`. This spec only adds the human seat.

## Setup

Before a run starts, a light panel asks for:

- A nickname (required)
- Which of the ten named seats is you (required)

There is no belief control. Cash for your seat is still drawn from the existing ladder. Nickname and last chosen seat persist in `localStorage` so New run can start quickly; either field stays editable.

On the board and in the tape, that seat reads `{Nickname} (You)`. The Dutch name for that slot is replaced, not shown beside the nickname.

## Belief

Your seat has no useful belief. You do not morning-step, you do not take a tape nudge, and you do not appear on the belief chart. NPCs keep the full belief path. Stance chips and gathering stacks for you come only from the action you chose that turn, never from a reservation price.

## Auto vs manual

While Auto is on, you are a spectator. The market steps as today. Your seat never buys or sells — not at IPO, not in gathering. Any leftover Buy/Sell choice is ignored for as long as Auto runs.

While Auto is off, you trade only by explicit permission on the turn you are about to Step. Nothing fills without that permission.

## IPO

NPC subscriptions are unchanged. When the shuffled pass reaches your seat:

- Auto on → treat as Skip (no shares).
- Auto off → the dock offers Subscribe (you pick quantity) or Skip.

Quantity is whatever you enter, clamped to `1…min(floor(cash / IPO price), shares still in the treasury)`. Subscribe moves cash and shares exactly like an NPC fill at $100. After you Subscribe or Skip, the dock shows Subscribed or Passed until IPO closes.

While other names are filling, the dock is disabled and says you are waiting for your turn in the offering.

## Trade turns

One side per turn: Buy, Sell, or Skip. You pick the share quantity yourself. Default the field to 1 when a new choice starts; Max is a convenience, not a forced size.

Before Step, the dock shows an **open plaque preview** using the same open formula as the sim (`round(0.5 * last_sale + 0.5 * median belief of investors who still have beliefs)` — your seat is omitted from that median). Clamp Max buy/sell to cash and shares at that preview price.

Then Step runs the real gathering. The plaque may still rise or fall. You join only the side you chose, with quantity up to what you set, and only if you can still pay or deliver at the closing plaque. Pairing and balance rules match NPC pairs: keenest opposing NPC beliefs first, quantities from pre-settlement balances, partial fills when the other side is thin. If nobody is opposite you, you get nothing that turn.

Skip (or Step with no Buy/Sell chosen) leaves you waiting. The choice does not carry to the next turn; each manual trade turn needs a fresh Buy, Sell, or Skip.

You never Buy and Sell on the same turn.

## Player dock

A persistent dock for your seat (nickname, cash, shares) sits with the floor/board — the primary place to act.

| Moment | Dock |
|--------|------|
| Auto on | Actions disabled. Short reason: spectator while Auto runs. |
| IPO, waiting for your pass | Subscribe disabled; waiting copy. |
| IPO, your pass, Auto off | Quantity + Subscribe / Skip. |
| IPO, after you acted | Subscribed or Passed. |
| Trade, Auto off | Open preview, quantity, Buy / Sell / Skip, then Step as today. |
| Voyage / done | Quiet; cash and shares still visible. |

Transport controls (Step, Auto, Previous, Live, New run) and keyboard shortcuts for those stay. Buy/Sell/Skip live in the dock, not in the transport bar.

## Tape and replay

Your bargains show on the main ticker and on your personal tape like any other name, under `{Nickname} (You)`. Replay P&L and the ledger include your seat. Scrubbing history does not let you revise past actions.

## Checks

- With Auto on through a full run, your cash and shares change only from IPO Skip (no buy) and from the voyage payout on shares you somehow already held — never from secondary trades. A run where you never subscribed leaves you at start cash and zero shares until voyage (voyage pays zero).
- Auto off, IPO Subscribe for `q` shares: cash down `q * $100`, shares up `q`, treasury down `q`.
- Auto off, Buy `q` on a trade turn with enough sellers: you receive at most `q` shares; cash and shares conserved with counterparties; gathering event lists you as buyer.
- Auto off, Sell with no buyers: no transfer; you still waited that turn.
- Belief chart and morning-step paths never include your seat.
- Two markets with the same seed and the same scripted human actions finish equal; without human actions, existing seed equality tests still hold for the nine NPCs plus your idle seat.

## Out of this

No backend, no accounts, no order book, no resting limit orders, no sticky multi-turn intent, no belief editor, no forced pause for input while Auto runs, and no second confirm after the plaque closes.
