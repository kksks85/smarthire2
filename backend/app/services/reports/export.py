"""CSV / XLSX export of report result sets."""

from __future__ import annotations

import csv
import io
from typing import Any


def to_csv(result: dict[str, Any]) -> bytes:
    cols = result.get("columns", [])
    rows = result.get("rows", [])
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([c["label"] for c in cols])
    for r in rows:
        writer.writerow([r.get(c["key"], "") for c in cols])
    return buf.getvalue().encode("utf-8")


def to_xlsx(result: dict[str, Any], sheet_name: str = "Report") -> bytes:
    from openpyxl import Workbook  # local import; openpyxl is already installed

    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name[:31] or "Report"

    cols = result.get("columns", [])
    rows = result.get("rows", [])
    ws.append([c["label"] for c in cols])
    for r in rows:
        ws.append([r.get(c["key"], "") for c in cols])

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()


def to_html(result: dict[str, Any], title: str = "Report") -> str:
    cols = result.get("columns", [])
    rows = result.get("rows", [])
    thead = "".join(f"<th style='padding:6px;border:1px solid #ccc;background:#f2f4f5;text-align:left'>{c['label']}</th>" for c in cols)
    body_rows = []
    for r in rows:
        cells = "".join(
            f"<td style='padding:6px;border:1px solid #ddd'>{'' if r.get(c['key']) is None else r.get(c['key'])}</td>"
            for c in cols
        )
        body_rows.append(f"<tr>{cells}</tr>")
    body = "".join(body_rows) or f"<tr><td colspan='{len(cols)}' style='padding:12px;text-align:center;color:#666'>No rows.</td></tr>"
    return (
        f"<h2 style='font-family:Segoe UI,Arial,sans-serif'>{title}</h2>"
        f"<table style='border-collapse:collapse;font-family:Segoe UI,Arial,sans-serif;font-size:12px'>"
        f"<thead><tr>{thead}</tr></thead><tbody>{body}</tbody></table>"
    )
