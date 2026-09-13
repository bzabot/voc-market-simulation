from __future__ import annotations

import random
from dataclasses import dataclass, field
from math import ceil
from typing import Iterator

TOTAL_SHARES = 1000
IPO_PRICE_CENTS = 10_000
TRADE_TICKS = 40
NAMES = [
    "Willem",
    "Anna",
    "Pieter",
    "Jan",
    "Maria",
    "Dirck",
    "Geert",
    "Trijn",
    "Hendrick",
    "Lijsbet",
]
CASH_LADDER_CENTS = [
    3_000_00,
    5_000_00,
    8_000_00,
    10_000_00,
    12_000_00,
    15_000_00,
    20_000_00,
    25_000_00,
    40_000_00,
    60_000_00,
]
OUTCOMES_CENTS_PER_SHARE = {
    "lost": 2_000,
    "poor": 7_000,
    "normal": 13_000,
    "excellent": 18_000,
}
PAYOFF_DOLLARS = (20, 70, 130, 180)
V_MIN_CENTS = 2_000
V_MAX_CENTS = 18_000
TAPE_K = 0.15


def draw_belief(rng: random.Random) -> tuple[float, float, float, float]:
    while True:
        xs = [rng.random() for _ in range(4)]
        total = sum(xs)
        if total > 0:
            return (xs[0] / total, xs[1] / total, xs[2] / total, xs[3] / total)


def reservation_cents(belief: tuple[float, float, float, float]) -> int:
    dollars = sum(p * pay for p, pay in zip(belief, PAYOFF_DOLLARS, strict=True))
    return int(round(dollars * 100))


def draw_stubbornness(rng: random.Random) -> float:
    return 0.2 + 0.7 * rng.random()


def conviction(stubbornness: float) -> float:
    return max(0.0, min(1.0, round((stubbornness - 0.2) / 0.7, 12)))


def nudge_v(v: int, stubbornness: float, price: int) -> int:
    nxt = int(round(v + (1 - stubbornness) * TAPE_K * (price - v)))
    return max(V_MIN_CENTS, min(V_MAX_CENTS, nxt))


def _money(cents: int) -> str:
    return f"${cents / 100:.2f}"


@dataclass
class PnlRow:
    name: str
    start_cents: int
    end_cents: int
    total_cents: int
    pct: float


def rank_pnl(rows: list[PnlRow]) -> list[PnlRow]:
    return sorted(rows, key=lambda r: (-r.total_cents, r.name))


def investor_tape(events: list[dict], name: str) -> list[dict]:
    participant_fields = ("name", "buyer", "seller")
    return [e for e in events if any(e.get(field) == name for field in participant_fields)]


@dataclass
class Investor:
    name: str
    cash_cents: int
    shares: int
    belief: tuple[float, float, float, float]
    start_cash_cents: int | None = None
    stubbornness: float = 0.5
    v_cents: int | None = None

    def __post_init__(self) -> None:
        if self.start_cash_cents is None:
            self.start_cash_cents = self.cash_cents
        if self.v_cents is None:
            self.v_cents = reservation_cents(self.belief)


