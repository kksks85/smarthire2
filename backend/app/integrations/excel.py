"""Excel bulk-upload parsing for institution candidate loads."""

import csv
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

INSTITUTION_TEMPLATE_COLUMNS = {
    **COLUMN_MAP,
    "institution name": "institution_name",
    "institution": "institution_name",
    "college": "institution_name",
    "primary trade": "primary_trade",
    "skill": "primary_trade",
}

CAMPAIGN_HEADERS = [
    "name",
    "phone",
    *(header for number in range(1, 6) for header in (f"question {number}", f"answer {number}")),
]


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


def parse_institution_csv(content: bytes) -> tuple[list[dict[str, Any]], list[str]]:
    """Parse the institution placement-officer CSV template."""
    errors: list[str] = []
    rows: list[dict[str, Any]] = []
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], ["CSV header row is missing."]

    fieldnames = [name.strip().lower() for name in reader.fieldnames if name]
    required = {"name", "phone", "trade"}
    if not required.issubset(set(fieldnames)):
        missing = ", ".join(required - set(fieldnames))
        return [], [f"CSV is missing required columns: {missing}."]

    for idx, raw in enumerate(reader, start=2):
        record: dict[str, Any] = {}
        for key, value in raw.items():
            if key is None:
                continue
            clean_key = key.strip().lower()
            field = INSTITUTION_TEMPLATE_COLUMNS.get(clean_key)
            if field and value is not None and str(value).strip() != "":
                record[field] = str(value).strip()
        if not record.get("full_name") or not record.get("phone") or not record.get("primary_trade"):
            errors.append(f"Row {idx}: missing required Name, Phone or Trade - skipped.")
            continue
        record["phone"] = "".join(ch for ch in record["phone"] if ch.isdigit())
        for int_field in ("experience_years", "expected_salary"):
            if int_field in record:
                try:
                    record[int_field] = int(float(record[int_field]))
                except (ValueError, TypeError):
                    record.pop(int_field)
        rows.append(record)
    return rows, errors


def parse_campaign_workbook(content: bytes) -> tuple[list[dict[str, Any]], list[str]]:
    """Parse the fixed five-question Facebook campaign workbook template."""
    wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.active
    errors: list[str] = []
    header_cells = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not header_cells:
        return [], ["Worksheet is empty."]

    headers = [str(header).strip().lower() if header is not None else "" for header in header_cells]
    header_positions = {header: index for index, header in enumerate(headers) if header}
    missing_headers = [header.title() for header in CAMPAIGN_HEADERS if header not in header_positions]
    if missing_headers:
        return [], [f"Missing required columns: {', '.join(missing_headers)}."]

    rows: list[dict[str, Any]] = []
    for row_number, raw in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not raw or all(value is None for value in raw):
            continue

        def cell(header: str) -> str | None:
            value = raw[header_positions[header]] if header_positions[header] < len(raw) else None
            return str(value).strip() if value is not None else None

        full_name = cell("name")
        phone = cell("phone")
        if not full_name or not phone:
            errors.append(f"Row {row_number}: missing required Name or Phone - skipped.")
            continue
        rows.append(
            {
                "full_name": full_name,
                "phone": phone,
                "responses": [
                    {
                        "question_number": number,
                        "question": cell(f"question {number}"),
                        "answer": cell(f"answer {number}"),
                    }
                    for number in range(1, 6)
                ],
            }
        )
    return rows, errors
