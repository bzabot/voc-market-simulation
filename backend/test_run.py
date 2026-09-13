import unittest
from types import SimpleNamespace
from unittest.mock import patch

import run


class RunOnceTests(unittest.TestCase):
    def test_ipo_report_uses_share_constants_and_excludes_voyage_payout(self):
        market = SimpleNamespace(
            step=lambda: False,
            frames=[],
            investors=[],
            hidden_outcome="lost",
            treasury_shares=2,
            company_cash_cents=999_999,
            last_price_cents=123,
            events=[],
            log=[],
        )

        with (
            patch.object(run.Market, "new", return_value=market),
            patch.object(run, "TOTAL_SHARES", 7, create=True),
            patch.object(run, "IPO_PRICE_CENTS", 123, create=True),
        ):
            result = run.run_once(seed=1)

        self.assertEqual(result["ipo"], {"shares_sold": 5, "company_cash_cents": 615})

    def test_ticker_contains_exactly_the_forty_trade_frames(self):
        result = run.run_once(seed=42)

        self.assertEqual(len(result["ticker"]), 40)
        self.assertEqual(
            [frame["tick"] for frame in result["ticker"]],
            [f"{tick}/40" for tick in range(1, 41)],
        )

    def test_fixed_seed_produces_identical_result(self):
        self.assertEqual(run.run_once(seed=42), run.run_once(seed=42))


if __name__ == "__main__":
    unittest.main()
