# Market formation and negotiated trade quantities

## Purpose

Improve secondary-market formation without forcing trades or adding concepts that the current application does not need. The simulation should remain a small teaching model with a historical basis.

The change should make two ideas visible:

- Investors choose how much capital to subscribe at the IPO instead of automatically spending all available cash.
- A completed secondary trade has a negotiated quantity shaped by both traders' valuations and conviction, with a small amount of seeded randomness.

The implementation remains a single-company, turn-based simulation. Future support for several securities, days containing several turns, and broader market structure is deliberately deferred.

## Historical basis

The 1602 Amsterdam subscription register records investor-chosen commitments that varied widely. The National Archives gives examples ranging from 50 to 85,000 guilders. The simplified IPO should therefore model a chosen subscription amount rather than assume that every willing investor commits all available wealth.

Source: [Dutch National Archives, VOC shares in 1602](https://www.nationaalarchief.nl/beleven/onderwijs/bronnenbox/aandelen-voc-1602)

This is a teaching abstraction. It does not model the VOC's installment calls, forward contracts, transfer administration, or exact historical units.

## Personality terminology

Keep the existing `stubbornness` value in the range `0.2` through `0.9`. Do not add another personality trait.

Interpret stubbornness as conviction in one's own valuation:

```text
conviction = clamp((stubbornness - 0.2) / 0.7, 0, 1)
```

A value near zero follows the latest market price readily. A value near one holds to its own valuation.

Replace the frontend label `conservative` with `holds own view`. Do not describe stubbornness as financial risk tolerance.

## IPO subscriptions

The IPO has one shuffled pass through the investors.

For each investor:

1. The investor is willing only when `v_cents >= IPO_PRICE_CENTS`.
2. Calculate `affordable = cash_cents // IPO_PRICE_CENTS`.
3. Calculate `available = min(affordable, treasury_shares)`.
4. If `available < 1`, skip the investor.
5. Request a seeded random integer from `1` through `available`.
6. Allocate that quantity and transfer the corresponding cash to the company.

Each investor receives one subscription opportunity. Do not repeat passes to spend their remaining cash. Close the IPO after the pass or as soon as the treasury reaches zero. Unsold shares remain in the treasury.

Keep the existing `ipo_fill` and `ipo_closed` events. An IPO fill records the allocated quantity, not the investor's maximum affordable quantity.

## Secondary-trade flow

Keep one initiating order and at most one completed transaction per turn.

### Select the initiator

Keep the existing random choice of buy or sell side, fallback to the other side when necessary, and random selection among eligible investors.

Eligibility remains:

- Sell: owns at least one share.
- Buy: can afford at least one share at the investor's valuation.

### Set the price

Do not add price negotiation.

- A sell offer uses the seller's `v_cents`.
- A buy bid uses the buyer's `v_cents`.

The quoted price becomes the transaction price if a deal occurs.

### Calculate the opening quantity

Remove `MAX_ORDER_SHARES` and the universal 10-share cap.

Calculate the initiator's capacity:

- Sell: shares held.
- Buy: `cash_cents // price_cents`.

Calculate the opening quantity:

```text
opening_quantity = max(1, ceil(capacity * initiator_conviction))
```

The initiator's valuation determines the price. Their conviction determines how much of their capacity they initially propose.

### Select a counterparty

Shuffle the other investors and select the first compatible counterparty with capacity for at least one share.

For a sell offer, a compatible buyer must:

- Have `buyer.v_cents >= price_cents`.
- Have enough cash for at least one share.

For a buy bid, a compatible seller must:

- Have `seller.v_cents <= price_cents`.
- Own at least one share.

Stop after the first compatible counterparty. Do not aggregate fills from several investors. If nobody qualifies, record a failed attempt.

### Calculate the counterproposal

Calculate the maximum quantity that this pair can exchange:

```text
negotiable_max = min(opening_quantity, buyer_affordable_quantity, seller_shares)
```

Calculate the counterparty's favorable price advantage:

```text
buyer_advantage  = max(0, buyer_value_cents - price_cents) / price_cents
seller_advantage = max(0, price_cents - seller_value_cents) / price_cents
price_advantage  = clamp(the counterparty's advantage, 0, 1)
```

Calculate response strength and the counterproposal:

```text
response_strength = counterparty_conviction
                    + (1 - counterparty_conviction) * price_advantage

counterproposal = max(1, ceil(negotiable_max * response_strength))
```

At equal valuations, `price_advantage` is zero. Compatible traders may still transact, and their convictions determine their proposals.

### Settle the negotiated quantity

The deterministic negotiation range is:

```text
range_min = min(counterproposal, negotiable_max)
range_max = negotiable_max
```

Choose the final quantity with the market's seeded random generator:

```text
quantity = rng.randint(range_min, range_max)
```

Transfer `quantity` shares from seller to buyer and `quantity * price_cents` cash from buyer to seller.

The untraded part of the opening quantity expires at the end of the turn. It never becomes a standing order. Do not emit a separate `unfilled` event.

## Event contract

Keep events flat and group them by the existing trade turn. Do not introduce order IDs or nested order events.

Add `tick` to every secondary-market `offer`, `bid`, `trade`, and `nobody_takes` event.

The initiating event records:

```json
{
  "kind": "offer",
  "tick": 12,
  "name": "A",
  "size": 15,
  "price_cents": 10000
}
```

A completed `trade` retains its normalized buyer and seller fields and also records the values needed to explain the negotiation later:

```json
{
  "kind": "trade",
  "tick": 12,
  "buyer": "B",
  "seller": "A",
  "quantity": 10,
  "price_cents": 10000,
  "buyer_value_cents": 12500,
  "seller_value_cents": 10000,
  "buyer_conviction": 0.1,
  "seller_conviction": 0.5,
  "counterproposal": 5,
  "range_min": 5,
  "range_max": 15
}
```

Record these values before `_follow_tape` changes investor valuations. The frontend displays recorded facts and must not reproduce the negotiation equation.

A failed attempt records its side and tick:

```json
{
  "kind": "nobody_takes",
  "tick": 13,
  "side": "buy"
}
```

## Trade-attempt UI

Replace separate offer and result rows with one `TradeAttempt` presentation grouped by tick.

The component starts collapsed. Its collapsed view shows both the initiating order and its result:

```text
Turn 12 · A offered 15 shares at $100
B bought 10 shares · 5 expired
```

A failed attempt shows:

```text
Turn 13 · B bid for 8 shares at $90
No seller accepted
```

Expanding a successful attempt shows the stored explanation:

```text
A valued each share at $100 · conviction 50%
├─ Initial proposal: sell 15 shares

B valued each share at $125 · conviction 10%
├─ Counterproposal: buy 5 shares

└─ Agreement: B bought 10 shares from A at $100 each
```

The expanded view also states how many shares expired when `opening_quantity > quantity`.

Do not list investors who rejected the order. Successful attempts should be visually prominent, while failed attempts should be muted. Expansion must use an accessible button with an accurate `aria-expanded` value and keyboard operation.

The investor tape continues to include a completed trade for both buyer and seller.

## Headless-run corrections

Fix the audit output while it is being used to validate this change.

### IPO proceeds

The value under `ipo.company_cash_cents` must equal:

```text
shares_sold * IPO_PRICE_CENTS
```

Do not export company cash after the treasury voyage payout as IPO proceeds. Use `TOTAL_SHARES` and `IPO_PRICE_CENTS` rather than repeating `1000` or `10000` in `run.py`.

### Ticker frames

The ticker must contain exactly the 40 secondary-market frames, headed `1/40` through `40/40`. It must not include the IPO-closing frame.

Keep the IPO-closing snapshot in the `ipo` phase. Transition to `trade` before recording the first trade frame, not before recording IPO closure.

## Non-goals

Do not add any of the following in this change:

- Forced transactions or a minimum trade count.
- A 100-seed statistical acceptance test.
- Cash reserves, liquidity needs, or capital calls.
- Public news or new belief-update mechanics.
- Another personality trait.
- Price bargaining.
- Standing orders or an order book.
- Multiple counterparties in one turn.
- Multiple securities, market abstractions, days, or multiple turns per day.
- Historical installment accounting, forward contracts, or registered-transfer workflows.

Some runs may have no completed secondary trades. That is an accepted outcome.

## Verification

Use deterministic tests for behavior, not aggregate trade-frequency targets.

Cover at least these cases:

- A willing IPO investor receives one seeded subscription allocation and retains the unused cash.
- Every investor gets at most one IPO subscription opportunity.
- An unwilling or unaffordable investor receives no IPO shares.
- Opening sell quantity follows seller capacity and conviction.
- Opening buy quantity follows affordable capacity and conviction.
- Equal valuations can produce a transaction.
- A favorable valuation gap raises the counterproposal relative to the same personality at no advantage.
- The final quantity stays inside the deterministic negotiation range.
- Only the first compatible counterparty trades.
- Cash and shares remain conserved during a trade.
- No `unfilled` event is emitted.
- Trade events preserve the pre-update valuations, convictions, proposals, and range.
- Buyer and seller investor tapes both include the trade.
- Orders may exceed 10 shares when capacity and conviction support them.
- Headless IPO proceeds exclude treasury payout.
- The headless ticker contains exactly 40 correctly headed frames.
- A fixed seed reproduces the same simulation result.

Run the complete backend tests and frontend lint and build. Finish with:

```bash
cd backend
uv run python run.py --count 10
```

Inspect the ten outputs for exceptions, negative balances, broken share conservation, malformed trade events, and incorrect ticker length. Report trade counts for observation only. Do not fail the change because some or all runs are inactive.
