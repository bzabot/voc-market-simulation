"""Run a full simulation headlessly and dump the results to a JSON file.

The output contains everything needed to audit a run: the seed (always
recorded, so any run can be reproduced), the hidden voyage outcome, the
price ticker, every event, the full log, and per-investor P&L.

Usage:
    python run.py                 # random seed -> runs/run-<ts>-seed<n>.json
    python run.py --seed 42       # reproducible run
    python run.py --count 5       # several runs in one go
    python run.py --out mydir     # custom output directory
"""

from __future__ import annotations

import argparse
import json
import random
from datetime import datetime, timezone
from pathlib import Path

from sim import IPO_PRICE_CENTS, TOTAL_SHARES, Market, OUTCOMES_CENTS_PER_SHARE


def run_once(seed: int) -> dict:
    market = Market.new(seed=seed)
    while market.step():
        pass

    ticker = [
        {
            "tick": f["header"],
            "last_price_cents": f["last_price_cents"],
        }
        for f in market.frames
        if f["phase"] == "trade"
    ]

    investors = [
        {
            "name": inv.name,
            "belief": {
                outcome: round(p, 4)
                for outcome, p in zip(OUTCOMES_CENTS_PER_SHARE, inv.belief, strict=True)
            },
            "stubbornness": round(inv.stubbornness, 4),
            "start_cash_cents": inv.start_cash_cents,
            "end_cash_cents": inv.cash_cents,
            "shares_held": inv.shares,
            "pnl_cents": inv.cash_cents - (inv.start_cash_cents or 0),
        }
        for inv in market.investors
    ]
    shares_sold = TOTAL_SHARES - market.treasury_shares

    return {
        "seed": seed,
        "hidden_outcome": market.hidden_outcome,
        "payout_cents_per_share": OUTCOMES_CENTS_PER_SHARE[market.hidden_outcome],
        "ipo": {
            "shares_sold": shares_sold,
            "company_cash_cents": shares_sold * IPO_PRICE_CENTS,
        },
        "final_price_cents": market.last_price_cents,
        "ticker": ticker,
        "investors": investors,
        "events": market.events,
        "log": market.log,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--seed", type=int, default=None, help="PRNG seed (random if omitted)")
    parser.add_argument("--count", type=int, default=1, help="number of runs")
    parser.add_argument("--out", type=Path, default=Path("runs"), help="output directory")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)
    rng = random.Random()

    for _ in range(args.count):
        seed = args.seed if args.seed is not None else rng.randrange(2**31)
        result = run_once(seed)
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        path = args.out / f"run-{ts}-seed{seed}.json"
        path.write_text(json.dumps(result, indent=2))
        print(f"{path}  outcome={result['hidden_outcome']}  seed={seed}")


if __name__ == "__main__":
    main()
