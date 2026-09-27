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
export const DRIFT_CENTS = 800;

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

export function morningStep(v, stubbornness, up) {
  const step = pyRound((1 - stubbornness) * DRIFT_CENTS, 0);
  const clamp = (cents) => Math.max(V_MIN_CENTS, Math.min(V_MAX_CENTS, cents));
  if (step === 0) return clamp(v);
  return clamp(v + (up ? step : -step));
}

export function medianBeliefCents(investors) {
  if (investors.length === 0) return IPO_PRICE_CENTS;
  const values = investors.map((inv) => inv.v_cents).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[mid];
  return pyRound((values[mid - 1] + values[mid]) / 2, 0);
}

export function openPlaqueCents(lastSaleCents, investors) {
  return pyRound(0.5 * lastSaleCents + 0.5 * medianBeliefCents(investors), 0);
}

export function displayName(nickname) {
  return `${nickname} (You)`;
}

export function npcInvestors(investors) {
  return investors.filter((inv) => !inv.is_human);
}

export function openPlaquePreview(lastSaleCents, investors) {
  return openPlaqueCents(lastSaleCents, npcInvestors(investors));
}

export function worthCents(investor) {
  return investor.cash_cents + investor.shares * investor.v_cents;
}

export function stanceAt(investor, price) {
  if (investor.is_human) {
    if (investor.human_side === "buy" && investor.cash_cents >= price) return "buying";
    if (investor.human_side === "sell" && investor.shares >= 1) return "selling";
    return "waiting";
  }
  if (investor.v_cents > price && investor.cash_cents >= price) return "buying";
  if (investor.v_cents < price && investor.shares >= 1) return "selling";
  return "waiting";
}

export function nudgeV(v, stubbornness, price) {
  const nxt = pyRound(v + (1 - stubbornness) * TAPE_K * (price - v), 0);
  return Math.max(V_MIN_CENTS, Math.min(V_MAX_CENTS, nxt));
}

export function missPull(v, stubbornness, price) {
  const step = pyRound((1 - stubbornness) * DRIFT_CENTS, 0);
  const clamp = (cents) => Math.max(V_MIN_CENTS, Math.min(V_MAX_CENTS, cents));
  if (step === 0 || v === price) return clamp(v);
  const gap = Math.abs(price - v);
  const mag = Math.max(step, gap);
  const dir = v < price ? 1 : -1;
  return clamp(v + dir * mag);
}

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function crowdAt(investors, price) {
  const buyers = [];
  const sellers = [];
  for (const inv of investors) {
    const stance = stanceAt(inv, price);
    if (stance === "buying") buyers.push(inv);
    else if (stance === "selling") sellers.push(inv);
  }
  const humanFirst = (a, b) => (b.is_human ? 1 : 0) - (a.is_human ? 1 : 0);
  buyers.sort((a, b) => humanFirst(a, b) || b.v_cents - a.v_cents || a.name.localeCompare(b.name));
  sellers.sort((a, b) => humanFirst(a, b) || a.v_cents - b.v_cents || a.name.localeCompare(b.name));
  return { buyers, sellers };
}

function nextUp(investors, price) {
  const candidates = [];
  for (const inv of investors) {
    if (inv.is_human) {
      if (stanceAt(inv, price) === "buying") candidates.push(inv.cash_cents + 1);
      continue;
    }
    if (inv.v_cents > price && inv.cash_cents >= price) {
      candidates.push(inv.v_cents);
      if (inv.cash_cents + 1 > price && inv.cash_cents + 1 < inv.v_cents) candidates.push(inv.cash_cents + 1);
    }
    if (inv.shares >= 1 && inv.v_cents >= price) candidates.push(inv.v_cents + 1);
  }
  const above = candidates.filter((c) => c > price);
  return above.length === 0 ? null : Math.min(...above);
}

function nextDown(investors, price) {
  const candidates = [];
  for (const inv of investors) {
    if (inv.is_human) continue;
    if (inv.v_cents < price && inv.shares >= 1) candidates.push(inv.v_cents);
    const already = inv.v_cents > price && inv.cash_cents >= price;
    if (!already && inv.cash_cents >= 1) {
      const entry = Math.min(inv.v_cents - 1, inv.cash_cents);
      if (entry >= 1 && entry < price && inv.v_cents > entry) candidates.push(entry);
    }
  }
  const below = candidates.filter((c) => c < price);
  return below.length === 0 ? null : Math.max(...below);
}

function triggerFor(investors, prev, next, direction) {
  const changes = [];
  for (const inv of investors) {
    const before = stanceAt(inv, prev);
    const after = stanceAt(inv, next);
    if (inv.is_human) {
      if (direction === "up" && before === "buying" && after !== "buying") {
        changes.push({ name: inv.name, kind: "priced_out" });
      }
      continue;
    }
    if (direction === "up" && before === "buying" && after !== "buying") {
      const kind = next === inv.v_cents ? "dropped" : "priced_out";
      changes.push({ name: inv.name, kind });
    } else if (direction === "up" && before !== "selling" && after === "selling") {
      changes.push({ name: inv.name, kind: "entered" });
    } else if (direction === "down" && before === "selling" && after !== "selling") {
      changes.push({ name: inv.name, kind: "dropped" });
    } else if (direction === "down" && before !== "buying" && after === "buying") {
      changes.push({ name: inv.name, kind: "entered" });
    }
  }
  changes.sort((a, b) => a.name.localeCompare(b.name));
  return changes[0] ?? null;
}

