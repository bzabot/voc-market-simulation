import random
import unittest
from unittest.mock import patch

import sim
import ui


class BeliefTests(unittest.TestCase):
    def test_drawn_beliefs_sum_to_one(self):
        rng = random.Random(0)
        for _ in range(50):
            belief = sim.draw_belief(rng)
            self.assertEqual(len(belief), 4)
            self.assertAlmostEqual(sum(belief), 1.0)

    def test_reservation_uses_four_payoffs_in_cents(self):
        # all mass on lost -> $20/share = 2000 cents
        self.assertEqual(sim.reservation_cents((1.0, 0.0, 0.0, 0.0)), 2000)
        self.assertEqual(sim.reservation_cents((0.0, 0.0, 0.0, 1.0)), 18000)
        self.assertEqual(sim.reservation_cents((0.25, 0.25, 0.25, 0.25)), 10000)


class IpoTests(unittest.TestCase):
    def test_willing_buyer_gets_one_seeded_allocation_and_keeps_unused_cash(self):
        market = sim.Market.for_test(
            investors=[
                sim.Investor("Anna", cash_cents=50_000, shares=0, belief=(0, 0, 0, 1)),
                sim.Investor("Willem", cash_cents=3_000_00, shares=0, belief=(1, 0, 0, 0)),
            ],
            rng=random.Random(1),
        )
        with patch.object(market.rng, "randint", return_value=2) as randint:
            while market.step():
                pass

        anna = market.investor("Anna")
        willem = market.investor("Willem")
        self.assertEqual(anna.shares, 2)
        self.assertEqual(anna.cash_cents, 30_000)
        self.assertEqual(willem.shares, 0)
        self.assertEqual(willem.cash_cents, 3_000_00)
        self.assertEqual(market.treasury_shares, 998)
        self.assertEqual(market.company_cash_cents, 2 * 100_00)
        self.assertEqual(market.last_price_cents, 100_00)
        randint.assert_called_once_with(1, 5)

    def test_each_willing_investor_gets_one_subscription_opportunity(self):
        market = sim.Market.for_test(
            investors=[
                sim.Investor("Anna", cash_cents=30_000, shares=0, belief=(0, 0, 0, 1)),
                sim.Investor("Maria", cash_cents=30_000, shares=0, belief=(0, 0, 0, 1)),
            ],
            rng=random.Random(0),
        )
        with patch.object(market.rng, "shuffle", return_value=None), patch.object(
            market.rng, "randint", side_effect=[1, 2]
        ) as randint:
            while market.step():
                pass

        self.assertEqual([investor.shares for investor in market.investors], [1, 2])
        self.assertEqual(randint.call_args_list, [unittest.mock.call(1, 3), unittest.mock.call(1, 3)])

    def test_unwilling_investor_does_not_buy_at_ipo(self):
        market = sim.Market.for_test(
            investors=[
                sim.Investor("Willem", cash_cents=60_000_00, shares=0, belief=(1, 0, 0, 0)),
                sim.Investor("Anna", cash_cents=9_999, shares=0, belief=(0, 0, 0, 1)),
            ],
            rng=random.Random(0),
        )
        market.step()
        self.assertEqual(market.investor("Willem").shares, 0)
        self.assertEqual(market.investor("Anna").shares, 0)
        self.assertEqual(market.treasury_shares, 1000)
        self.assertIn("IPO closed", market.log[-1])


