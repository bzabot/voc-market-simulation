export const TOTAL_SHARES = 1000;
export const IPO_PRICE_CENTS = 10_000;
export const TRADE_TICKS = 40;
export const NAMES = [
  "Willem", "Anna", "Pieter", "Jan", "Maria", "Dirck", "Geert", "Trijn", "Hendrick", "Lijsbet",
];
export const CASH_LADDER_CENTS = [
  3_000_00, 5_000_00, 8_000_00, 10_000_00, 12_000_00,
  15_000_00, 20_000_00, 25_000_00, 40_000_00, 60_000_00,
];
export const OUTCOMES_CENTS_PER_SHARE = {
  lost: 2_000,
  poor: 7_000,
  normal: 13_000,
  excellent: 18_000,
};
export const PAYOFF_DOLLARS = [20, 70, 130, 180];
export const V_MIN_CENTS = 2_000;
export const V_MAX_CENTS = 18_000;
export const TAPE_K = 0.15;

export function pyRound(value, ndigits = 0) {
  if (ndigits !== 0) {
    const factor = 10 ** ndigits;
    return pyRound(value * factor, 0) / factor;
  }
  const floor = Math.floor(value);
  const frac = value - floor;
  if (frac > 0.5) return floor + 1;
  if (frac < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

export function createRng(seed) {
  let state = seed >>> 0;
  function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randint(a, b) {
    return a + Math.floor(random() * (b - a + 1));
  }
  function choice(list) {
    return list[Math.floor(random() * list.length)];
  }
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  return { random, randint, choice, shuffle };
}

export function drawBelief(rng) {
  while (true) {
    const xs = [rng.random(), rng.random(), rng.random(), rng.random()];
    const total = xs[0] + xs[1] + xs[2] + xs[3];
    if (total > 0) {
      return [xs[0] / total, xs[1] / total, xs[2] / total, xs[3] / total];
    }
  }
}

export function reservationCents(belief) {
  let dollars = 0;
  for (let i = 0; i < 4; i++) dollars += belief[i] * PAYOFF_DOLLARS[i];
  return pyRound(dollars * 100, 0);
}

export function drawStubbornness(rng) {
  return 0.2 + 0.7 * rng.random();
}

export function conviction(stubbornness) {
  const raw = pyRound((stubbornness - 0.2) / 0.7, 12);
  return Math.max(0, Math.min(1, raw));
}

export function nudgeV(v, stubbornness, price) {
  const nxt = pyRound(v + (1 - stubbornness) * TAPE_K * (price - v), 0);
  return Math.max(V_MIN_CENTS, Math.min(V_MAX_CENTS, nxt));
}

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function rankPnl(rows) {
  return [...rows].sort((a, b) => b.total_cents - a.total_cents || a.name.localeCompare(b.name));
}

export function investorTape(events, name) {
  return events.filter(
    (e) => e.name === name || e.buyer === name || e.seller === name,
  );
}

export function investorNew({
  name,
  cash_cents,
  shares,
  belief,
  start_cash_cents = null,
  stubbornness = 0.5,
  v_cents = null,
}) {
  const start = start_cash_cents ?? cash_cents;
  const v = v_cents ?? reservationCents(belief);
  return {
    name,
    cash_cents,
    shares,
    belief,
    start_cash_cents: start,
    stubbornness,
    v_cents: v,
  };
}

function attachMethods(market) {
  market.investor = (name) => {
    const inv = market.investors.find((i) => i.name === name);
    if (!inv) throw new Error(name);
    return inv;
  };

  market.snapshot = () => ({
    header: market.header,
    phase: market.phase,
    last_price_cents: market.last_price_cents,
    treasury_shares: market.treasury_shares,
    company_cash_cents: market.company_cash_cents,
    voyage_shown: market.voyage_shown,
    done: market.done,
    investors: market.investors.map((inv) => ({
      name: inv.name,
      cash_cents: inv.cash_cents,
      shares: inv.shares,
      v_cents: inv.v_cents,
      start_cash_cents: inv.start_cash_cents,
      stubbornness: inv.stubbornness,
    })),
    log: [...market.log],
    events: market.events.map((e) => ({ ...e })),
  });

  market.pnlRows = () => {
    const rows = market.investors.map((inv) => {
      const start = inv.start_cash_cents ?? 0;
      const end = inv.cash_cents;
      const total = end - start;
      const pct = start === 0 ? 0 : (100 * total) / start;
      return { name: inv.name, start_cents: start, end_cents: end, total_cents: total, pct };
    });
    return rankPnl(rows);
  };

  market.step = () => {
    if (market.done) return false;
    const result = market._gen.next();
    if (result.done) {
      market.done = true;
      return false;
    }
    if (market.phase === "voyage") market.done = true;
    market.frames.push(market.snapshot());
    return true;
  };

  market.oneTrade = () => {
    const sellEl = market.investors.filter((i) => i.shares >= 1);
    const buyEl = market.investors.filter((i) => i.v_cents > 0 && i.cash_cents >= i.v_cents);
    let side = market.rng.random() < 0.5 ? "sell" : "buy";
    let el = side === "sell" ? sellEl : buyEl;
    if (el.length === 0) {
      side = side === "sell" ? "buy" : "sell";
      el = side === "sell" ? sellEl : buyEl;
    }
    if (el.length === 0) {
      market.log.push("no eligible trader");
      market.events.push({ kind: "no_eligible" });
      return;
    }

    let buyer;
    let seller;
    let priceAt;
    let size;

    if (side === "sell") {
      seller = market.rng.choice(el);
      priceAt = seller.v_cents;
      size = Math.max(1, Math.ceil(seller.shares * conviction(seller.stubbornness)));
      const others = market.investors.filter((i) => i !== seller);
      market.rng.shuffle(others);
      buyer = others.find((o) => o.v_cents >= priceAt && o.cash_cents >= priceAt) ?? null;
      market.events.push({
        kind: "offer",
        tick: market.trade_tick,
        name: seller.name,
        size,
        price_cents: priceAt,
      });
      market.log.push(`${seller.name} offers ${size} @ ${money(priceAt)}`);
    } else {
      buyer = market.rng.choice(el);
      priceAt = buyer.v_cents;
      const capacity = Math.floor(buyer.cash_cents / priceAt);
      size = Math.max(1, Math.ceil(capacity * conviction(buyer.stubbornness)));
      const others = market.investors.filter((i) => i !== buyer);
      market.rng.shuffle(others);
      seller = others.find((o) => o.v_cents <= priceAt && o.shares >= 1) ?? null;
      market.events.push({
        kind: "bid",
        tick: market.trade_tick,
        name: buyer.name,
        size,
        price_cents: priceAt,
      });
      market.log.push(`${buyer.name} bids ${size} @ ${money(priceAt)}`);
    }

    if (buyer == null || seller == null) {
      market.log.push("nobody takes");
      market.events.push({ kind: "nobody_takes", tick: market.trade_tick, side });
      return;
    }

    const negotiableMax = Math.min(size, Math.floor(buyer.cash_cents / priceAt), seller.shares);
    const counterparty = side === "sell" ? buyer : seller;
    const advantage =
      side === "sell"
        ? Math.max(0, buyer.v_cents - priceAt) / priceAt
        : Math.max(0, priceAt - seller.v_cents) / priceAt;
    const counterpartyConviction = conviction(counterparty.stubbornness);
    const responseStrength =
      counterpartyConviction + (1 - counterpartyConviction) * Math.min(1, advantage);
    const counterproposal = Math.max(1, Math.ceil(negotiableMax * responseStrength));
    const rangeMin = Math.min(counterproposal, negotiableMax);
    const quantity = market.rng.randint(rangeMin, negotiableMax);
    const buyerValue = buyer.v_cents;
    const sellerValue = seller.v_cents;
    const buyerConviction = conviction(buyer.stubbornness);
    const sellerConviction = conviction(seller.stubbornness);

    seller.shares -= quantity;
    buyer.shares += quantity;
    buyer.cash_cents -= quantity * priceAt;
    seller.cash_cents += quantity * priceAt;
    market.log.push(`${buyer.name} takes ${quantity} @ ${money(priceAt)}`);
    market.events.push({
      kind: "trade",
      tick: market.trade_tick,
      buyer: buyer.name,
      seller: seller.name,
      quantity,
      price_cents: priceAt,
      buyer_value_cents: buyerValue,
      seller_value_cents: sellerValue,
      buyer_conviction: buyerConviction,
      seller_conviction: sellerConviction,
      counterproposal,
      range_min: rangeMin,
      range_max: negotiableMax,
    });
    market.last_price_cents = priceAt;
    for (const inv of market.investors) {
      inv.v_cents = nudgeV(inv.v_cents, inv.stubbornness, priceAt);
    }
  };

  return market;
}

function* ipoEvents(market) {
  market.phase = "ipo";
  market.header = "IPO";
  const order = [...market.investors];
  market.rng.shuffle(order);
  for (const inv of order) {
    if (inv.v_cents < IPO_PRICE_CENTS) continue;
    const available = Math.min(
      Math.floor(inv.cash_cents / IPO_PRICE_CENTS),
      market.treasury_shares,
    );
    if (available < 1) continue;
    const qty = market.rng.randint(1, available);
    inv.shares += qty;
    inv.cash_cents -= qty * IPO_PRICE_CENTS;
    market.treasury_shares -= qty;
    market.company_cash_cents += qty * IPO_PRICE_CENTS;
    market.log.push(`${inv.name} buys ${qty} @ $100.00 IPO`);
    market.events.push({
      kind: "ipo_fill",
      name: inv.name,
      size: qty,
      price_cents: IPO_PRICE_CENTS,
    });
    yield;
    if (market.treasury_shares === 0) break;
  }
  market.log.push("IPO closed");
  market.events.push({ kind: "ipo_closed" });
  yield;
}

function* voyageEvents(market) {
  market.phase = "voyage";
  market.header = "voyage";
  const per = OUTCOMES_CENTS_PER_SHARE[market.hidden_outcome];
  market.voyage_shown = market.hidden_outcome;
  market.log.push(`voyage: ${market.hidden_outcome} (${money(per)}/share)`);
  market.events.push({
    kind: "voyage",
    name: market.hidden_outcome,
    price_cents: per,
  });
  for (const inv of market.investors) {
    const pay = inv.shares * per;
    inv.cash_cents += pay;
    market.log.push(`${inv.name} payout ${inv.shares} shares -> ${money(pay)}`);
    market.events.push({
      kind: "payout",
      name: inv.name,
      size: inv.shares,
      price_cents: pay,
    });
  }
  const treas = market.treasury_shares * per;
  market.company_cash_cents += treas;
  market.log.push(`treasury payout ${market.treasury_shares} shares -> ${money(treas)}`);
  market.events.push({
    kind: "treasury_payout",
    size: market.treasury_shares,
    price_cents: treas,
  });
  yield;
}

function* allEvents(market) {
  yield* ipoEvents(market);
  market.phase = "trade";
  for (let i = 1; i <= TRADE_TICKS; i++) {
    market.trade_tick = i;
    market.header = `${i}/${TRADE_TICKS}`;
    market.oneTrade();
    yield;
  }
  yield* voyageEvents(market);
}

function baseMarket(fields) {
  const market = {
    treasury_shares: TOTAL_SHARES,
    company_cash_cents: 0,
    last_price_cents: IPO_PRICE_CENTS,
    hidden_outcome: "lost",
    voyage_shown: null,
    log: [],
    events: [],
    frames: [],
    phase: "ipo",
    header: "IPO",
    trade_tick: 0,
    done: false,
    ...fields,
  };
  attachMethods(market);
  if (market._gen == null) market._gen = allEvents(market);
  return market;
}

export function marketNew({ seed, rng } = {}) {
  const s = seed ?? Math.floor(Math.random() * 2 ** 31);
  const r = rng ?? createRng(s);
  const names = [...NAMES];
  const cash = [...CASH_LADDER_CENTS];
  r.shuffle(names);
  r.shuffle(cash);
  const investors = names.map((name, i) =>
    investorNew({
      name,
      cash_cents: cash[i],
      shares: 0,
      belief: drawBelief(r),
      start_cash_cents: cash[i],
      stubbornness: drawStubbornness(r),
    }),
  );
  const hidden_outcome = r.choice(Object.keys(OUTCOMES_CENTS_PER_SHARE));
  return baseMarket({ rng: r, investors, hidden_outcome });
}

export function marketForTest({
  investors,
  rng,
  treasury_shares = TOTAL_SHARES,
  company_cash_cents = 0,
  phase = "ipo",
  hidden_outcome = "lost",
}) {
  const market = baseMarket({
    rng,
    investors,
    treasury_shares,
    company_cash_cents,
    hidden_outcome,
    phase,
    header: phase === "voyage" ? "voyage" : "IPO",
    _gen: (function* () {})(),
  });
  if (phase === "ipo") market._gen = ipoEvents(market);
  else if (phase === "voyage") market._gen = voyageEvents(market);
  else market._gen = allEvents(market);
  return market;
}

export function inspectInvestor(market, name) {
  const row = market.pnlRows().find((r) => r.name === name);
  if (!row) throw new Error(name);
  return {
    name: row.name,
    start_cents: row.start_cents,
    end_cents: row.end_cents,
    total_cents: row.total_cents,
    pct: row.pct,
    stubbornness: market.investor(name).stubbornness,
    tape: investorTape(market.events, name),
  };
}
