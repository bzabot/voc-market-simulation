import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  drawBelief,
  reservationCents,
  conviction,
  nudgeV,
  rankPnl,
  investorTape,
  investorNew,
  marketNew,
  marketForTest,
  inspectInvestor,
  createRng,
} from "./sim.js";

function stepUntilIpoClosed(market) {
  while (market.step()) {
    if (market.events.some((e) => e.kind === "ipo_closed")) break;
  }
}

function tradeMarket(investors, side) {
  const rng = createRng(0);
  const market = marketForTest({
    investors,
    rng,
    treasury_shares: 0,
    phase: "trade",
  });
  market.trade_tick = 7;
  const origRandom = rng.random.bind(rng);
  rng.random = () => (side === "sell" ? 0 : 1);
  return { market, restoreRandom: () => { rng.random = origRandom; } };
}

describe("BeliefTests", () => {
  it("drawn beliefs sum to one", () => {
    const rng = createRng(0);
    for (let i = 0; i < 50; i++) {
      const belief = drawBelief(rng);
      assert.equal(belief.length, 4);
      assert.ok(Math.abs(belief[0] + belief[1] + belief[2] + belief[3] - 1) < 1e-9);
    }
  });

  it("reservation uses four payoffs in cents", () => {
    assert.equal(reservationCents([1, 0, 0, 0]), 2000);
    assert.equal(reservationCents([0, 0, 0, 1]), 18000);
    assert.equal(reservationCents([0.25, 0.25, 0.25, 0.25]), 10000);
  });
});

describe("IpoTests", () => {
  it("willing buyer gets one seeded allocation and keeps unused cash", () => {
    const rng = createRng(1);
    const market = marketForTest({
      investors: [
        investorNew({ name: "Anna", cash_cents: 50_000, shares: 0, belief: [0, 0, 0, 1] }),
        investorNew({ name: "Willem", cash_cents: 3_000_00, shares: 0, belief: [1, 0, 0, 0] }),
      ],
      rng,
    });
    const randintCalls = [];
    rng.randint = (a, b) => {
      randintCalls.push([a, b]);
      return 2;
    };
    stepUntilIpoClosed(market);

    const anna = market.investor("Anna");
    const willem = market.investor("Willem");
    assert.equal(anna.shares, 2);
    assert.equal(anna.cash_cents, 30_000);
    assert.equal(willem.shares, 0);
    assert.equal(willem.cash_cents, 3_000_00);
    assert.equal(market.treasury_shares, 998);
    assert.equal(market.company_cash_cents, 2 * 100_00);
    assert.equal(market.last_price_cents, 100_00);
    assert.deepEqual(randintCalls, [[1, 5]]);
  });

  it("each willing investor gets one subscription opportunity", () => {
    const rng = createRng(0);
    const market = marketForTest({
      investors: [
        investorNew({ name: "Anna", cash_cents: 30_000, shares: 0, belief: [0, 0, 0, 1] }),
        investorNew({ name: "Maria", cash_cents: 30_000, shares: 0, belief: [0, 0, 0, 1] }),
      ],
      rng,
    });
    rng.shuffle = () => {};
    const randintCalls = [];
    const effects = [1, 2];
    let idx = 0;
    rng.randint = (a, b) => {
      randintCalls.push([a, b]);
      return effects[idx++];
    };
    stepUntilIpoClosed(market);

    assert.deepEqual(market.investors.map((i) => i.shares), [1, 2]);
    assert.deepEqual(randintCalls, [[1, 3], [1, 3]]);
  });

  it("unwilling investor does not buy at ipo", () => {
    const market = marketForTest({
      investors: [
        investorNew({ name: "Willem", cash_cents: 60_000_00, shares: 0, belief: [1, 0, 0, 0] }),
        investorNew({ name: "Anna", cash_cents: 9_999, shares: 0, belief: [0, 0, 0, 1] }),
      ],
      rng: createRng(0),
    });
    market.step();
    assert.equal(market.investor("Willem").shares, 0);
    assert.equal(market.investor("Anna").shares, 0);
    assert.equal(market.treasury_shares, 1000);
    assert.ok(market.log.at(-1).includes("IPO closed"));
  });
});