function findGathering(investors, open) {
  let price = open;
  let trigger = null;
  const seen = new Set([open]);

  function refuse(wanted, heavy) {
    const stayed = crowdAt(investors, open);
    return {
      price: open, trigger: null, buyers: stayed.buyers, sellers: stayed.sellers,
      traded: false, wanted, heavy,
    };
  }

  function settle(at, trig) {
    const { buyers, sellers } = crowdAt(investors, at);
    if (buyers.length === 0 || sellers.length === 0) return null;
    return { price: at, trigger: trig, buyers, sellers, traded: true, wanted: null, heavy: null };
  }

  for (let guard = 0; guard < 64; guard++) {
    const { buyers, sellers } = crowdAt(investors, price);
    if (buyers.length > 0 && buyers.length === sellers.length) {
      return { price, trigger, buyers, sellers, traded: true, wanted: null, heavy: null };
    }
    const heavy = buyers.length > sellers.length ? "buyers" : sellers.length > buyers.length ? "sellers" : null;
    if (heavy == null) return refuse(null, null);

    const next = heavy === "buyers" ? nextUp(investors, price) : nextDown(investors, price);
    if (next == null || seen.has(next)) {
      return settle(price, trigger) ?? refuse(next, heavy);
    }
    const after = crowdAt(investors, next);
    const heavyCount = heavy === "buyers" ? after.buyers.length : after.sellers.length;
    if (heavyCount === 0) {
      return settle(price, trigger) ?? refuse(next, heavy);
    }
    trigger = triggerFor(investors, price, next, heavy === "buyers" ? "up" : "down");
    price = next;
    seen.add(price);
  }
  return settle(price, trigger) ?? refuse(null, null);
}

function sizeCap(investor) {
  return investor.is_human ? investor.human_qty : Infinity;
}

function pairTrades(buyers, sellers, price) {
  const trades = [];
  const pairs = Math.min(buyers.length, sellers.length);
  for (let i = 0; i < pairs; i++) {
    const quantity = Math.min(
      Math.floor(buyers[i].cash_cents / price),
      sellers[i].shares,
      sizeCap(buyers[i]),
      sizeCap(sellers[i]),
    );
    if (quantity < 1) continue;
    trades.push({
      buyer: buyers[i].name,
      seller: sellers[i].name,
      quantity,
      price_cents: price,
    });
  }
  return trades;
}

export function rankPnl(rows) {
  return [...rows].sort((a, b) => b.total_cents - a.total_cents || a.name.localeCompare(b.name));
}

export function investorTape(events, name) {
  return events.flatMap((e) => {
    if (e.name === name || e.buyer === name || e.seller === name) return [e];
    if (e.kind !== "gathering") return [];
    const trades = e.trades.filter((t) => t.buyer === name || t.seller === name);
    if (trades.length === 0) return [];
    return [{ ...e, trades }];
  });
}

