from __future__ import annotations

import argparse
import select
import sys
import termios
import tty

from rich.live import Live

from sim import Market
from ui import render

AUTO_DT = 0.4


class RawStdin:
    def __init__(self) -> None:
        self.fd = sys.stdin.fileno()
        self.old = termios.tcgetattr(self.fd)
        tty.setcbreak(self.fd)

    def close(self) -> None:
        termios.tcsetattr(self.fd, termios.TCSADRAIN, self.old)

    def read_key(self, timeout: float | None) -> str | None:
        ready, _, _ = select.select([sys.stdin], [], [], timeout)
        if not ready:
            return None
        ch = sys.stdin.read(1)
        if ch in ("\n", "\r"):
            return "enter"
        return ch


def _read_key(raw: RawStdin | None, timeout: float | None) -> str | None:
    if raw is not None:
        return raw.read_key(timeout)
    if timeout is not None:
        return None
    line = input()
    if line.lower().startswith("q"):
        return "q"
    if line.lower().startswith("a"):
        return "a"
    if line.lower().startswith("s"):
        return "s"
    return "enter"


def main() -> None:
    parser = argparse.ArgumentParser(description="VOC market simulation")
    parser.add_argument("--auto", action="store_true", help="start in AUTO")
    args = parser.parse_args()

    market = Market.new()
    mode = "AUTO" if args.auto else "STEP"
    raw: RawStdin | None = None
    try:
        if sys.stdin.isatty():
            raw = RawStdin()
        elif mode == "AUTO":
            mode = "STEP"
    except termios.error:
        raw = None
        mode = "STEP"

    frozen = False
    try:
        with Live(
            screen=True,
            refresh_per_second=12,
            vertical_overflow="crop",
        ) as live:
            def frame() -> None:
                size = live.console.size
                live.update(render(market, mode, size.height, size.width))

            frame()
            while True:
                frame()
                if frozen:
                    key = _read_key(raw, None)
                    if key in ("q", "Q"):
                        return
                    continue
                if mode == "STEP":
                    key = _read_key(raw, None)
                    if key in ("q", "Q"):
                        return
                    if key in ("a", "A"):
                        mode = "AUTO"
                        continue
                    if key in ("s", "S"):
                        continue
                    if key in ("enter", " "):
                        market.step()
                        if market.phase == "voyage":
                            frozen = True
                    continue
                key = _read_key(raw, AUTO_DT)
                if key is None:
                    market.step()
                    if market.phase == "voyage":
                        frozen = True
                    continue
                if key in ("q", "Q"):
                    return
                if key in ("a", "A"):
                    continue
                mode = "STEP"
    finally:
        if raw is not None:
            raw.close()


if __name__ == "__main__":
    main()