describe("TradeTests", () => {
  it("conviction clamps and scales stubbornness", () => {
    assert.equal(conviction(0.0), 0.0);
    assert.equal(conviction(0.55), 0.5);
    assert.equal(conviction(1.0), 1.0);
  });

  it("opening sell quantity uses capacity and conviction over ten", () => {
    const seller = investorNew({
      name: "Pieter", cash_cents: 0, shares: 31, belief: [1, 0, 0, 0], stubbornness: 0.55,
    });
    const buyer = investorNew({ name: "Anna", cash_cents: 100_000, shares: 0, belief: [0, 0, 0, 1] });
    const { market } = tradeMarket([seller, buyer], "sell");
    market.rng.shuffle = () => {};
    market.rng.randint = () => 16;
    market.oneTrade();
    assert.deepEqual(market.events[0], {
      kind: "offer", tick: 7, name: "Pieter", size: 16, price_cents: 2_000,
    });
  });

  it("opening buy quantity uses affordable capacity and conviction", () => {
    const buyer = investorNew({
      name: "Anna", cash_cents: 61_000, shares: 0, belief: [1, 0, 0, 0], stubbornness: 0.55,
    });
    const seller = investorNew({ name: "Pieter", cash_cents: 0, shares: 40, belief: [1, 0, 0, 0] });
    const { market } = tradeMarket([buyer, seller], "buy");
    market.rng.shuffle = () => {};
    market.rng.randint = () => 15;
    market.oneTrade();
    assert.deepEqual(market.events[0], {
      kind: "bid", tick: 7, name: "Anna", size: 15, price_cents: 2_000,
    });
  });

  it("failed sell offer identifies missing buyer", () => {
    const market = marketForTest({
      investors: [investorNew({ name: "Anna", cash_cents: 0, shares: 20, belief: [0, 0, 0, 1] })],
      rng: createRng(0),
      treasury_shares: 0,
      phase: "trade",
    });
    market.oneTrade();
    assert.deepEqual(market.events.at(-1), { kind: "nobody_takes", tick: 0, side: "sell" });
    assert.equal(market.events[0].tick, 0);
  });

  it("failed buy bid identifies missing seller", () => {
    const market = marketForTest({
      investors: [investorNew({ name: "Anna", cash_cents: 50_000_00, shares: 0, belief: [0, 0, 0, 1] })],
      rng: createRng(0),
      treasury_shares: 0,
      phase: "trade",
    });
    market.oneTrade();
    assert.deepEqual(market.events.at(-1), { kind: "nobody_takes", tick: 0, side: "buy" });
    assert.equal(market.events[0].tick, 0);
  });

  it("equal values trade and preserve pre-tape negotiation facts", () => {
    const seller = investorNew({
      name: "Pieter", cash_cents: 0, shares: 20, belief: [0.25, 0.25, 0.25, 0.25], stubbornness: 0.55,
    });
    const buyer = investorNew({
      name: "Anna", cash_cents: 200_000, shares: 0, belief: [0.25, 0.25, 0.25, 0.25], stubbornness: 0.27,
    });
    const { market } = tradeMarket([seller, buyer], "sell");
    market.rng.shuffle = () => {};
    market.rng.randint = () => 8;
    market.oneTrade();

    const trade = market.events.at(-1);
    assert.equal(trade.quantity, 8);
    assert.equal(trade.buyer_value_cents, 10_000);
    assert.equal(trade.seller_value_cents, 10_000);
    assert.ok(Math.abs(trade.buyer_conviction - 0.1) < 1e-9);
    assert.ok(Math.abs(trade.seller_conviction - 0.5) < 1e-9);
    assert.equal(trade.counterproposal, 1);
    assert.deepEqual([trade.range_min, trade.range_max], [1, 10]);
    assert.ok(trade.range_min <= trade.quantity && trade.quantity <= trade.range_max);
    assert.deepEqual(investorTape(market.events, "Anna").map((e) => e.kind), ["trade"]);
    assert.deepEqual(investorTape(market.events, "Pieter").map((e) => e.kind), ["offer", "trade"]);
  });

  it("trade records values before following tape", () => {
    const seller = investorNew({
      name: "Pieter", cash_cents: 0, shares: 20, belief: [0.25, 0.25, 0.25, 0.25], stubbornness: 0.55,
    });
    const buyer = investorNew({
      name: "Anna", cash_cents: 200_000, shares: 0, belief: [1, 0, 0, 0], stubbornness: 0.27, v_cents: 12_500,
    });
    const { market } = tradeMarket([seller, buyer], "sell");
    market.rng.shuffle = () => {};
    market.rng.randint = (low) => low;
    market.oneTrade();
    assert.equal(market.events.at(-1).buyer_value_cents, 12_500);
    assert.notEqual(buyer.v_cents, 12_500);
  });

  it("favorable advantage raises counterproposal", () => {
    function counterproposal(buyerValue) {
      const seller = investorNew({
        name: "Pieter", cash_cents: 0, shares: 20, belief: [0.25, 0.25, 0.25, 0.25], stubbornness: 0.55,
      });
      const buyer = investorNew({
        name: "Anna", cash_cents: 400_000, shares: 0, belief: [1, 0, 0, 0], stubbornness: 0.27, v_cents: buyerValue,
      });
      const { market } = tradeMarket([seller, buyer], "sell");
      market.rng.shuffle = () => {};
      market.rng.randint = (low) => low;
      market.oneTrade();
      return market.events.at(-1).counterproposal;
    }
    assert.ok(counterproposal(15_000) > counterproposal(10_000));
  });

  it("first compatible counterparty alone trades and conserves assets", () => {
    const seller = investorNew({
      name: "Pieter", cash_cents: 0, shares: 20, belief: [1, 0, 0, 0], stubbornness: 0.9,
    });
    const first = investorNew({
      name: "Anna", cash_cents: 6_000, shares: 0, belief: [0, 0, 0, 1], stubbornness: 0.9,
    });
    const second = investorNew({
      name: "Maria", cash_cents: 100_000, shares: 0, belief: [0, 0, 0, 1], stubbornness: 0.9,
    });
    const { market } = tradeMarket([seller, first, second], "sell");
    const cashBefore = market.investors.reduce((s, i) => s + i.cash_cents, 0);
    const sharesBefore = market.investors.reduce((s, i) => s + i.shares, 0);
    market.rng.shuffle = () => {};
    market.rng.randint = (_low, high) => high;
    market.oneTrade();

    const trades = market.events.filter((e) => e.kind === "trade");
    assert.equal(trades.length, 1);
    assert.equal(trades[0].buyer, "Anna");
    assert.equal(first.shares, 3);
    assert.equal(second.shares, 0);
    assert.equal(market.investors.reduce((s, i) => s + i.cash_cents, 0), cashBefore);
    assert.equal(market.investors.reduce((s, i) => s + i.shares, 0), sharesBefore);
    assert.ok(!market.events.some((e) => e.kind === "unfilled"));
  });
});