export function investorNew({
  name,
  cash_cents,
  shares,
  belief,
  start_cash_cents = null,
  stubbornness = 0.5,
  v_cents = null,
  seat = null,
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
    seat: seat ?? name,
    is_human: false,
    human_side: null,
    human_qty: 0,
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
      seat: inv.seat,
      is_human: inv.is_human,
      human_side: inv.human_side,
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

  market.human = () => market.investors.find((inv) => inv.is_human) ?? null;

  market.peek = () => {
    if (market.done) return { kind: "done" };
    if (market.phase === "ipo" && !market._ipoFinished) {
      const order = ensureIpoOrder(market);
      for (let i = market._ipoIndex; i < order.length; i++) {
        const inv = market.investor(order[i]);
        if (inv.is_human) return { kind: "human_ipo" };
        if (inv.v_cents >= IPO_PRICE_CENTS && ipoAvailable(market, inv) >= 1) {
          return { kind: "npc_ipo", name: inv.name };
        }
      }
      return { kind: "ipo_close" };
    }
    if (market.phase !== "voyage" && market.trade_tick < TRADE_TICKS) {
      return {
        kind: "trade",
        open_preview_cents: openPlaquePreview(market.last_price_cents, market.investors),
        tick: market.trade_tick + 1,
      };
    }
    return { kind: "voyage" };
  };

  market.step = (action = { type: "none" }) => {
    if (market.done) return false;
    market._humanAction = action;
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
    const human = market.human();
    if (human) {
      const action = market._humanAction ?? { type: "none" };
      const side = action.type === "buy" ? "buy" : action.type === "sell" ? "sell" : null;
      human.human_side = side;
      human.human_qty = side == null ? 0 : Math.max(0, action.quantity ?? 0);
    }
    const npcs = npcInvestors(market.investors);

    for (const inv of npcs) {
      const up = market.rng.random() >= 0.5;
      inv.v_cents = morningStep(inv.v_cents, inv.stubbornness, up);
    }

    const open = openPlaqueCents(market.last_price_cents, npcs);
    const found = findGathering(market.investors, open);
    const trades = found.traded ? pairTrades(found.buyers, found.sellers, found.price) : [];
    for (const trade of trades) {
      const buyer = market.investor(trade.buyer);
      const seller = market.investor(trade.seller);
      const cash = trade.quantity * trade.price_cents;
      seller.shares -= trade.quantity;
      buyer.shares += trade.quantity;
      buyer.cash_cents -= cash;
      seller.cash_cents += cash;
      trade.cash_cents = cash;
      trade.buyer_cash_cents = buyer.cash_cents;
      trade.buyer_shares = buyer.shares;
      trade.seller_cash_cents = seller.cash_cents;
      trade.seller_shares = seller.shares;
    }
    if (trades.length > 0) {
      market.last_price_cents = found.price;
      for (const inv of npcs) {
        inv.v_cents = nudgeV(inv.v_cents, inv.stubbornness, found.price);
      }
    } else {
      market.last_price_cents = open;
      for (const inv of npcs) {
        inv.v_cents = missPull(inv.v_cents, inv.stubbornness, open);
      }
    }
    if (human) human.v_cents = market.last_price_cents;

    const close = trades.length > 0 ? found.price : open;
    let reason = "none";
    if (trades.length > 0) {
      if (close > open) reason = "rose";
      else if (close < open) reason = "fell";
      else reason = "held";
    }
    const crowd = [
      ...found.buyers.map((inv) => ({ name: inv.name, stance: "buying" })),
      ...found.sellers.map((inv) => ({ name: inv.name, stance: "selling" })),
    ];
    const deal = trades.length === 0
      ? "no sale"
      : trades.map((t) => `${t.buyer} buys ${t.quantity} from ${t.seller}`).join(", ");
    market.log.push(`turn ${market.trade_tick} ${money(open)} to ${money(close)} ${deal}`);
    market.events.push({
      kind: "gathering",
      tick: market.trade_tick,
      open_cents: open,
      close_cents: close,
      reason,
      trigger: trades.length > 0 ? found.trigger : null,
      wanted_cents: trades.length > 0 ? null : found.wanted,
      heavy: trades.length > 0 ? null : found.heavy,
      crowd,
      trades,
    });
  };

  return market;
}

function ipoAvailable(market, investor) {
  return Math.min(Math.floor(investor.cash_cents / IPO_PRICE_CENTS), market.treasury_shares);
}

function ensureIpoOrder(market) {
  if (market._ipoOrder == null) {
    const order = [...market.investors];
    market.rng.shuffle(order);
    market._ipoOrder = order.map((inv) => inv.name);
    market._ipoIndex = 0;
  }
  return market._ipoOrder;
}

function ipoFill(market, investor, qty) {
  investor.shares += qty;
  investor.cash_cents -= qty * IPO_PRICE_CENTS;
  market.treasury_shares -= qty;
  market.company_cash_cents += qty * IPO_PRICE_CENTS;
  market.log.push(`${investor.name} buys ${qty} @ $100.00 IPO`);
  market.events.push({
    kind: "ipo_fill",
    name: investor.name,
    size: qty,
    price_cents: IPO_PRICE_CENTS,
  });
}

function* ipoEvents(market) {
  market.phase = "ipo";
  market.header = "IPO";
  const order = ensureIpoOrder(market);
  while (market._ipoIndex < order.length) {
    const inv = market.investor(order[market._ipoIndex]);
    market._ipoIndex += 1;
    if (inv.is_human) {
      const action = market._humanAction ?? { type: "none" };
      const available = ipoAvailable(market, inv);
      if (action.type === "ipo_subscribe" && available >= 1) {
        ipoFill(market, inv, Math.min(Math.max(1, action.quantity ?? 1), available));
      }
      yield;
    } else if (inv.v_cents >= IPO_PRICE_CENTS) {
      const available = ipoAvailable(market, inv);
      if (available >= 1) {
        ipoFill(market, inv, market.rng.randint(1, available));
        yield;
      }
    }
    if (market.treasury_shares === 0) break;
  }
  market._ipoFinished = true;
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
    _ipoOrder: null,
    _ipoIndex: 0,
    _ipoFinished: false,
    _humanAction: { type: "none" },
    ...fields,
  };
  attachMethods(market);
  if (market._gen == null) market._gen = allEvents(market);
  return market;
}

export function marketNew({ seed, rng, human = null } = {}) {
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
  if (human) {
    const seat = investors.find((inv) => inv.name === human.seat);
    if (!seat) throw new Error(human.seat);
    seat.is_human = true;
    seat.name = displayName(human.nickname);
  }
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
