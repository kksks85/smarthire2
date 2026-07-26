"""Filter-operator catalog per column data type.

The frontend consumes this to render an operator dropdown; the backend
query builder resolves each operator to a SQLAlchemy expression.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Callable

from sqlalchemy import and_, or_
from sqlalchemy.sql.elements import ColumnElement


@dataclass(frozen=True)
class Operator:
    key: str
    label: str
    # True when the operator takes NO value (is_null / is_not_null).
    unary: bool = False
    # True when the value is a list (in / between).
    multi: bool = False


# ---------------------------------------------------------------------------
# Per-type operator catalog
# ---------------------------------------------------------------------------

STRING_OPS: list[Operator] = [
    Operator("equals", "equals"),
    Operator("not_equals", "does not equal"),
    Operator("contains", "contains"),
    Operator("starts_with", "starts with"),
    Operator("ends_with", "ends with"),
    Operator("in", "is one of", multi=True),
    Operator("is_null", "is empty", unary=True),
    Operator("is_not_null", "is not empty", unary=True),
]

NUMBER_OPS: list[Operator] = [
    Operator("equals", "="),
    Operator("not_equals", "≠"),
    Operator("gt", ">"),
    Operator("gte", "≥"),
    Operator("lt", "<"),
    Operator("lte", "≤"),
    Operator("between", "between", multi=True),
    Operator("in", "is one of", multi=True),
    Operator("is_null", "is empty", unary=True),
    Operator("is_not_null", "is not empty", unary=True),
]

DATE_OPS: list[Operator] = [
    Operator("equals", "on"),
    Operator("before", "before"),
    Operator("after", "after"),
    Operator("between", "between", multi=True),
    Operator("today", "today", unary=True),
    Operator("this_week", "this week", unary=True),
    Operator("last_7_days", "last 7 days", unary=True),
    Operator("last_30_days", "last 30 days", unary=True),
    Operator("this_month", "this month", unary=True),
    Operator("this_year", "this year", unary=True),
    Operator("is_null", "is empty", unary=True),
    Operator("is_not_null", "is not empty", unary=True),
]

BOOL_OPS: list[Operator] = [
    Operator("is_true", "is true", unary=True),
    Operator("is_false", "is false", unary=True),
]

ENUM_OPS: list[Operator] = [
    Operator("equals", "equals"),
    Operator("not_equals", "does not equal"),
    Operator("in", "is one of", multi=True),
]


OPS_BY_TYPE: dict[str, list[Operator]] = {
    "string": STRING_OPS,
    "text": STRING_OPS,
    "number": NUMBER_OPS,
    "integer": NUMBER_OPS,
    "date": DATE_OPS,
    "datetime": DATE_OPS,
    "bool": BOOL_OPS,
    "boolean": BOOL_OPS,
    "enum": ENUM_OPS,
}


def operators_for(col_type: str) -> list[Operator]:
    return OPS_BY_TYPE.get(col_type, STRING_OPS)


# ---------------------------------------------------------------------------
# Operator → SQL clause
# ---------------------------------------------------------------------------

def _coerce_number(v: Any) -> Any:
    if v is None or v == "":
        return None
    try:
        return float(v) if "." in str(v) else int(v)
    except (TypeError, ValueError):
        return None


def _coerce_date(v: Any) -> Any:
    if v is None or v == "":
        return None
    if isinstance(v, (date, datetime)):
        return v
    s = str(v)
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _period_bounds(op_key: str) -> tuple[datetime, datetime] | None:
    now = datetime.utcnow()
    today = datetime(now.year, now.month, now.day)
    if op_key == "today":
        return today, today + timedelta(days=1)
    if op_key == "this_week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=7)
    if op_key == "last_7_days":
        return today - timedelta(days=7), now
    if op_key == "last_30_days":
        return today - timedelta(days=30), now
    if op_key == "this_month":
        start = datetime(now.year, now.month, 1)
        # naive month rollover
        if now.month == 12:
            end = datetime(now.year + 1, 1, 1)
        else:
            end = datetime(now.year, now.month + 1, 1)
        return start, end
    if op_key == "this_year":
        return datetime(now.year, 1, 1), datetime(now.year + 1, 1, 1)
    return None


def build_clause(
    column: ColumnElement, col_type: str, op: str, value: Any
) -> ColumnElement | None:
    """Return a SQLAlchemy boolean expression, or None if the filter is a no-op."""

    # Universal null ops
    if op == "is_null":
        return column.is_(None)
    if op == "is_not_null":
        return column.is_not(None)

    # Bool ops
    if col_type in ("bool", "boolean"):
        if op == "is_true":
            return column.is_(True)
        if op == "is_false":
            return column.is_(False)

    # Date "period" shortcuts
    if col_type in ("date", "datetime") and op in {
        "today",
        "this_week",
        "last_7_days",
        "last_30_days",
        "this_month",
        "this_year",
    }:
        bounds = _period_bounds(op)
        if not bounds:
            return None
        return and_(column >= bounds[0], column < bounds[1])

    # Value-taking ops
    coerce: Callable[[Any], Any]
    if col_type in ("number", "integer"):
        coerce = _coerce_number
    elif col_type in ("date", "datetime"):
        coerce = _coerce_date
    else:
        coerce = lambda x: x  # noqa: E731

    if op in ("equals",):
        v = coerce(value)
        return column == v if v is not None else None
    if op == "not_equals":
        v = coerce(value)
        return column != v if v is not None else None
    if op == "contains":
        return column.ilike(f"%{value}%") if value not in (None, "") else None
    if op == "starts_with":
        return column.ilike(f"{value}%") if value not in (None, "") else None
    if op == "ends_with":
        return column.ilike(f"%{value}") if value not in (None, "") else None
    if op == "gt":
        v = coerce(value)
        return column > v if v is not None else None
    if op == "gte":
        v = coerce(value)
        return column >= v if v is not None else None
    if op == "lt":
        v = coerce(value)
        return column < v if v is not None else None
    if op == "lte":
        v = coerce(value)
        return column <= v if v is not None else None
    if op == "in":
        values = value if isinstance(value, list) else [value]
        values = [coerce(v) for v in values if v not in (None, "")]
        return column.in_(values) if values else None
    if op == "between":
        values = value if isinstance(value, list) else []
        if len(values) < 2:
            return None
        low, high = coerce(values[0]), coerce(values[1])
        if low is None or high is None:
            return None
        return and_(column >= low, column <= high)
    if op == "before":
        v = coerce(value)
        return column < v if v is not None else None
    if op == "after":
        v = coerce(value)
        return column > v if v is not None else None

    return None


def combine(clauses: list[ColumnElement | None], join: str = "and") -> ColumnElement | None:
    """AND/OR-combine a list of clauses, ignoring Nones."""
    clean = [c for c in clauses if c is not None]
    if not clean:
        return None
    if len(clean) == 1:
        return clean[0]
    return and_(*clean) if join == "and" else or_(*clean)