class TradeTests(unittest.TestCase):
    def market(self, investors, side):
        market = sim.Market.for_test(
            investors=investors,
            rng=random.Random(0),
            treasury_shares=0,
            phase="trade",
        )
        market.trade_tick = 7
        return market, patch.object(
            market.rng, "random", return_value=0.0 if side == "sell" else 1.0
        )

    def test_conviction_clamps_and_scales_stubbornness(self):
        self.assertEqual(sim.conviction(0.0), 0.0)
        self.assertAlmostEqual(sim.conviction(0.55), 0.5)
        self.assertEqual(sim.conviction(1.0), 1.0)

    def test_opening_sell_quantity_uses_capacity_and_conviction_over_ten(self):
        seller = sim.Investor("Pieter", 0, 31, (1, 0, 0, 0), stubbornness=0.55)
        buyer = sim.Investor("Anna", 100_000, 0, (0, 0, 0, 1))
        market, choose_sell = self.market([seller, buyer], "sell")
        with choose_sell, patch.object(market.rng, "shuffle", return_value=None), patch.object(
            market.rng, "randint", return_value=16
        ):
            market._one_trade()
        self.assertEqual(market.events[0], {
            "kind": "offer", "tick": 7, "name": "Pieter", "size": 16, "price_cents": 2_000
        })

    def test_opening_buy_quantity_uses_affordable_capacity_and_conviction(self):
        buyer = sim.Investor("Anna", 61_000, 0, (1, 0, 0, 0), stubbornness=0.55)
        seller = sim.Investor("Pieter", 0, 40, (1, 0, 0, 0))
        market, choose_buy = self.market([buyer, seller], "buy")
        with choose_buy, patch.object(market.rng, "shuffle", return_value=None), patch.object(
            market.rng, "randint", return_value=15
        ):
            market._one_trade()
        self.assertEqual(market.events[0], {
            "kind": "bid", "tick": 7, "name": "Anna", "size": 15, "price_cents": 2_000
        })

    def test_failed_sell_offer_identifies_missing_buyer(self):
        market = sim.Market.for_test(
            investors=[sim.Investor("Anna", cash_cents=0, shares=20, belief=(0, 0, 0, 1))],
            rng=random.Random(0),
            treasury_shares=0,
            phase="trade",
        )
        market._one_trade()
        self.assertEqual(market.events[-1], {"kind": "nobody_takes", "tick": 0, "side": "sell"})
        self.assertEqual(market.events[0]["tick"], 0)

    def test_failed_buy_bid_identifies_missing_seller(self):
        market = sim.Market.for_test(
            investors=[sim.Investor("Anna", cash_cents=50_000_00, shares=0, belief=(0, 0, 0, 1))],
            rng=random.Random(0),
            treasury_shares=0,
            phase="trade",
        )
        market._one_trade()
        self.assertEqual(market.events[-1], {"kind": "nobody_takes", "tick": 0, "side": "buy"})
        self.assertEqual(market.events[0]["tick"], 0)

    def test_equal_values_trade_and_preserve_pre_tape_negotiation_facts(self):
        seller = sim.Investor("Pieter", 0, 20, (0.25, 0.25, 0.25, 0.25), stubbornness=0.55)
        buyer = sim.Investor("Anna", 200_000, 0, (0.25, 0.25, 0.25, 0.25), stubbornness=0.27)
        market, choose_sell = self.market([seller, buyer], "sell")
        with choose_sell, patch.object(market.rng, "shuffle", return_value=None), patch.object(
            market.rng, "randint", return_value=8
        ):
            market._one_trade()

        trade = market.events[-1]
        self.assertEqual(trade["quantity"], 8)
        self.assertEqual(trade["buyer_value_cents"], 10_000)
        self.assertEqual(trade["seller_value_cents"], 10_000)
        self.assertAlmostEqual(trade["buyer_conviction"], 0.1)
        self.assertAlmostEqual(trade["seller_conviction"], 0.5)
        self.assertEqual(trade["counterproposal"], 1)
        self.assertEqual((trade["range_min"], trade["range_max"]), (1, 10))
        self.assertLessEqual(trade["range_min"], trade["quantity"])
        self.assertLessEqual(trade["quantity"], trade["range_max"])
        self.assertEqual([e["kind"] for e in sim.investor_tape(market.events, "Anna")], ["trade"])
        self.assertEqual([e["kind"] for e in sim.investor_tape(market.events, "Pieter")], ["offer", "trade"])

    def test_trade_records_values_before_following_tape(self):
        seller = sim.Investor("Pieter", 0, 20, (0.25, 0.25, 0.25, 0.25), stubbornness=0.55)
        buyer = sim.Investor("Anna", 200_000, 0, (1, 0, 0, 0), stubbornness=0.27, v_cents=12_500)
        market, choose_sell = self.market([seller, buyer], "sell")
        with choose_sell, patch.object(market.rng, "shuffle", return_value=None), patch.object(
            market.rng, "randint", side_effect=lambda low, high: low
        ):
            market._one_trade()
        self.assertEqual(market.events[-1]["buyer_value_cents"], 12_500)
        self.assertNotEqual(buyer.v_cents, 12_500)

    def test_favorable_advantage_raises_counterproposal(self):
        def counterproposal(buyer_value):
            seller = sim.Investor("Pieter", 0, 20, (0.25, 0.25, 0.25, 0.25), stubbornness=0.55)
            buyer = sim.Investor("Anna", 400_000, 0, (1, 0, 0, 0), stubbornness=0.27, v_cents=buyer_value)
            market, choose_sell = self.market([seller, buyer], "sell")
            with choose_sell, patch.object(market.rng, "shuffle", return_value=None), patch.object(
                market.rng, "randint", side_effect=lambda low, high: low
            ):
                market._one_trade()
            return market.events[-1]["counterproposal"]

        self.assertGreater(counterproposal(15_000), counterproposal(10_000))

    def test_first_compatible_counterparty_alone_trades_and_conserves_assets(self):
        seller = sim.Investor("Pieter", 0, 20, (1, 0, 0, 0), stubbornness=0.9)
        first = sim.Investor("Anna", 6_000, 0, (0, 0, 0, 1), stubbornness=0.9)
        second = sim.Investor("Maria", 100_000, 0, (0, 0, 0, 1), stubbornness=0.9)
        market, choose_sell = self.market([seller, first, second], "sell")
        cash_before = sum(i.cash_cents for i in market.investors)
        shares_before = sum(i.shares for i in market.investors)
        with choose_sell, patch.object(market.rng, "shuffle", return_value=None), patch.object(
            market.rng, "randint", side_effect=lambda low, high: high
        ):
            market._one_trade()

        trades = [e for e in market.events if e["kind"] == "trade"]
        self.assertEqual(len(trades), 1)
        self.assertEqual(trades[0]["buyer"], "Anna")
        self.assertEqual(first.shares, 3)
        self.assertEqual(second.shares, 0)
        self.assertEqual(sum(i.cash_cents for i in market.investors), cash_before)
        self.assertEqual(sum(i.shares for i in market.investors), shares_before)
        self.assertNotIn("unfilled", [e["kind"] for e in market.events])


