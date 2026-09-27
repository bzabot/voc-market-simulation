import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  drawBelief,
  reservationCents,
  morningStep,
  medianBeliefCents,
  openPlaqueCents,
  stanceAt,
  nudgeV,
  rankPnl,
  investorTape,
  investorNew,
  marketNew,
  marketForTest,
  inspectInvestor,
  createRng,
  displayName,
  npcInvestors,
  openPlaquePreview,
  TRADE_TICKS,
} from "./sim.js";

function stepUntilIpoClosed(market) {
  while (market.step()) {
    if (market.events.some((e) => e.kind === "ipo_closed")) break;
  }
}

function tradeMarket(investors, { tick = 1, random } = {}) {
  const rng = createRng(1);
  if (random) rng.random = random;
  const market = marketForTest({
    investors,
    rng,
    treasury_shares: 0,
    phase: "trade",
  });
  market.trade_tick = tick;
  market.last_price_cents = 10_000;
  return market;
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

describe("GatheringTests", () => {
  const still = { stubbornness: 1, belief: [0, 0, 0, 1] };

  it("stance is buying, selling, or waiting, and never both", () => {
    const both = investorNew({ name: "Anna", cash_cents: 50_000, shares: 10, v_cents: 15_000, ...still });
    assert.equal(stanceAt(both, 10_000), "buying");
    assert.equal(stanceAt(both, 15_000), "waiting");
    assert.equal(stanceAt(both, 16_000), "selling");
    const broke = investorNew({ name: "Jan", cash_cents: 100, shares: 0, v_cents: 15_000, ...still });
    assert.equal(stanceAt(broke, 10_000), "waiting");
    const holder = investorNew({ name: "Dirck", cash_cents: 0, shares: 5, v_cents: 8_000, ...still });
    assert.equal(stanceAt(holder, 10_000), "selling");
    assert.equal(stanceAt(holder, 8_000), "waiting");
  });

  it("morning step is a private revision sized by stubbornness", () => {
    const flex = morningStep(10_000, 0.2, true);
    const stub = morningStep(10_000, 0.9, true);
    assert.ok(flex - 10_000 > stub - 10_000);
    assert.equal(morningStep(10_000, 0.2, false), 10_000 - (flex - 10_000));
    assert.equal(morningStep(2_000, 0.2, false), 2_000);
    assert.equal(morningStep(18_000, 0.2, true), 18_000);
    assert.equal(morningStep(15_000, 1, true), 15_000);
  });

  it("open plaque blends the last sale with the median belief", () => {
    const crowd = [
      investorNew({ name: "Anna", cash_cents: 50_000, shares: 0, v_cents: 18_000, ...still }),
      investorNew({ name: "Jan", cash_cents: 50_000, shares: 0, v_cents: 10_000, ...still }),
      investorNew({ name: "Dirck", cash_cents: 0, shares: 5, v_cents: 10_000, ...still }),
      investorNew({ name: "Maria", cash_cents: 0, shares: 5, v_cents: 10_000, ...still }),
    ];
    assert.equal(medianBeliefCents(crowd), 10_000);
    assert.equal(openPlaqueCents(10_000, crowd), 10_000);
    assert.equal(openPlaqueCents(12_000, crowd), 11_000);
  });

  it("a lone optimist leaves the open near the crowd, with one buyer and many sellers", () => {
    const investors = [
      investorNew({ name: "Anna", cash_cents: 500_000, shares: 0, v_cents: 18_000, ...still }),
      ...["Jan", "Dirck", "Maria", "Pieter", "Geert", "Willem", "Trijn", "Hendrick", "Lijsbet"].map(
        (name) => investorNew({ name, cash_cents: 0, shares: 10, v_cents: 10_000, ...still }),
      ),
    ];
    assert.equal(medianBeliefCents(investors), 10_000);
    assert.equal(openPlaqueCents(12_000, investors), 11_000);
    assert.equal(investors.filter((inv) => stanceAt(inv, 11_000) === "buying").length, 1);
    assert.equal(investors.filter((inv) => stanceAt(inv, 11_000) === "selling").length, 9);
  });

  it("equal sides trade at the open price, keenest buyer with keenest seller", () => {
    const anna = investorNew({ name: "Anna", cash_cents: 30_000, shares: 0, v_cents: 15_000, ...still });
    const jan = investorNew({ name: "Jan", cash_cents: 100_000, shares: 0, v_cents: 12_000, ...still });
    const dirck = investorNew({ name: "Dirck", cash_cents: 0, shares: 10, v_cents: 7_000, ...still });
    const maria = investorNew({ name: "Maria", cash_cents: 0, shares: 2, v_cents: 9_000, ...still });
    const market = tradeMarket([anna, jan, dirck, maria]);
    const cashBefore = market.investors.reduce((s, i) => s + i.cash_cents, 0);
    const sharesBefore = market.investors.reduce((s, i) => s + i.shares, 0);
    market.oneTrade();

    const gathering = market.events.at(-1);
    assert.equal(gathering.kind, "gathering");
    assert.equal(gathering.reason, "held");
    assert.equal(gathering.trigger, null);
    assert.equal(gathering.open_cents, 10_250);
    assert.equal(gathering.close_cents, 10_250);
    assert.equal(gathering.trades.length, 2);
    assert.equal(gathering.trades[0].buyer, "Anna");
    assert.equal(gathering.trades[0].seller, "Dirck");
    assert.equal(gathering.trades[0].quantity, 2);
    assert.equal(gathering.trades[0].price_cents, 10_250);
    assert.equal(gathering.trades[0].cash_cents, 20_500);
    assert.equal(gathering.trades[0].buyer_cash_cents, 9_500);
    assert.equal(gathering.trades[0].buyer_shares, 2);
    assert.equal(gathering.trades[0].seller_cash_cents, 20_500);
    assert.equal(gathering.trades[0].seller_shares, 8);
    assert.equal(gathering.trades[1].buyer, "Jan");
    assert.equal(gathering.trades[1].seller, "Maria");
    assert.equal(gathering.trades[1].quantity, 2);
    assert.equal(gathering.trades[1].cash_cents, 20_500);
    assert.equal(anna.shares, 2);
    assert.equal(anna.cash_cents, 9_500);
    assert.equal(jan.shares, 2);
    assert.equal(jan.cash_cents, 79_500);
    assert.equal(dirck.shares, 8);
    assert.equal(dirck.cash_cents, 20_500);
    assert.equal(maria.shares, 0);
    assert.equal(maria.cash_cents, 20_500);
    assert.equal(market.investors.reduce((s, i) => s + i.cash_cents, 0), cashBefore);
    assert.equal(market.investors.reduce((s, i) => s + i.shares, 0), sharesBefore);
    assert.equal(market.last_price_cents, 10_250);
  });

  it("plaque rises until the extra buyer drops out", () => {
    const anna = investorNew({ name: "Anna", cash_cents: 40 * 13_000, shares: 0, v_cents: 15_000, ...still });
    const jan = investorNew({ name: "Jan", cash_cents: 500_000, shares: 0, v_cents: 13_000, ...still });
    const hendrick = investorNew({ name: "Hendrick", cash_cents: 0, shares: 40, v_cents: 12_000, ...still });
    const market = tradeMarket([anna, jan, hendrick], { tick: 12 });
    market.oneTrade();

    const gathering = market.events.at(-1);
    assert.equal(gathering.reason, "rose");
    assert.equal(gathering.open_cents, 11_500);
    assert.equal(gathering.close_cents, 13_000);
    assert.deepEqual(gathering.trigger, { name: "Jan", kind: "dropped" });
    assert.equal(gathering.wanted_cents, null);
    assert.deepEqual(gathering.crowd, [
      { name: "Anna", stance: "buying" },
      { name: "Hendrick", stance: "selling" },
    ]);
    assert.equal(gathering.trades.length, 1);
    assert.equal(gathering.trades[0].buyer, "Anna");
    assert.equal(gathering.trades[0].seller, "Hendrick");
    assert.equal(gathering.trades[0].quantity, 40);
    assert.equal(gathering.trades[0].price_cents, 13_000);
    assert.equal(gathering.trades[0].cash_cents, 520_000);
    assert.equal(gathering.trades[0].buyer_shares, 40);
    assert.equal(gathering.trades[0].seller_shares, 0);
    assert.equal(market.last_price_cents, 13_000);
    assert.equal(anna.shares, 40);
    assert.equal(hendrick.shares, 0);
  });

  it("plaque falls until the extra seller drops out", () => {
    const anna = investorNew({ name: "Anna", cash_cents: 200_000, shares: 0, v_cents: 15_000, ...still });
    const dirck = investorNew({ name: "Dirck", cash_cents: 0, shares: 10, v_cents: 7_000, ...still });
    const maria = investorNew({ name: "Maria", cash_cents: 0, shares: 10, v_cents: 9_000, ...still });
    const market = tradeMarket([anna, dirck, maria]);
    market.oneTrade();

    const gathering = market.events.at(-1);
    assert.equal(gathering.reason, "fell");
    assert.equal(gathering.open_cents, 9_500);
    assert.equal(gathering.close_cents, 9_000);
    assert.deepEqual(gathering.trigger, { name: "Maria", kind: "dropped" });
    assert.equal(gathering.trades.length, 1);
    assert.equal(gathering.trades[0].buyer, "Anna");
    assert.equal(gathering.trades[0].seller, "Dirck");
    assert.equal(gathering.trades[0].quantity, 10);
    assert.equal(gathering.trades[0].price_cents, 9_000);
    assert.equal(gathering.trades[0].cash_cents, 90_000);
    assert.equal(market.last_price_cents, 9_000);
  });

  it("plaque falls until a buyer will enter", () => {
    const willem = investorNew({ name: "Willem", cash_cents: 200_000, shares: 0, v_cents: 8_000, ...still });
    const dirck = investorNew({ name: "Dirck", cash_cents: 0, shares: 5, v_cents: 7_000, ...still });
    const maria = investorNew({ name: "Maria", cash_cents: 0, shares: 5, v_cents: 12_000, ...still });
    const pieter = investorNew({ name: "Pieter", cash_cents: 0, shares: 0, v_cents: 13_000, ...still });
    const market = tradeMarket([willem, dirck, maria, pieter]);
    market.oneTrade();

    const gathering = market.events.at(-1);
    assert.equal(gathering.reason, "fell");
    assert.equal(gathering.open_cents, 10_000);
    assert.equal(gathering.close_cents, 7_999);
    assert.deepEqual(gathering.trigger, { name: "Willem", kind: "entered" });
    assert.equal(gathering.trades[0].buyer, "Willem");
    assert.equal(gathering.trades[0].seller, "Dirck");
  });

  it("plaque rises until a buyer can no longer pay", () => {
    const anna = investorNew({ name: "Anna", cash_cents: 500_000, shares: 0, v_cents: 15_000, ...still });
    const jan = investorNew({ name: "Jan", cash_cents: 10_500, shares: 0, v_cents: 14_000, ...still });
    const hendrick = investorNew({ name: "Hendrick", cash_cents: 0, shares: 4, v_cents: 8_000, ...still });
    const pieter = investorNew({ name: "Pieter", cash_cents: 0, shares: 0, v_cents: 6_000, ...still });
    const market = tradeMarket([anna, jan, hendrick, pieter]);
    market.oneTrade();

    const gathering = market.events.at(-1);
    assert.equal(gathering.reason, "rose");
    assert.equal(gathering.open_cents, 10_500);
    assert.equal(gathering.close_cents, 10_501);
    assert.deepEqual(gathering.trigger, { name: "Jan", kind: "priced_out" });
    assert.equal(gathering.trades[0].buyer, "Anna");
    assert.equal(gathering.trades[0].seller, "Hendrick");
  });

  it("a refused step posts the plaque, records the wanted price, and pulls beliefs toward it", () => {
    const anna = investorNew({
      name: "Anna", cash_cents: 500_000, shares: 0, v_cents: 15_000, stubbornness: 0.2, belief: [0, 0, 0, 1],
    });
    const market = tradeMarket([anna], { random: () => 0 });
    market.oneTrade();

    const gathering = market.events.at(-1);
    assert.equal(gathering.reason, "none");
    assert.equal(gathering.heavy, "buyers");
    assert.equal(gathering.wanted_cents, 14_360);
    assert.equal(gathering.open_cents, 12_180);
    assert.equal(gathering.close_cents, 12_180);
    assert.deepEqual(gathering.trades, []);
    assert.equal(market.last_price_cents, 12_180);
    assert.equal(anna.v_cents, 12_180);
    assert.deepEqual(gathering.crowd, [{ name: "Anna", stance: "buying" }]);
  });

  it("a short side still trades when the plaque cannot fully balance", () => {
    const anna = investorNew({ name: "Anna", cash_cents: 500_000, shares: 0, v_cents: 11_000, ...still });
    const jan = investorNew({ name: "Jan", cash_cents: 500_000, shares: 0, v_cents: 11_000, ...still });
    const dirck = investorNew({ name: "Dirck", cash_cents: 0, shares: 20, v_cents: 10_000, ...still });
    const market = tradeMarket([anna, jan, dirck]);
    market.oneTrade();
    const gathering = market.events.at(-1);
    assert.equal(gathering.open_cents, 10_500);
    assert.equal(gathering.close_cents, 10_500);
    assert.ok(gathering.trades.length >= 1);
    assert.equal(gathering.trades[0].buyer, "Anna");
    assert.equal(gathering.trades[0].seller, "Dirck");
    assert.equal(gathering.crowd.filter((p) => p.stance === "buying").length, 2);
    assert.equal(gathering.crowd.filter((p) => p.stance === "selling").length, 1);
  });

  it("nobody at the plaque leaves no wanted price", () => {
    const anna = investorNew({ name: "Anna", cash_cents: 50_000, shares: 10, v_cents: 10_000, ...still });
    const market = tradeMarket([anna]);
    market.oneTrade();
    const gathering = market.events.at(-1);
    assert.equal(gathering.reason, "none");
    assert.equal(gathering.wanted_cents, null);
    assert.equal(gathering.trigger, null);
    assert.deepEqual(gathering.trades, []);
    assert.deepEqual(gathering.crowd, []);
  });

  it("a run of seeds does not freeze the plaque for long", () => {
    let worstStreak = 0;
    let worstMissStreak = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const market = marketNew({ seed });
      while (market.step());
      const gatherings = market.events.filter((e) => e.kind === "gathering");
      let streak = 1;
      let missRun = 0;
      for (let i = 0; i < gatherings.length; i++) {
        if (gatherings[i].trades.length === 0) {
          missRun += 1;
          worstMissStreak = Math.max(worstMissStreak, missRun);
        } else {
          missRun = 0;
        }
        if (i === 0) continue;
        if (gatherings[i].close_cents === gatherings[i - 1].close_cents) {
          streak += 1;
          worstStreak = Math.max(worstStreak, streak);
        } else {
          streak = 1;
        }
      }
    }
    assert.ok(worstStreak <= 8);
    assert.ok(worstMissStreak <= 4);
  });

  it("a full run keeps every share and gathers once a turn", () => {
    const market = marketNew({ seed: 7 });
    while (market.step());
    const held = market.investors.reduce((sum, inv) => sum + inv.shares, 0);
    assert.equal(held + market.treasury_shares, 1000);
    assert.equal(market.phase, "voyage");
    const gatherings = market.events.filter((e) => e.kind === "gathering");
    assert.equal(gatherings.length, 40);
    for (const gathering of gatherings) {
      assert.ok(["held", "rose", "fell", "none"].includes(gathering.reason));
      if (gathering.trades.length > 0) assert.equal(gathering.close_cents, gathering.trades[0].price_cents);
    }
  });

  it("a trade nudges every belief toward the close once", () => {
    const anna = investorNew({
      name: "Anna", cash_cents: 500_000, shares: 0, v_cents: 15_000, stubbornness: 0.2, belief: [0, 0, 0, 1],
    });
    const dirck = investorNew({
      name: "Dirck", cash_cents: 0, shares: 20, v_cents: 8_000, stubbornness: 0.2, belief: [1, 0, 0, 0],
    });
    const pieter = investorNew({
      name: "Pieter", cash_cents: 0, shares: 0, v_cents: 10_000, stubbornness: 0.9, belief: [0.25, 0.25, 0.25, 0.25],
    });
    const market = tradeMarket([anna, dirck, pieter], { random: () => 0 });
    market.oneTrade();

    const close = market.last_price_cents;
    assert.equal(close, 9_960);
    assert.equal(anna.v_cents, nudgeV(morningStep(15_000, 0.2, false), 0.2, close));
    assert.equal(dirck.v_cents, nudgeV(morningStep(8_000, 0.2, false), 0.2, close));
    assert.equal(pieter.v_cents, nudgeV(morningStep(10_000, 0.9, false), 0.9, close));
    const twice = nudgeV(anna.v_cents, 0.2, close);
    assert.notEqual(anna.v_cents, twice);
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

  it("ipo does not step beliefs", () => {
    const rng = createRng(1);
    const market = marketForTest({
      investors: [
        investorNew({
          name: "Anna", cash_cents: 50_000, shares: 0, belief: [0, 0, 1, 0], stubbornness: 0.2,
        }),
      ],
      rng,
    });
    stepUntilIpoClosed(market);
    assert.equal(market.investor("Anna").v_cents, 13_000);
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
      {
        kind: "gathering",
        tick: 3,
        open_cents: 10_000,
        close_cents: 10_000,
        trades: [
          { buyer: "Anna", seller: "Pieter", quantity: 2, price_cents: 10_000 },
          { buyer: "Jan", seller: "Maria", quantity: 5, price_cents: 10_000 },
        ],
      },
      { kind: "payout", name: "Willem", size: 1 },
    ];
    const tape = investorTape(events, "Anna");
    assert.deepEqual(tape.map((e) => e.kind), ["ipo_fill", "gathering"]);
    assert.deepEqual(tape[1].trades, [
      { buyer: "Anna", seller: "Pieter", quantity: 2, price_cents: 10_000 },
    ]);
    assert.equal(investorTape(events, "Pieter")[0].trades.length, 1);
    assert.equal(investorTape(events, "Willem").length, 1);
    assert.equal(investorTape(events, "Dirck").length, 0);
  });
});

describe("HumanPlayer", () => {
  const still = { stubbornness: 1, belief: [0, 0, 0, 1] };
  const you = displayName("Zed");

  function humanInvestor(fields) {
    const inv = investorNew({ name: you, seat: "Anna", ...fields });
    inv.is_human = true;
    return inv;
  }

  function humanMarket(seed) {
    return marketNew({ seed, human: { seat: "Anna", nickname: "Zed" } });
  }

  it("keeps the seat idle through a full auto run", () => {
    const market = humanMarket(5);
    while (market.step());
    const human = market.investor(you);
    assert.equal(human.is_human, true);
    assert.equal(human.seat, "Anna");
    assert.equal(human.shares, 0);
    assert.equal(human.cash_cents, human.start_cash_cents);
    assert.ok(!market.events.some((e) => e.kind === "ipo_fill" && e.name === you));
    const trades = market.events.filter((e) => e.kind === "gathering").flatMap((e) => e.trades);
    assert.ok(!trades.some((t) => t.buyer === you || t.seller === you));
    assert.equal(market.events.find((e) => e.kind === "payout" && e.name === you).price_cents, 0);
  });

  it("subscribes at the ipo for the quantity asked", () => {
    const market = humanMarket(5);
    while (market.peek().kind === "npc_ipo") market.step();
    assert.deepEqual(market.peek(), { kind: "human_ipo" });
    const human = market.investor(you);
    const cashBefore = human.cash_cents;
    const treasuryBefore = market.treasury_shares;
    market.step({ type: "ipo_subscribe", quantity: 4 });
    assert.equal(human.shares, 4);
    assert.equal(cashBefore - human.cash_cents, 4 * 100_00);
    assert.equal(treasuryBefore - market.treasury_shares, 4);
    assert.equal(market.events.at(-1).kind, "ipo_fill");
    assert.equal(market.events.at(-1).name, you);
  });

  it("buys up to the chosen quantity when sellers are opposite", () => {
    const human = humanInvestor({ cash_cents: 200_000, shares: 0, v_cents: 2_000, ...still });
    const dirck = investorNew({ name: "Dirck", cash_cents: 0, shares: 10, v_cents: 7_000, ...still });
    const maria = investorNew({ name: "Maria", cash_cents: 0, shares: 10, v_cents: 9_000, ...still });
    const market = tradeMarket([human, dirck, maria]);
    const cashBefore = market.investors.reduce((s, i) => s + i.cash_cents, 0);
    const sharesBefore = market.investors.reduce((s, i) => s + i.shares, 0);
    market._humanAction = { type: "buy", quantity: 3 };
    market.oneTrade();

    const gathering = market.events.at(-1);
    assert.equal(gathering.open_cents, 9_000);
    assert.deepEqual(gathering.trades.map((t) => [t.buyer, t.seller, t.quantity]), [[you, "Dirck", 3]]);
    assert.ok(gathering.crowd.some((p) => p.name === you && p.stance === "buying"));
    assert.equal(human.shares, 3);
    assert.equal(human.cash_cents, 200_000 - 3 * 9_000);
    assert.equal(dirck.shares, 7);
    assert.equal(market.investors.reduce((s, i) => s + i.cash_cents, 0), cashBefore);
    assert.equal(market.investors.reduce((s, i) => s + i.shares, 0), sharesBefore);
    assert.equal(human.human_side, "buy");
  });

  it("sells nothing when nobody is buying", () => {
    const human = humanInvestor({ cash_cents: 0, shares: 5, v_cents: 2_000, ...still });
    const pieter = investorNew({ name: "Pieter", cash_cents: 0, shares: 0, v_cents: 10_000, ...still });
    const market = tradeMarket([human, pieter]);
    market._humanAction = { type: "sell", quantity: 5 };
    market.oneTrade();

    const gathering = market.events.at(-1);
    assert.deepEqual(gathering.trades, []);
    assert.equal(gathering.reason, "none");
    assert.deepEqual(gathering.crowd, [{ name: you, stance: "selling" }]);
    assert.equal(human.shares, 5);
    assert.equal(human.cash_cents, 0);
    assert.equal(human.human_side, "sell");
  });

  it("never morning-steps and only syncs worth to the last price", () => {
    const human = humanInvestor({ cash_cents: 50_000, shares: 0, v_cents: 15_000, stubbornness: 0.5, belief: [0, 0, 0, 1] });
    const npc = investorNew({
      name: "Jan", cash_cents: 200_000, shares: 10, v_cents: 12_000, stubbornness: 0.5, belief: [0, 0, 0, 1],
    });
    let randoms = 0;
    const market = tradeMarket([human, npc], {
      random: () => {
        randoms += 1;
        return 0;
      },
    });
    market._humanAction = { type: "skip" };
    market.oneTrade();

    assert.equal(randoms, 1);
    const npcOnly = [{ v_cents: morningStep(12_000, 0.5, false) }];
    assert.equal(market.events.at(-1).open_cents, openPlaqueCents(10_000, npcOnly));
    assert.equal(human.v_cents, market.last_price_cents);
    assert.notEqual(human.v_cents, morningStep(15_000, 0.5, false));
    assert.equal(human.human_side, null);
    assert.equal(human.human_qty, 0);
  });

  it("peek names the next moment", () => {
    const market = humanMarket(5);
    while (market.peek().kind !== "ipo_close") market.step();
    market.step();
    const trade = market.peek();
    assert.equal(trade.kind, "trade");
    assert.equal(trade.tick, 1);
    assert.equal(trade.open_preview_cents, openPlaquePreview(market.last_price_cents, market.investors));
    while (market.peek().kind === "trade") market.step();
    assert.equal(market.trade_tick, TRADE_TICKS);
    assert.deepEqual(market.peek(), { kind: "voyage" });
    market.step();
    assert.deepEqual(market.peek(), { kind: "done" });
  });

  it("same seed and same actions finish equal", () => {
    const actions = [
      { type: "ipo_subscribe", quantity: 2 },
      { type: "buy", quantity: 1 },
      { type: "skip" },
      { type: "sell", quantity: 1 },
    ];
    const run = () => {
      const market = humanMarket(11);
      let i = 0;
      while (market.step(actions[i++ % actions.length]));
      return market;
    };
    const a = run();
    const b = run();
    assert.deepEqual(a.snapshot(), b.snapshot());
    assert.deepEqual(a.frames, b.frames);
    assert.deepEqual(a.events, b.events);
  });

  it("preview and npc filter leave the human out", () => {
    const human = humanInvestor({ cash_cents: 50_000, shares: 0, v_cents: 18_000, ...still });
    const dirck = investorNew({ name: "Dirck", cash_cents: 0, shares: 5, v_cents: 2_000, ...still });
    const maria = investorNew({ name: "Maria", cash_cents: 0, shares: 5, v_cents: 4_000, ...still });
    const crowd = [human, dirck, maria];
    assert.deepEqual(npcInvestors(crowd).map((i) => i.name), ["Dirck", "Maria"]);
    assert.equal(openPlaquePreview(10_000, crowd), openPlaqueCents(10_000, [dirck, maria]));
    assert.notEqual(openPlaquePreview(10_000, crowd), openPlaqueCents(10_000, crowd));
  });
});

describe("inspectInvestor", () => {
  it("returns tape and pnl fields for named investor", () => {
    const seller = investorNew({
      name: "Pieter", cash_cents: 0, shares: 20, v_cents: 8_000, belief: [1, 0, 0, 0], stubbornness: 1,
    });
    const buyer = investorNew({
      name: "Anna", cash_cents: 200_000, shares: 0, v_cents: 15_000, belief: [0, 0, 0, 1], stubbornness: 1,
    });
    const market = tradeMarket([seller, buyer]);
    market.oneTrade();
    const info = inspectInvestor(market, "Anna");
    assert.equal(info.name, "Anna");
    assert.equal(info.start_cents, buyer.start_cash_cents);
    assert.equal(info.end_cents, buyer.cash_cents);
    assert.equal(info.total_cents, info.end_cents - info.start_cents);
    assert.equal(info.stubbornness, 1);
    assert.deepEqual(info.tape.map((e) => e.kind), ["gathering"]);
  });
});