describe("PayoutTests", () => {
  it("voyage pays value per share", () => {
    const holder = investorNew({
      name: "Jan", cash_cents: 0, shares: 100, belief: [0.25, 0.25, 0.25, 0.25],
    });
    const market = marketForTest({
      investors: [holder],
      rng: createRng(0),
      treasury_shares: 900,
      company_cash_cents: 0,
      phase: "voyage",
      hidden_outcome: "poor",
    });
    market.step();
    assert.equal(market.investor("Jan").cash_cents, 100 * 7000);
    assert.equal(market.company_cash_cents, 900 * 7000);
    assert.equal(market.voyage_shown, "poor");
  });
});

describe("TapeTests", () => {
  it("low stubbornness moves more toward print", () => {
    const jumpy = nudgeV(10_000, 0.2, 20_000);
    const stuck = nudgeV(10_000, 0.9, 20_000);
    assert.ok(jumpy > 10_000);
    assert.ok(stuck > 10_000);
    assert.ok(jumpy > stuck);
  });

  it("failed offer does not change v", () => {
    const seller = investorNew({ name: "Anna", cash_cents: 0, shares: 20, belief: [0, 0, 0, 1] });
    const buyer = investorNew({ name: "Pieter", cash_cents: 50_000_00, shares: 0, belief: [1, 0, 0, 0] });
    const rng = createRng(1);
    const market = marketForTest({
      investors: [seller, buyer], rng, treasury_shares: 0, phase: "trade",
    });
    const v0 = seller.v_cents;
    const v1 = buyer.v_cents;
    rng.random = () => 0;
    market.oneTrade();
    assert.equal(seller.v_cents, v0);
    assert.equal(buyer.v_cents, v1);
  });

  it("nudge clamps to payoff range", () => {
    assert.equal(nudgeV(18_000, 0.0, 30_000), 18_000);
    assert.equal(nudgeV(2_000, 0.0, 0), 2_000);
  });
});