class LogTailTests(unittest.TestCase):
    def test_keeps_newest_lines(self):
        self.assertEqual(ui.log_tail(["a", "b", "c"], 2), ["b", "c"])

    def test_empty_is_waiting(self):
        self.assertEqual(ui.log_tail([], 5), ["(waiting)"])


class PayoutTests(unittest.TestCase):
    def test_voyage_pays_value_per_share(self):
        holder = sim.Investor("Jan", cash_cents=0, shares=100, belief=(0.25, 0.25, 0.25, 0.25))
        market = sim.Market.for_test(
            investors=[holder],
            rng=random.Random(0),
            treasury_shares=900,
            company_cash_cents=0,
            phase="voyage",
            hidden_outcome="poor",
        )
        market.step()
        # poor: $70/share = 7000 cents
        self.assertEqual(market.investor("Jan").cash_cents, 100 * 7000)
        self.assertEqual(market.company_cash_cents, 900 * 7000)
        self.assertEqual(market.voyage_shown, "poor")


class TapeTests(unittest.TestCase):
    def test_low_stubbornness_moves_more_toward_print(self):
        jumpy = sim.nudge_v(10_000, stubbornness=0.2, price=20_000)
        stuck = sim.nudge_v(10_000, stubbornness=0.9, price=20_000)
        self.assertGreater(jumpy, 10_000)
        self.assertGreater(stuck, 10_000)
        self.assertGreater(jumpy, stuck)

    def test_failed_offer_does_not_change_v(self):
        seller = sim.Investor("Anna", cash_cents=0, shares=20, belief=(0, 0, 0, 1))
        buyer = sim.Investor("Pieter", cash_cents=50_000_00, shares=0, belief=(1, 0, 0, 0))
        market = sim.Market.for_test(
            investors=[seller, buyer], rng=random.Random(1), treasury_shares=0, phase="trade"
        )
        v0, v1 = seller.v_cents, buyer.v_cents
        with patch.object(market.rng, "random", return_value=0.0):
            market._one_trade()
        self.assertEqual(seller.v_cents, v0)
        self.assertEqual(buyer.v_cents, v1)

    def test_nudge_clamps_to_payoff_range(self):
        self.assertEqual(sim.nudge_v(18_000, stubbornness=0.0, price=30_000), 18_000)
        self.assertEqual(sim.nudge_v(2_000, stubbornness=0.0, price=0), 2_000)


class PnlTests(unittest.TestCase):
    def test_total_and_percent_vs_opening_cash(self):
        holder = sim.Investor(
            "Jan",
            cash_cents=0,
            shares=100,
            belief=(0.25, 0.25, 0.25, 0.25),
            start_cash_cents=10_000_00,
        )
        market = sim.Market.for_test(
            investors=[holder],
            rng=random.Random(0),
            treasury_shares=900,
            company_cash_cents=0,
            phase="voyage",
            hidden_outcome="poor",
        )
        market.step()
        row = market.pnl_rows()[0]
        self.assertEqual(row.name, "Jan")
        self.assertEqual(row.start_cents, 10_000_00)
        self.assertEqual(row.end_cents, 100 * 7000)
        self.assertEqual(row.total_cents, 100 * 7000 - 10_000_00)
        self.assertAlmostEqual(row.pct, 100 * row.total_cents / row.start_cents)

    def test_pnl_sorts_by_total_then_name(self):
        a = sim.PnlRow("Berta", 100, 150, 50, 50.0)
        b = sim.PnlRow("Anna", 100, 150, 50, 50.0)
        c = sim.PnlRow("Carel", 100, 80, -20, -20.0)
        ranked = sim.rank_pnl([c, a, b])
        self.assertEqual([r.name for r in ranked], ["Anna", "Berta", "Carel"])


