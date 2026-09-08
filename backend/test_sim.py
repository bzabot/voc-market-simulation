import random
import unittest

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
        self.assertEqual(sim.reservation_cents((0.0, 0.0, 0.0, 1.0)), 25000)


class IpoTests(unittest.TestCase):
    def test_willing_buyer_takes_shares_and_pays_company(self):
        market = sim.Market.for_test(
            investors=[
                sim.Investor("Anna", cash_cents=50_000_00, shares=0, belief=(0, 0, 0, 1)),
                sim.Investor("Willem", cash_cents=3_000_00, shares=0, belief=(1, 0, 0, 0)),
            ],
            rng=random.Random(1),
        )
        while market.phase == "ipo":
            market.step()

        anna = market.investor("Anna")
        willem = market.investor("Willem")
        self.assertEqual(anna.shares, 500)
        self.assertEqual(anna.cash_cents, 0)
        self.assertEqual(willem.shares, 0)
        self.assertEqual(willem.cash_cents, 3_000_00)
        self.assertEqual(market.treasury_shares, 500)
        self.assertEqual(market.company_cash_cents, 500 * 100_00)
        self.assertEqual(market.last_price_cents, 100_00)

    def test_unwilling_investor_does_not_buy_at_ipo(self):
        market = sim.Market.for_test(
            investors=[
                sim.Investor("Willem", cash_cents=60_000_00, shares=0, belief=(1, 0, 0, 0)),
            ],
            rng=random.Random(0),
        )
        market.step()
        self.assertEqual(market.investor("Willem").shares, 0)
        self.assertEqual(market.treasury_shares, 1000)
        self.assertIn("IPO closed", market.log[-1])


class TradeTests(unittest.TestCase):
    def test_sell_offer_fills_when_buyer_values_higher(self):
        seller = sim.Investor("Pieter", cash_cents=0, shares=20, belief=(1, 0, 0, 0))
        buyer = sim.Investor("Anna", cash_cents=50_000_00, shares=0, belief=(0, 0, 0, 1))
        logs = sim.fill_sell_offer(
            seller,
            buyer_order=[buyer],
            size=10,
        )
        self.assertEqual(seller.shares, 10)
        self.assertEqual(buyer.shares, 10)
        self.assertEqual(buyer.cash_cents, 50_000_00 - 10 * seller.v_cents)
        self.assertEqual(seller.cash_cents, 10 * seller.v_cents)
        self.assertEqual(logs[-1], f"Anna takes 10 @ ${seller.v_cents / 100:.2f}")

    def test_sell_offer_rejected_when_buyer_values_lower(self):
        seller = sim.Investor("Anna", cash_cents=0, shares=20, belief=(0, 0, 0, 1))
        buyer = sim.Investor("Pieter", cash_cents=50_000_00, shares=0, belief=(1, 0, 0, 0))
        logs = sim.fill_sell_offer(seller, buyer_order=[buyer], size=5)
        self.assertEqual(seller.shares, 20)
        self.assertEqual(buyer.shares, 0)
        self.assertEqual(logs[-1], "nobody takes")


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
        v0, v1 = seller.v_cents, buyer.v_cents
        sim.fill_sell_offer(seller, buyer_order=[buyer], size=5)
        self.assertEqual(seller.v_cents, v0)
        self.assertEqual(buyer.v_cents, v1)

    def test_nudge_clamps_to_payoff_range(self):
        self.assertEqual(sim.nudge_v(25_000, stubbornness=0.0, price=30_000), 25_000)
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
        self.assertEqual(ev["size"], 500)

    def test_new_accepts_seed(self):
        a = sim.Market.new(seed=42)
        b = sim.Market.new(seed=42)
        self.assertEqual([i.name for i in a.investors], [i.name for i in b.investors])
        self.assertEqual(a.hidden_outcome, b.hidden_outcome)


class TapeTestsFilter(unittest.TestCase):
    def test_investor_tape_keeps_events_involving_name(self):
        events = [
            {"kind": "ipo_fill", "name": "Anna", "size": 10},
            {"kind": "offer", "name": "Pieter", "size": 2},
            {"kind": "take", "name": "Anna", "other": "Pieter", "size": 2},
            {"kind": "payout", "name": "Willem", "size": 1},
        ]
        tape = sim.investor_tape(events, "Anna")
        kinds = [e["kind"] for e in tape]
        self.assertEqual(kinds, ["ipo_fill", "take"])
        self.assertEqual(sim.investor_tape(events, "Pieter")[0]["kind"], "offer")


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