describe("PnlTests", () => {
  it("total and percent vs opening cash", () => {
    const holder = investorNew({
      name: "Jan",
      cash_cents: 0,
      shares: 100,
      belief: [0.25, 0.25, 0.25, 0.25],
      start_cash_cents: 10_000_00,
    });
    const market = marketForTest({
      investors: [holder],
      rng: createRng(0),
      treasury_shares: 900,
      company_cash_cents: 0,
      phase: "voyage",
      hidden_outcome: "poor",
    });
    market.step();
    const row = market.pnlRows()[0];
    assert.equal(row.name, "Jan");
    assert.equal(row.start_cents, 10_000_00);
    assert.equal(row.end_cents, 100 * 7000);
    assert.equal(row.total_cents, 100 * 7000 - 10_000_00);
    assert.ok(Math.abs(row.pct - (100 * row.total_cents) / row.start_cents) < 1e-9);
  });

  it("pnl sorts by total then name", () => {
    const ranked = rankPnl([
      { name: "Carel", start_cents: 100, end_cents: 80, total_cents: -20, pct: -20 },
      { name: "Berta", start_cents: 100, end_cents: 150, total_cents: 50, pct: 50 },
      { name: "Anna", start_cents: 100, end_cents: 150, total_cents: 50, pct: 50 },
    ]);
    assert.deepEqual(ranked.map((r) => r.name), ["Anna", "Berta", "Carel"]);
  });
});

