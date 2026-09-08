from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from sim import Market, investor_tape

_market: Market | None = None

app = FastAPI()


class NewSession(BaseModel):
    seed: int | None = None


def reset_session() -> None:
    global _market
    _market = None


def _require() -> Market:
    if _market is None:
        raise HTTPException(status_code=404, detail="no session")
    return _market


def _payload(market: Market, index: int | None = None) -> dict:
    n = len(market.frames)
    if n == 0:
        return {
            "cursor": None,
            "done": market.done,
            "frame": None,
            "frame_count": 0,
        }
    i = n - 1 if index is None else index
    if i < 0 or i >= n:
        raise HTTPException(status_code=404, detail="no frame")
    return {
        "cursor": i,
        "done": market.done,
        "frame": market.frames[i],
        "frame_count": n,
    }


@app.post("/api/session")
def new_session(body: NewSession | None = None) -> dict:
    global _market
    seed = body.seed if body is not None else None
    _market = Market.new(seed=seed)
    return _payload(_market)


@app.get("/api/session")
def get_session(index: int | None = None) -> dict:
    return _payload(_require(), index)


@app.post("/api/session/step")
def step_session() -> dict:
    market = _require()
    if market.done or not market.step():
        raise HTTPException(status_code=409, detail="done")
    return _payload(market)


@app.get("/api/session/frames")
def get_frames() -> dict:
    return {"frames": _require().frames}


@app.get("/api/session/investors/{name}")
def get_investor(name: str) -> dict:
    market = _require()
    try:
        inv = market.investor(name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="unknown investor") from exc
    start = inv.start_cash_cents or 0
    end = inv.cash_cents
    total = end - start
    pct = 100.0 * total / start if start else 0.0
    return {
        "name": name,
        "start_cents": start,
        "end_cents": end,
        "total_cents": total,
        "pct": pct,
        "stubbornness": inv.stubbornness,
        "tape": investor_tape(market.events, name),
    }


_static = Path(__file__).parent / "static"
if _static.is_dir():
    app.mount("/", StaticFiles(directory=_static, html=True), name="static")
