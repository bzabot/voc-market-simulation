The goal of this project is to implement a simple market simulation. As visual as possible.
The goal is to implement what happening in Netherlands, the first stock market with Dutch East India Company, the VOC.

- We will use AI only where it is necessary. There is an OPEN_AI_API_KEY with 4$ of credits in the current folder.
- We will not use AI; the simulation uses a seeded generator in `frontend/src/sim.js` for randomness.

Scenario:

- There is only one company
- It needs capital for an expedition
- Investors have cash, some have more cash, some have less cash
- The company issues a fixed number of shares
- Investors buy those shares
- The expedition later produces some uncertain payoff
- Shareholders receive the economic benefit
- Crucially, investors can sell their ownership to each other before the expedition is over.

Initial version:

- No order book. No bid/ask spread. No market makers. No candles. No technical indicators. Just ownership.
- Suppose the company has 1000 shares and needs $100,000. IPO: 1000 shares × $100/share = $100,000.
- An investor buys 20 shares => 20/1000 = 2% of the company.

Uncertainty

- Ship lost -> company value decrease to 20000
- Poor expedition -> company value decrease to 70000
- Normal expedition -> company value increase to 130000
- Excellent expedition -> company value = 180000
- Nobody knows which will happen
- Different investors can have different beliefs
- Shareholders can trade

Layout:

- `frontend/` — React + Tailwind + Base UI (Vite), including the market simulation in `frontend/src/sim.js`
- `specs/` — market rules and product notes

Run:

```text
cd frontend && npm install && npm run dev
```

Static build (output in `frontend/dist`):

```text
cd frontend && npm run build && npm run preview
```

Market-rule tests:

```text
cd frontend && npm test
```
