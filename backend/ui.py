from io import StringIO

from rich.console import Console, Group, RenderableType
from rich.layout import Layout
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from sim import TOTAL_SHARES, Market


def _money(cents: int) -> str:
    return f"${cents / 100:,.2f}"


def signed_money(cents: int) -> str:
    if cents == 0:
        return "$0.00"
    sign = "+" if cents > 0 else "-"
    return f"{sign}${abs(cents) / 100:,.2f}"


def signed_pct(pct: float) -> str:
    if pct == 0:
        return "0.0%"
    return f"{pct:+.1f}%"


def log_tail(lines: list[str], n: int) -> list[str]:
    n = max(1, n)
    return (lines or ["(waiting)"])[-n:]


def _height(renderable: RenderableType, width: int) -> int:
    buf = StringIO()
    Console(file=buf, width=width, color_system=None).print(renderable)
    text = buf.getvalue()
    return max(1, text.count("\n"))


def render(market: Market, mode: str, height: int = 24, width: int = 80) -> Layout:
    voyage = market.voyage_shown if market.voyage_shown else "at sea"
    implied = market.last_price_cents * TOTAL_SHARES
    header = Text.assemble(
        ("VOC  ", "bold"),
        (f"{market.header}  ", "cyan"),
        f"last {_money(market.last_price_cents)}  ",
        f"implied {_money(implied)}  ",
        f"voyage: {voyage}  ",
        (f"mode: {mode}", "yellow"),
    )

    table = Table(expand=True)
    if market.voyage_shown:
        table.add_column("name")
        table.add_column("start", justify="right")
        table.add_column("end", justify="right")
        table.add_column("total", justify="right")
        table.add_column("%", justify="right")
        for row in market.pnl_rows():
            table.add_row(
                row.name,
                _money(row.start_cents),
                _money(row.end_cents),
                signed_money(row.total_cents),
                signed_pct(row.pct),
            )
    else:
        table.add_column("name")
        table.add_column("cash", justify="right")
        table.add_column("shares", justify="right")
        table.add_column("%", justify="right")
        table.add_column("belief $/share", justify="right")
        for inv in sorted(market.investors, key=lambda i: i.shares, reverse=True):
            pct = 100.0 * inv.shares / TOTAL_SHARES
            table.add_row(
                inv.name,
                _money(inv.cash_cents),
                str(inv.shares),
                f"{pct:.1f}%",
                _money(inv.v_cents or 0),
            )
        t_pct = 100.0 * market.treasury_shares / TOTAL_SHARES
        table.add_row(
            "treasury",
            _money(market.company_cash_cents),
            str(market.treasury_shares),
            f"{t_pct:.1f}%",
            "—",
            style="dim",
        )

    cap = Group(header, table)
    cap_h = min(_height(cap, width), max(8, height - 5))
    log_h = max(3, height - cap_h)
    inner = max(1, log_h - 2)
    log = Panel(
        Text("\n".join(log_tail(market.log, inner)), overflow="crop", no_wrap=True),
        title="log",
        height=log_h,
    )
    root = Layout()
    root.split_column(
        Layout(cap, name="cap", size=cap_h),
        Layout(log, name="log"),
    )
    return root
