# Gathering turn

Replace the single random shout with one gathering per trade turn. The IPO, the voyage, the forty turns, and the tape nudge stay.

## Belief and plaque

A belief is the most someone will pay, and the least they will accept. The plaque is the price. At one plaque price a person takes one side.

- Buying: belief is above the plaque, and cash can buy at least one share at that price.
- Selling: belief is below the plaque, and they hold at least one share.
- Waiting: the belief equals the plaque, or they lack the cash or the shares for the side their belief wants.

Someone with cash and shares can buy on one turn and sell on a later one. They are never in both stacks at the same price.

## Morning step

On each trade turn, before the crowd forms, every belief takes a small private step up or down. The direction comes from the market's seeded generator. The size is

```text
round((1 - stubbornness) * 800)
```

cents, then clamped to the existing $20–$180 range. A flexible person steps further than a stubborn one. The step does not walk toward the last sale. The tape nudge after a sale remains the social pull. The step does not use the voyage. A turn with no trade still takes the step. The IPO does not. A stubbornness of 1 does not step. Drawn investors are below that.

## The gathering

The plaque opens halfway between the last sale and the median belief of every investor:

```text
open = round(0.5 * last_sale + 0.5 * median_belief)
```

Count buyers and sellers at that price.

- The counts match, and someone is there. They trade at that price.
- More buyers than sellers. Raise the plaque to the next cent that changes the crowd.
- More sellers than buyers. Lower it the same way.
The next step would leave the heavy side empty. If both sides are still present at the current plaque, the short side trades there. If one side is empty, there is no sale: the posted open becomes the last price, and every belief is pulled to that open by at least the full gap, or by `round((1 - stubbornness) * 800)` when that is larger. A miss is rare and loud. It does not leave the square stuck for a run of turns.

The cents that change the crowd, moving up:

- A buyer's belief. Landing on it makes him wait.
- One cent above a holder's belief. He becomes a seller.
- One cent above a buyer's cash. He can no longer pay for a share.

Moving down, the mirror: land on a seller's belief and he waits. One cent below a person's belief, if he can pay that price, and he becomes a buyer.

Jump from event to event. Do not walk every cent. If two events share a cent, apply them together.

When the counts match, pair buyers from the highest belief down with sellers from the lowest belief up. Ties break by name. Each pair exchanges as many shares as the buyer can pay for and the seller holds, using balances from before any pair in this turn settles. Then apply every transfer.

One sale is enough to move the last price to the closing plaque. No sale leaves the last price where it was.

After one or more sales, the existing nudge runs once, toward that closing price, for every investor. It does not run on a miss; the miss pull above runs instead.

## Event

One `gathering` event per trade turn. Flat trades, no order id.

```json
{
  "kind": "gathering",
  "tick": 12,
  "open_cents": 10000,
  "close_cents": 13000,
  "reason": "rose",
  "trigger": { "name": "Jan", "kind": "dropped" },
  "wanted_cents": null,
  "crowd": [{ "name": "Anna", "stance": "buying" }, { "name": "Hendrick", "stance": "selling" }],
  "trades": [{ "buyer": "Anna", "seller": "Hendrick", "quantity": 40, "price_cents": 13000 }]
}
```

`reason` is `held`, `rose`, `fell`, or `none`. `trigger` is the person who caused the last move: `dropped`, `entered`, or `priced_out`. It is null when the price never moved. On `none`, `wanted_cents` is the price the crowd refused, or null when nobody was on either side to begin with. `crowd` is who was buying or selling at the close, before the shares moved. `trades` is empty when nobody dealt.

`investorTape` keeps a gathering when any trade names that investor as buyer or seller, and keeps only those bargains on the personal copy. The main ticker still shows every bargain.

## Screen

The chart, masthead, timeline, controls, and replay stay. The masthead price is the plaque. The chart is the plaque across the voyage.

Add a floor panel between the chart and the ownership board. It reads the gathering on the frame being shown, including while scrubbing. During the IPO and the voyage it stays quiet.

The floor shows the open and the close, one sentence, two stacks, and one line per bargain.

- Held: both sides were already there.
- Rose, trigger dropped: the plaque rose until that person dropped out.
- Rose, trigger entered: the plaque rose until that person would sell.
- Rose, trigger priced_out: the plaque rose until that person could not pay.
- Fell: the same sentences, with buyers and sellers swapped.
- None, with a wanted price: buyers or sellers would not follow to that price.
- None, without one: no one came to the plaque.

Buying and Selling use the investor colors. Someone who was in the square and is not in those stacks is a dim name under them. Bargains read "Anna buys 40 from Hendrick." The plaque number is the only motion, and it finishes inside the 400ms step.

The ownership board keeps its rows. The chip that says "≥ mkt" or "< mkt" becomes Buying, Selling, or Waiting, from the belief, cash, and shares after the turn. Selling does not use the loss color. That chip is the stance now. The floor is who stood there before the shares moved. Those lists can differ after someone spends their cash.

The ticker stays. Remove `TradeAttempt`. A gathering is one line: the turn, the plaque change, and the bargains. IPO lines and the voyage stay. The replay personal tape uses the same line shape with only that investor's bargains.

## Tests

Replace the shout, quantity, and conviction trade tests. Keep the nudge unit tests and the IPO and voyage tests.

- A person is a buyer, a seller, or waiting, and never both.
- Equal sides at the open price trade at that price. The keenest buyer is paired with the keenest seller.
- The Anna, Jan, and Hendrick case: open $100, beliefs $150, $130, and $120, closes at $130, Jan has dropped, Anna buys from Hendrick.
- The mirror case, where the plaque falls until one seller drops.
- A refused step does not change the last price, records the wanted price, has already drifted beliefs, and does not nudge.
- Two pairs draw from balances before either transfer. Cash and shares are conserved.
- A flexible belief steps further than a stubborn one, and both stay inside $20–$180.
- A trade nudges every belief toward the close, once.
- The investor tape finds a name inside a gathering's trades.
- Two markets with the same seed still finish equal.

## Out of this

No resting book, no second auction, no lot smaller than what both sides can trade, and no drift during the IPO. The player does not trade yet.
