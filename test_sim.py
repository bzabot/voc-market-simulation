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


if __name__ == "__main__":
    unittest.main()
