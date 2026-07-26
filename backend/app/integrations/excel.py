"""Excel bulk-upload parsing for institution candidate loads."""

import io
from typing import Any

from openpyxl import load_workbook

# Expected column headers (case-insensitive) -> candidate field
COLUMN_MAP = {
    "name": "full_name",
    "full name": "full_name",
    "phone": "phone",
    "mobile": "phone",
    "email": "email",
    "gender": "gender",
    "city": "city",
    "state": "state",
    "pincode": "pincode",
    "trade": "primary_trade",
    "primary trade": "primary_trade",
    "skill": "primary_trade",
    "experience": "experience_years",
    "experience years": "experience_years",
    "education": "education_level",
    "certification": "certification",
    "languages": "languages",
    "expected salary": "expected_salary",
}


def parse_candidate_workbook(content: bytes) -> tuple[list[dict[str, Any]], list[str]]:
    """Parse an .xlsx file into candidate dicts. Returns (rows, errors)."""
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    errors: list[str] = []
    rows: list[dict[str, Any]] = []

    header_cells = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not header_cells:
        return [], ["Worksheet is empty."]

    headers = [str(h).strip().lower() if h is not None else "" for h in header_cells]

    for idx, raw in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if raw is None or all(c is None for c in raw):
            continue
        record: dict[str, Any] = {}
        for col_idx, value in enumerate(raw):
            if col_idx >= len(headers):
                break
            field = COLUMN_MAP.get(headers[col_idx])
            if field and value is not None:
                record[field] = value

        if not record.get("full_name") or not record.get("phone"):
            errors.append(f"Row {idx}: missing required Name or Phone — skipped.")
            continue

        record["phone"] = str(record["phone"]).strip()
        record["full_name"] = str(record["full_name"]).strip()
        for int_field in ("experience_years", "expected_salary"):
            if int_field in record:
                try:
                    record[int_field] = int(float(record[int_field]))
                except (ValueError, TypeError):
                    record.pop(int_field)
        rows.append(record)

    return rows, errors
