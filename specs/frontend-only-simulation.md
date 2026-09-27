# Frontend-only simulation

The app runs from the frontend alone. A visitor can start a market, step through it, and replay it with no Python process and no deployed API.

## Runtime

The browser is the only runtime. Delete `backend/`, including FastAPI, the terminal UI in `main.py` and `ui.py`, the headless JSON runner in `run.py`, `verify_runs.py`, and the Python tests.

Translate `backend/sim.py` into `frontend/src/sim.js` first, then delete `backend/`. The React page imports that module and keeps the current screens. Step, auto-play, frame history, replay, and investor inspection all read the market held in the page.

Each tab owns its run. Loading the app still starts a fresh run, and a refresh starts another one. The page has no seed field.

Delete `frontend/src/api.js`. Remove the `/api` proxy from `frontend/vite.config.js`. Point the production build at `frontend/dist` instead of `backend/static`.

Run it with:

```text
cd frontend && npm install && npm run dev
```

`npm run build` followed by `npm run preview` serves that static build. Both paths work with nothing else running.

Update the README layout and run sections so they describe this frontend-only app. Leave `specs/market-formation-negotiation.md` and the notes under `docs/superpowers/specs/` as they are.

## Engine

`sim.js` keeps the current market. One company, 1000 shares, an IPO at $100, 40 trade ticks, then the voyage payoff. Same investor names, cash ladder, outcomes, beliefs, stubbornness, conviction, tape nudge, IPO subscription, and negotiated trade quantities described in `specs/market-formation-negotiation.md`.

Snapshots keep the fields the page already reads.

- `header`, `phase`, `last_price_cents`, `treasury_shares`, `company_cash_cents`, `voyage_shown`, `done`
- `investors`, each with `name`, `cash_cents`, `shares`, `v_cents`, `start_cash_cents`, `stubbornness`
- `log` and `events`

Investor inspection is calculated in the page. The replay panel keeps receiving `name`, `start_cents`, `end_cents`, `total_cents`, `pct`, `stubbornness`, and `tape`. The tape is the events whose `name`, `buyer`, or `seller` is that investor. P&L uses the same ranking as today, by profit descending, then by name.

`reservation_cents`, `nudge_v`, and `conviction` use Python 3 rounding, which ties to even. `Math.round` ties away from zero, and a one-cent difference changes who is willing to trade. Use half-to-even in those three functions. `conviction` still rounds to 12 decimal places before the clamp.

The random source is a short seedable generator with `random`, `randint`, `choice`, and `shuffle`. The same seed passed to two new markets produces the same final snapshot in this engine. A seed of 42 here has no duty to match Python's `random.Random(42)`. Tests can replace those four operations, as the Python tests patch them, and tests can build a market at a chosen phase the way `Market.for_test` does.

`frontend/src/format.js` repeats the share count, IPO price, value bounds, trade-tick count, and outcome table. After the port, `sim.js` owns those numbers and `format.js` imports them.

On the last voyage step the market records the frame and reports itself done, and the page enters replay from that. Frames already stored in the page are the replay history.

## Out of this change

The terminal UI and the JSON run dumps end with `backend/`. The page grows no exporter for them.

A new run in the browser draws a fresh seed. Only tests pass a seed in.

Agent-count controls and a switch to freeze belief updates stay future work.

The generator stays a small function in this module. It is not a port of CPython's Mersenne Twister.

## Check

Add an `npm test` script in `frontend/package.json`. Port the market-rule tests from `backend/test_sim.py` to it.

- Beliefs, IPO subscriptions, and trades
- Payouts, the price tape, and P&L ranking
- Snapshots and the investor tape filter
- Two markets created with the same seed finish on the same snapshot

Leave `LogTailTests` and `FormatTests` behind. They cover the terminal renderer. Leave `backend/test_web.py` and `backend/test_run.py` behind with the server and the JSON runner.

With no Python process running, open the dev server and walk the page. A run starts on load. Step and auto-play advance it. Previous frame and live still switch the board. The finished run opens the replay. The scrubber moves through stored frames. Selecting an investor shows starting cash, ending cash, profit, stubbornness, and that investor's tape.

Build the static site and open it with `npm run preview`. The same walk works, and the browser issues no request to `/api`.
