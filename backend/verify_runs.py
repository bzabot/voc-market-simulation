import argparse
import json
import sys
from pathlib import Path

from sim import IPO_PRICE_CENTS, TRADE_TICKS


TRADE_FIELDS = {
    "kind": str,
    "tick": int,
    "buyer": str,
    "seller": str,
    "quantity": int,
    "price_cents": int,
    "buyer_value_cents": int,
    "seller_value_cents": int,
    "buyer_conviction": (int, float),
    "seller_conviction": (int, float),
    "counterproposal": int,
    "range_min": int,
    "range_max": int,
}


def require_int(value, label):
    if type(value) is not int:
        raise ValueError(f"{label} must be an integer")
    return value


def verify(path):
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read valid JSON: {exc}") from exc

    try:
        seed = require_int(data["seed"], "seed")
        ipo = data["ipo"]
        shares_sold = require_int(ipo["shares_sold"], "ipo.shares_sold")
        company_cash = require_int(ipo["company_cash_cents"], "ipo.company_cash_cents")
        investors = data["investors"]
        ticker = data["ticker"]
        events = data["events"]
    except (KeyError, TypeError) as exc:
        raise ValueError(f"missing or malformed top-level field: {exc}") from exc

    if shares_sold < 0 or company_cash < 0:
        raise ValueError("IPO shares and company cash must not be negative")
    if company_cash != shares_sold * IPO_PRICE_CENTS:
        raise ValueError(
            f"ipo.company_cash_cents={company_cash} does not equal "
            f"shares_sold * {IPO_PRICE_CENTS}"
        )

    held = 0
    for index, investor in enumerate(investors):
        label = f"investors[{index}]"
        try:
            name = investor["name"]
            cash = require_int(investor["end_cash_cents"], f"{label}.end_cash_cents")
            shares = require_int(investor["shares_held"], f"{label}.shares_held")
            start_cash = require_int(investor["start_cash_cents"], f"{label}.start_cash_cents")
        except (KeyError, TypeError) as exc:
            raise ValueError(f"{label} is malformed: {exc}") from exc
        if not isinstance(name, str) or not name:
            raise ValueError(f"{label}.name must be a nonempty string")
        if cash < 0 or start_cash < 0 or shares < 0:
            raise ValueError(f"investor {name} has negative cash or shares")
        held += shares
    if held != shares_sold:
        raise ValueError(
            f"share conservation failed: investor shares={held}, ipo.shares_sold={shares_sold}"
        )

    expected_headers = [f"{tick}/{TRADE_TICKS}" for tick in range(1, TRADE_TICKS + 1)]
    try:
        headers = [frame["tick"] for frame in ticker]
        prices = [require_int(frame["last_price_cents"], f"ticker[{i}].last_price_cents") for i, frame in enumerate(ticker)]
    except (KeyError, TypeError) as exc:
        raise ValueError(f"ticker is malformed: {exc}") from exc
    if len(ticker) != TRADE_TICKS:
        raise ValueError(f"ticker length is {len(ticker)}, expected {TRADE_TICKS}")
    if headers != expected_headers:
        raise ValueError(
            f"ticker headers are {headers!r}, expected "
            f"1/{TRADE_TICKS} through {TRADE_TICKS}/{TRADE_TICKS}"
        )
    if any(price <= 0 for price in prices):
        raise ValueError("ticker prices must be positive integers")

    trades = 0
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            raise ValueError(f"events[{index}] must be an object")
        if event.get("kind") == "unfilled":
            raise ValueError(f"events[{index}] is forbidden unfilled event")
        if event.get("kind") != "trade":
            continue
        trades += 1
        for field, expected_type in TRADE_FIELDS.items():
            if field not in event:
                raise ValueError(f"trade event {index} missing field {field}")
            if isinstance(event[field], bool) or not isinstance(event[field], expected_type):
                raise ValueError(f"trade event {index} field {field} has wrong type")
        if not event["buyer"] or not event["seller"] or event["buyer"] == event["seller"]:
            raise ValueError(f"trade event {index} has nonsensical buyer or seller")
        if event["quantity"] <= 0:
            raise ValueError(f"trade event {index} quantity must be positive")
        if not 1 <= event["range_min"] <= event["quantity"] <= event["range_max"]:
            raise ValueError(
                f"trade event {index} requires 1 <= range_min <= quantity <= range_max"
            )
        if not 1 <= event["counterproposal"] <= event["range_max"]:
            raise ValueError(
                f"trade event {index} counterproposal must be within [1, range_max]"
            )
        if min(event["price_cents"], event["buyer_value_cents"], event["seller_value_cents"]) <= 0:
            raise ValueError(f"trade event {index} prices and valuations must be positive")
        if not event["seller_value_cents"] <= event["price_cents"] <= event["buyer_value_cents"]:
            raise ValueError(f"trade event {index} price is incompatible with buyer or seller value")
        if not all(0 <= event[field] <= 1 for field in ("buyer_conviction", "seller_conviction")):
            raise ValueError(f"trade event {index} conviction must be within [0, 1]")
    return seed, trades


def main():
    parser = argparse.ArgumentParser(description="Validate headless simulation JSON files.")
    parser.add_argument("directory", type=Path)
    directory = parser.parse_args().directory
    files = sorted(directory.glob("run-*.json"))
    if not files:
        print(f"error: no run-*.json files in {directory}", file=sys.stderr)
        return 1
    for path in files:
        try:
            seed, trades = verify(path)
        except ValueError as exc:
            print(f"error: {path}: {exc}", file=sys.stderr)
            return 1
        print(f"{path.name}: seed={seed} trades={trades}")
    print(f"OK: {len(files)} run files verified")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