@dataclass
class Market:
    rng: random.Random
    investors: list[Investor]
    treasury_shares: int = TOTAL_SHARES
    company_cash_cents: int = 0
    last_price_cents: int = IPO_PRICE_CENTS
    hidden_outcome: str = "lost"
    voyage_shown: str | None = None
    log: list[str] = field(default_factory=list)
    events: list[dict] = field(default_factory=list)
    frames: list[dict] = field(default_factory=list)
    phase: str = "ipo"
    header: str = "IPO"
    trade_tick: int = 0
    done: bool = False
    _gen: Iterator[None] | None = field(default=None, repr=False)

    def __post_init__(self) -> None:
        if self._gen is None:
            self._gen = self._all_events()

    @classmethod
    def new(cls, rng: random.Random | None = None, seed: int | None = None) -> Market:
        rng = rng or random.Random(seed)
        names = NAMES[:]
        cash = CASH_LADDER_CENTS[:]
        rng.shuffle(names)
        rng.shuffle(cash)
        investors = [
            Investor(
                name,
                cash_cents,
                0,
                draw_belief(rng),
                start_cash_cents=cash_cents,
                stubbornness=draw_stubbornness(rng),
            )
            for name, cash_cents in zip(names, cash, strict=True)
        ]
        outcome = rng.choice(list(OUTCOMES_CENTS_PER_SHARE))
        return cls(rng=rng, investors=investors, hidden_outcome=outcome)

    @classmethod
    def for_test(
        cls,
        investors: list[Investor],
        rng: random.Random,
        treasury_shares: int = TOTAL_SHARES,
        company_cash_cents: int = 0,
        phase: str = "ipo",
        hidden_outcome: str = "lost",
    ) -> Market:
        market = cls(
            rng=rng,
            investors=investors,
            treasury_shares=treasury_shares,
            company_cash_cents=company_cash_cents,
            hidden_outcome=hidden_outcome,
            phase=phase,
            header="voyage" if phase == "voyage" else "IPO",
            _gen=iter(()),
        )
        if phase == "ipo":
            market._gen = market._ipo_events()
        elif phase == "voyage":
            market._gen = market._voyage_events()
        else:
            market._gen = market._all_events()
        return market

    def investor(self, name: str) -> Investor:
        for inv in self.investors:
            if inv.name == name:
                return inv
        raise KeyError(name)

    def pnl_rows(self) -> list[PnlRow]:
        rows = []
        for inv in self.investors:
            start = inv.start_cash_cents or 0
            end = inv.cash_cents
            total = end - start
            pct = 100.0 * total / start
            rows.append(PnlRow(inv.name, start, end, total, pct))
        return rank_pnl(rows)

    def snapshot(self) -> dict:
        return {
            "header": self.header,
            "phase": self.phase,
            "last_price_cents": self.last_price_cents,
            "treasury_shares": self.treasury_shares,
            "company_cash_cents": self.company_cash_cents,
            "voyage_shown": self.voyage_shown,
            "done": self.done,
            "investors": [
                {
                    "name": inv.name,
                    "cash_cents": inv.cash_cents,
                    "shares": inv.shares,
                    "v_cents": inv.v_cents,
                    "start_cash_cents": inv.start_cash_cents,
                    "stubbornness": inv.stubbornness,
                }
                for inv in self.investors
            ],
            "log": list(self.log),
            "events": [dict(e) for e in self.events],
        }

    def step(self) -> bool:
        if self.done:
            return False
        assert self._gen is not None
        try:
            next(self._gen)
            if self.phase == "voyage":
                self.done = True
            self.frames.append(self.snapshot())
            return True
        except StopIteration:
            self.done = True
            return False

    def _all_events(self) -> Iterator[None]:
        yield from self._ipo_events()
        self.phase = "trade"
        for i in range(1, TRADE_TICKS + 1):
            self.trade_tick = i
            self.header = f"{i}/{TRADE_TICKS}"
            self._one_trade()
            yield
        yield from self._voyage_events()

    def _ipo_events(self) -> Iterator[None]:
        self.phase = "ipo"
        self.header = "IPO"
        order = self.investors[:]
        self.rng.shuffle(order)
        for inv in order:
            if inv.v_cents < IPO_PRICE_CENTS:
                continue
            available = min(inv.cash_cents // IPO_PRICE_CENTS, self.treasury_shares)
            if available < 1:
                continue
            qty = self.rng.randint(1, available)
            inv.shares += qty
            inv.cash_cents -= qty * IPO_PRICE_CENTS
            self.treasury_shares -= qty
            self.company_cash_cents += qty * IPO_PRICE_CENTS
            self.log.append(f"{inv.name} buys {qty} @ $100.00 IPO")
            self.events.append(
                {
                    "kind": "ipo_fill",
                    "name": inv.name,
                    "size": qty,
                    "price_cents": IPO_PRICE_CENTS,
                }
            )
            yield
            if self.treasury_shares == 0:
                break
        self.log.append("IPO closed")
        self.events.append({"kind": "ipo_closed"})
        yield

    def _voyage_events(self) -> Iterator[None]:
        self.phase = "voyage"
        self.header = "voyage"
        per = OUTCOMES_CENTS_PER_SHARE[self.hidden_outcome]
        self.voyage_shown = self.hidden_outcome
        self.log.append(
            f"voyage: {self.hidden_outcome} ({_money(per)}/share)"
        )
        self.events.append(
            {"kind": "voyage", "name": self.hidden_outcome, "price_cents": per}
        )
        for inv in self.investors:
            pay = inv.shares * per
            inv.cash_cents += pay
            self.log.append(
                f"{inv.name} payout {inv.shares} shares -> {_money(pay)}"
            )
            self.events.append(
                {
                    "kind": "payout",
                    "name": inv.name,
                    "size": inv.shares,
                    "price_cents": pay,
                }
            )
        treas = self.treasury_shares * per
        self.company_cash_cents += treas
        self.log.append(
            f"treasury payout {self.treasury_shares} shares -> {_money(treas)}"
        )
        self.events.append(
            {
                "kind": "treasury_payout",
                "size": self.treasury_shares,
                "price_cents": treas,
            }
        )
        yield

    def _one_trade(self) -> None:
        sell_el = [i for i in self.investors if i.shares >= 1]
        buy_el = [i for i in self.investors if i.v_cents > 0 and i.cash_cents >= i.v_cents]
        side = "sell" if self.rng.random() < 0.5 else "buy"
        el = sell_el if side == "sell" else buy_el
        if not el:
            side = "buy" if side == "sell" else "sell"
            el = sell_el if side == "sell" else buy_el
        if not el:
            self.log.append("no eligible trader")
            self.events.append({"kind": "no_eligible"})
            return
        if side == "sell":
            seller = self.rng.choice(el)
            assert seller.v_cents is not None
            price_at = seller.v_cents
            size = max(1, ceil(seller.shares * conviction(seller.stubbornness)))
            others = [i for i in self.investors if i is not seller]
            self.rng.shuffle(others)
            buyer = next(
                (
                    other
                    for other in others
                    if other.v_cents >= price_at and other.cash_cents >= price_at
                ),
                None,
            )
            self.events.append(
                {
                    "kind": "offer",
                    "tick": self.trade_tick,
                    "name": seller.name,
                    "size": size,
                    "price_cents": price_at,
                }
            )
            self.log.append(f"{seller.name} offers {size} @ {_money(price_at)}")
        else:
            buyer = self.rng.choice(el)
            assert buyer.v_cents is not None
            price_at = buyer.v_cents
            capacity = buyer.cash_cents // price_at
            size = max(1, ceil(capacity * conviction(buyer.stubbornness)))
            others = [i for i in self.investors if i is not buyer]
            self.rng.shuffle(others)
            seller = next(
                (
                    other
                    for other in others
                    if other.v_cents <= price_at and other.shares >= 1
                ),
                None,
            )
            self.events.append(
                {
                    "kind": "bid",
                    "tick": self.trade_tick,
                    "name": buyer.name,
                    "size": size,
                    "price_cents": price_at,
                }
            )
            self.log.append(f"{buyer.name} bids {size} @ {_money(price_at)}")

        if buyer is None or seller is None:
            self.log.append("nobody takes")
            self.events.append(
                {"kind": "nobody_takes", "tick": self.trade_tick, "side": side}
            )
            return

        assert buyer.v_cents is not None and seller.v_cents is not None
        negotiable_max = min(size, buyer.cash_cents // price_at, seller.shares)
        counterparty = buyer if side == "sell" else seller
        if side == "sell":
            advantage = max(0, buyer.v_cents - price_at) / price_at
        else:
            advantage = max(0, price_at - seller.v_cents) / price_at
        counterparty_conviction = conviction(counterparty.stubbornness)
        response_strength = counterparty_conviction + (1 - counterparty_conviction) * min(
            1.0, advantage
        )
        counterproposal = max(1, ceil(negotiable_max * response_strength))
        range_min = min(counterproposal, negotiable_max)
        quantity = self.rng.randint(range_min, negotiable_max)
        buyer_value = buyer.v_cents
        seller_value = seller.v_cents
        buyer_conviction = conviction(buyer.stubbornness)
        seller_conviction = conviction(seller.stubbornness)

        seller.shares -= quantity
        buyer.shares += quantity
        buyer.cash_cents -= quantity * price_at
        seller.cash_cents += quantity * price_at
        self.log.append(f"{buyer.name} takes {quantity} @ {_money(price_at)}")
        self.events.append(
            {
                "kind": "trade",
                "tick": self.trade_tick,
                "buyer": buyer.name,
                "seller": seller.name,
                "quantity": quantity,
                "price_cents": price_at,
                "buyer_value_cents": buyer_value,
                "seller_value_cents": seller_value,
                "buyer_conviction": buyer_conviction,
                "seller_conviction": seller_conviction,
                "counterproposal": counterproposal,
                "range_min": range_min,
                "range_max": negotiable_max,
            }
        )
        self.last_price_cents = price_at
        self._follow_tape(price_at)

    def _follow_tape(self, price: int) -> None:
        for inv in self.investors:
            assert inv.v_cents is not None
            inv.v_cents = nudge_v(inv.v_cents, inv.stubbornness, price)