describe("SnapshotTests", () => {
  it("ipo close snapshot precedes first trade snapshot", () => {
    const market = marketForTest({
      investors: [investorNew({ name: "Willem", cash_cents: 0, shares: 0, belief: [1, 0, 0, 0] })],
      rng: createRng(0),
      phase: "trade",
    });
    market.step();
    const ipoClose = market.frames.at(-1);
    market.step();
    const firstTrade = market.frames.at(-1);
    assert.equal(ipoClose.phase, "ipo");
    assert.equal(ipoClose.header, "IPO");
    assert.equal(ipoClose.events.at(-1).kind, "ipo_closed");
    assert.equal(firstTrade.phase, "trade");
    assert.equal(firstTrade.header, "1/40");
  });

  it("step records independent frame", () => {
    const market = marketForTest({
      investors: [
        investorNew({ name: "Anna", cash_cents: 50_000_00, shares: 0, belief: [0, 0, 0, 1] }),
      ],
      rng: createRng(1),
    });
    market.step();
    const frame = market.frames.at(-1);
    const cashAfterFirst = frame.investors[0].cash_cents;
    market.investor("Anna").cash_cents = 1;
    assert.equal(frame.investors[0].cash_cents, cashAfterFirst);
    assert.notEqual(market.investor("Anna").cash_cents, cashAfterFirst);
  });

  it("frame has stubbornness not hidden outcome", () => {
    const market = marketForTest({
      investors: [
        investorNew({
          name: "Willem",
          cash_cents: 60_000_00,
          shares: 0,
          belief: [1, 0, 0, 0],
          stubbornness: 0.8,
        }),
      ],
      rng: createRng(0),
    });
    market.step();
    const frame = market.frames.at(-1);
    assert.ok(!("hidden_outcome" in frame));
    assert.equal(frame.voyage_shown, null);
    assert.equal(frame.investors[0].stubbornness, 0.8);
  });

  it("voyage frame shows outcome not hidden field", () => {
    const holder = investorNew({
      name: "Jan", cash_cents: 0, shares: 100, belief: [0.25, 0.25, 0.25, 0.25],
    });
    const market = marketForTest({
      investors: [holder],
      rng: createRng(0),
      treasury_shares: 900,
      company_cash_cents: 0,
      phase: "voyage",
      hidden_outcome: "poor",
    });
    market.step();
    const frame = market.frames.at(-1);
    assert.equal(frame.voyage_shown, "poor");
    assert.ok(!("hidden_outcome" in frame));
    assert.equal(frame.done, true);
  });

  it("ipo fill event includes name", () => {
    const market = marketForTest({
      investors: [
        investorNew({ name: "Anna", cash_cents: 50_000_00, shares: 0, belief: [0, 0, 0, 1] }),
        investorNew({ name: "Willem", cash_cents: 3_000_00, shares: 0, belief: [1, 0, 0, 0] }),
      ],
      rng: createRng(1),
    });
    market.step();
    const ev = market.events[0];
    assert.equal(ev.kind, "ipo_fill");
    assert.equal(ev.name, "Anna");
    assert.equal(ev.size, market.investor("Anna").shares);
    assert.ok(ev.size >= 1 && ev.size < 501);
  });

  it("new accepts seed", () => {
    const a = marketNew({ seed: 42 });
    const b = marketNew({ seed: 42 });
    while (a.step());
    while (b.step());
    assert.deepEqual(a.snapshot(), b.snapshot());
  });
});

describe("TapeTestsFilter", () => {
  it("investor tape keeps events involving name", () => {
    const events = [
      { kind: "ipo_fill", name: "Anna", size: 10 },
      { kind: "offer", name: "Pieter", size: 2 },
      { kind: "trade", buyer: "Anna", seller: "Pieter", quantity: 2 },
      { kind: "payout", name: "Willem", size: 1 },
    ];
    const tape = investorTape(events, "Anna");
    assert.deepEqual(tape.map((e) => e.kind), ["ipo_fill", "trade"]);
    assert.equal(investorTape(events, "Pieter")[0].kind, "offer");
    assert.equal(investorTape(events, "Pieter")[1].kind, "trade");
  });
});

describe("inspectInvestor", () => {
  it("returns tape and pnl fields for named investor", () => {
    const seller = investorNew({
      name: "Pieter", cash_cents: 0, shares: 20, belief: [0.25, 0.25, 0.25, 0.25], stubbornness: 0.55,
    });
    const buyer = investorNew({
      name: "Anna", cash_cents: 200_000, shares: 0, belief: [0.25, 0.25, 0.25, 0.25], stubbornness: 0.27,
    });
    const { market } = tradeMarket([seller, buyer], "sell");
    market.rng.shuffle = () => {};
    market.rng.randint = () => 8;
    market.oneTrade();
    const info = inspectInvestor(market, "Anna");
    assert.equal(info.name, "Anna");
    assert.equal(info.start_cents, buyer.start_cash_cents);
    assert.equal(info.end_cents, buyer.cash_cents);
    assert.equal(info.total_cents, info.end_cents - info.start_cents);
    assert.equal(info.stubbornness, 0.27);
    assert.deepEqual(info.tape.map((e) => e.kind), ["trade"]);
  });
});
