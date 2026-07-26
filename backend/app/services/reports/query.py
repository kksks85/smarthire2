"""Turn user-declared filters + columns into a live SQLAlchemy result set.

Includes:
    * :func:`run_report` — top-level executor returning ``{columns, rows, total}``.
    * PII masking for non-admin/manager viewers.
    * Aggregate + group-by support.
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import RoleName
from app.models.user import User
from app.services.reports import operators as ops_mod
from app.services.reports.datasources import (
    DataSource,
    ReportColumn,
    get_datasource,
)


AGGREGATE_FUNCS = {
    "count": func.count,
    "count_distinct": lambda c: func.count(func.distinct(c)),
    "sum": func.sum,
    "avg": func.avg,
    "min": func.min,
    "max": func.max,
}


class ReportError(Exception):
    """User-facing report configuration error (400)."""


def _resolve_column(ds: DataSource, name: str) -> ReportColumn:
    for col in ds.columns:
        if col.name == name:
            return col
    raise ReportError(f"Unknown column '{name}' for data source '{ds.key}'.")


def _mask_pii_value(v: Any) -> Any:
    if v is None:
        return None
    s = str(v)
    if len(s) <= 3:
        return "***"
    return s[:2] + "*" * max(3, len(s) - 4) + s[-2:]


def _can_see_pii(user: User) -> bool:
    try:
        role = user.role.name.value if hasattr(user.role.name, "value") else str(user.role.name)
    except Exception:
        return False
    return role in (RoleName.ADMIN.value, RoleName.MANAGER.value)


# ---------------------------------------------------------------------------
# Filter tree evaluation
# ---------------------------------------------------------------------------

def _build_where(ds: DataSource, node: dict[str, Any] | None):
    """Recursively convert a filter node into a SQL clause.

    Node shapes accepted:
        * ``{ "field": "...", "op": "...", "value": ... }``  — leaf
        * ``{ "join": "and"|"or", "children": [ ... ] }``    — group
        * ``{ "children": [ ... ] }``                        — implicit AND group
    """
    if not node:
        return None
    if "children" in node:
        parts = [_build_where(ds, child) for child in (node.get("children") or [])]
        return ops_mod.combine(parts, node.get("join", "and"))
    field = node.get("field")
    op = node.get("op")
    if not field or not op:
        return None
    col = _resolve_column(ds, field)
    if not col.filterable:
        raise ReportError(f"Column '{field}' is not filterable.")
    return ops_mod.build_clause(col.sql, col.type, op, node.get("value"))


# ---------------------------------------------------------------------------
# Column projection
# ---------------------------------------------------------------------------

def _select_columns(
    ds: DataSource, columns: list[dict[str, Any]]
) -> tuple[list[Any], list[tuple[str, str, str, ReportColumn, Optional[str]]]]:
    """Return (select_expressions, metadata list).

    metadata entry: (out_key, label, type, source_col, aggregate)
    ``out_key`` is what will appear in each row dict.
    """
    select_exprs: list[Any] = []
    meta: list[tuple[str, str, str, ReportColumn, Optional[str]]] = []

    for entry in columns:
        name = entry.get("field")
        if not name:
            continue
        col = _resolve_column(ds, name)
        aggregate = entry.get("aggregate")
        label = entry.get("label") or col.label
        out_key = name if not aggregate else f"{aggregate}_{name.replace('.', '_')}"

        if aggregate:
            if aggregate not in AGGREGATE_FUNCS:
                raise ReportError(f"Unknown aggregate '{aggregate}'.")
            if aggregate in ("sum", "avg") and not col.aggregate_ok:
                raise ReportError(
                    f"Column '{name}' does not support numeric aggregation."
                )
            expr = AGGREGATE_FUNCS[aggregate](col.sql).label(out_key)
            out_type = "number"
        else:
            expr = col.sql.label(out_key)
            out_type = col.type
        select_exprs.append(expr)
        meta.append((out_key, label, out_type, col, aggregate))
    return select_exprs, meta


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

def run_report(
    db: Session,
    *,
    data_source: str,
    filters: Optional[dict[str, Any]] = None,
    columns: Optional[list[dict[str, Any]]] = None,
    group_by: Optional[list[str]] = None,
    order_by: Optional[list[dict[str, str]]] = None,  # [{field, direction}]
    row_limit: int = 1000,
    current_user: Optional[User] = None,
) -> dict[str, Any]:
    ds = get_datasource(data_source)
    if not ds:
        raise ReportError(f"Unknown data source '{data_source}'.")

    if not columns:
        # Default: first 5 non-pii columns.
        columns = [
            {"field": c.name}
            for c in ds.columns
            if not c.is_pii
        ][:6]

    select_exprs, meta = _select_columns(ds, columns)

    stmt = select(*select_exprs).select_from(ds.model)

    # Apply joins for any referenced alias prefixes used in columns or filters.
    used_prefixes: set[str] = set()
    for c in columns:
        if not c.get("field"):
            continue
        if "." in c["field"]:
            used_prefixes.add(c["field"].split(".", 1)[0])

    def collect_filter_prefixes(node: dict[str, Any] | None):
        if not node:
            return
        if "children" in node:
            for ch in node.get("children") or []:
                collect_filter_prefixes(ch)
            return
        f = node.get("field")
        if f and "." in f:
            used_prefixes.add(f.split(".", 1)[0])

    collect_filter_prefixes(filters)
    if order_by:
        for o in order_by:
            f = o.get("field")
            if f and "." in f:
                used_prefixes.add(f.split(".", 1)[0])
    if group_by:
        for f in group_by:
            if "." in f:
                used_prefixes.add(f.split(".", 1)[0])

    for prefix in used_prefixes:
        j = ds.joins.get(prefix)
        if not j:
            raise ReportError(f"Join '{prefix}' not declared for '{ds.key}'.")
        stmt = stmt.join(j.target, j.onclause, isouter=j.isouter)

    # Where clause
    where_clause = _build_where(ds, filters)
    if where_clause is not None:
        stmt = stmt.where(where_clause)

    # Group by (also enforces at least one aggregate somewhere)
    if group_by:
        gb_exprs = []
        for gb_field in group_by:
            col = _resolve_column(ds, gb_field)
            if not col.group_by_ok:
                raise ReportError(f"Column '{gb_field}' cannot be used in group-by.")
            gb_exprs.append(col.sql)
        stmt = stmt.group_by(*gb_exprs)

    # Order by
    if order_by:
        order_exprs = []
        # Build a lookup of already-selected expressions keyed by the output key
        # (e.g. "count_id") so ordering by an aggregated column stays consistent
        # with GROUP BY / SELECT.
        select_expr_by_key = {out_key: expr for (out_key, _lbl, _t, _c, _agg), expr in zip(meta, select_exprs)}

        for o in order_by:
            of = o.get("field")
            if not of:
                continue
            direction = (o.get("direction") or "asc").lower()
            aggregate = o.get("aggregate")

            # If the caller referenced an already-computed output key
            # (e.g. "count_id"), reuse that expression directly.
            if of in select_expr_by_key:
                expr = select_expr_by_key[of]
            else:
                col = _resolve_column(ds, of)
                if aggregate:
                    if aggregate not in AGGREGATE_FUNCS:
                        raise ReportError(f"Unknown aggregate '{aggregate}'.")
                    expr = AGGREGATE_FUNCS[aggregate](col.sql)
                else:
                    # When grouping is active but this column is neither grouped
                    # nor aggregated, Postgres will reject it — fail early with
                    # a clear message rather than surfacing the raw DB error.
                    if group_by and of not in group_by:
                        raise ReportError(
                            f"Cannot order by '{of}': not in group_by and no aggregate specified."
                        )
                    expr = col.sql
            order_exprs.append(expr.desc() if direction == "desc" else expr.asc())

        if order_exprs:
            stmt = stmt.order_by(*order_exprs)

    stmt = stmt.limit(max(1, min(row_limit, 10000)))

    result = db.execute(stmt)
    keys = list(result.keys())
    rows_raw = result.fetchall()

    can_see_pii = current_user is not None and _can_see_pii(current_user)

    rows: list[dict[str, Any]] = []
    for r in rows_raw:
        obj: dict[str, Any] = {}
        for i, k in enumerate(keys):
            v = r[i]
            src_col = meta[i][3] if i < len(meta) else None
            aggregate = meta[i][4] if i < len(meta) else None
            if src_col and src_col.is_pii and not can_see_pii and not aggregate:
                v = _mask_pii_value(v)
            obj[k] = v
        rows.append(obj)

    columns_out = [
        {
            "key": out_key,
            "label": label,
            "type": ctype,
            "is_pii": src_col.is_pii if src_col else False,
            "aggregate": aggregate,
        }
        for (out_key, label, ctype, src_col, aggregate) in meta
    ]

    return {
        "columns": columns_out,
        "rows": rows,
        "row_count": len(rows),
        "truncated": len(rows) >= row_limit,
    }