class SnapshotTests(unittest.TestCase):
    def test_ipo_close_snapshot_precedes_first_trade_snapshot(self):
        market = sim.Market(
            rng=random.Random(0),
            investors=[sim.Investor("Willem", 0, 0, (1, 0, 0, 0))],
        )

        market.step()
        ipo_close = market.frames[-1]
        market.step()
        first_trade = market.frames[-1]

        self.assertEqual(ipo_close["phase"], "ipo")
        self.assertEqual(ipo_close["header"], "IPO")
        self.assertEqual(ipo_close["events"][-1]["kind"], "ipo_closed")
        self.assertEqual(first_trade["phase"], "trade")
        self.assertEqual(first_trade["header"], "1/40")

    def test_step_records_independent_frame(self):
        market = sim.Market.for_test(
            investors=[
                sim.Investor("Anna", cash_cents=50_000_00, shares=0, belief=(0, 0, 0, 1)),
            ],
            rng=random.Random(1),
        )
        market.step()
        frame = market.frames[-1]
        cash_after_first = frame["investors"][0]["cash_cents"]
        market.investor("Anna").cash_cents = 1
        self.assertEqual(frame["investors"][0]["cash_cents"], cash_after_first)
        self.assertNotEqual(market.investor("Anna").cash_cents, cash_after_first)

    def test_frame_has_stubbornness_not_hidden_outcome(self):
        market = sim.Market.for_test(
            investors=[
                sim.Investor(
                    "Willem",
                    cash_cents=60_000_00,
                    shares=0,
                    belief=(1, 0, 0, 0),
                    stubbornness=0.8,
                ),
            ],
            rng=random.Random(0),
        )
        market.step()
        frame = market.frames[-1]
        self.assertNotIn("hidden_outcome", frame)
        self.assertIsNone(frame["voyage_shown"])
        self.assertEqual(frame["investors"][0]["stubbornness"], 0.8)

    def test_voyage_frame_shows_outcome_not_hidden_field(self):
        holder = sim.Investor("Jan", cash_cents=0, shares=100, belief=(0.25, 0.25, 0.25, 0.25))
        market = sim.Market.for_test(
            investors=[holder],
            rng=random.Random(0),
            treasury_shares=900,
            company_cash_cents=0,
            phase="voyage",
            hidden_outcome="poor",
        )
        market.step()
        frame = market.frames[-1]
        self.assertEqual(frame["voyage_shown"], "poor")
        self.assertNotIn("hidden_outcome", frame)
        self.assertTrue(frame["done"])

    def test_ipo_fill_event_includes_name(self):
        market = sim.Market.for_test(
            investors=[
                sim.Investor("Anna", cash_cents=50_000_00, shares=0, belief=(0, 0, 0, 1)),
                sim.Investor("Willem", cash_cents=3_000_00, shares=0, belief=(1, 0, 0, 0)),
            ],
            rng=random.Random(1),
        )
        market.step()
        ev = market.events[0]
        self.assertEqual(ev["kind"], "ipo_fill")
        self.assertEqual(ev["name"], "Anna")
        self.assertEqual(ev["size"], market.investor("Anna").shares)
        self.assertIn(ev["size"], range(1, 501))

    def test_new_accepts_seed(self):
        a = sim.Market.new(seed=42)
        b = sim.Market.new(seed=42)
        while a.step():
            pass
        while b.step():
            pass
        self.assertEqual(a.snapshot(), b.snapshot())


class TapeTestsFilter(unittest.TestCase):
    def test_investor_tape_keeps_events_involving_name(self):
        events = [
            {"kind": "ipo_fill", "name": "Anna", "size": 10},
            {"kind": "offer", "name": "Pieter", "size": 2},
            {
                "kind": "trade",
                "buyer": "Anna",
                "seller": "Pieter",
                "quantity": 2,
            },
            {"kind": "payout", "name": "Willem", "size": 1},
        ]
        tape = sim.investor_tape(events, "Anna")
        kinds = [e["kind"] for e in tape]
        self.assertEqual(kinds, ["ipo_fill", "trade"])
        self.assertEqual(sim.investor_tape(events, "Pieter")[0]["kind"], "offer")
        self.assertEqual(sim.investor_tape(events, "Pieter")[1]["kind"], "trade")


class FormatTests(unittest.TestCase):
    def test_signed_money_and_pct(self):
        self.assertEqual(ui.signed_money(4_200_00), "+$4,200.00")
        self.assertEqual(ui.signed_money(-1_200_00), "-$1,200.00")
        self.assertEqual(ui.signed_money(0), "$0.00")
        self.assertEqual(ui.signed_pct(28.0), "+28.0%")
        self.assertEqual(ui.signed_pct(-12.3), "-12.3%")
        self.assertEqual(ui.signed_pct(0.0), "0.0%")


if __name__ == "__main__":
    unittest.main()
