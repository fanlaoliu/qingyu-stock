#!/usr/bin/env python3
"""Inspect coverage and freshness of the committed official market snapshot."""
import datetime as dt
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT = ROOT / "data" / "stocks.json"
FIELDS = ("price", "pe", "pb", "yield", "yoy")
MARKETS = ("上市", "上櫃")


def analyze(payload, today=None):
    if not isinstance(payload, dict) or not isinstance(payload.get("stocks"), list):
        raise ValueError("Expected snapshot with stocks array")
    meta = payload.get("meta") or {}
    if meta.get("mode") != "official":
        raise ValueError("Refusing to audit demo data as official")
    today = today or dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    trade_date = dt.date.fromisoformat(meta["trade_date"])
    age = (today - trade_date).days
    report = {
        "trade_date": trade_date.isoformat(),
        "age_days": age,
        "stale": age < 0 or age > 14,
        "source_errors": meta.get("errors", {}),
        "markets": {},
    }
    seen = set()
    duplicates = []
    invalid_codes = []
    for row in payload["stocks"]:
        code = str(row.get("code", ""))
        market = row.get("market")
        if not code.isdigit() or not 4 <= len(code) <= 6 or market not in MARKETS:
            invalid_codes.append({"code": code, "market": market})
        key = (market, code)
        if key in seen:
            duplicates.append({"code": code, "market": market})
        seen.add(key)
    report["duplicates"] = duplicates
    report["invalid_identifiers"] = invalid_codes
    for market in MARKETS:
        rows = [row for row in payload["stocks"] if row.get("market") == market]
        total = len(rows)
        counts = {field: sum(isinstance(row.get(field), (int, float)) and
                             not isinstance(row.get(field), bool) and math.isfinite(row.get(field)) for row in rows)
                  for field in FIELDS}
        report["markets"][market] = {
            "total": total,
            "available": counts,
            "coverage_percent": {
                field: round(counts[field] * 100 / total, 2) if total else 0
                for field in FIELDS
            },
        }
    return report


def main():
    path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    report = analyze(json.loads(path.read_text(encoding="utf-8")))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if report["stale"]:
        print("WARNING: trade date is stale or in the future", file=sys.stderr)
    if report["source_errors"]:
        print("WARNING: official API source errors present", file=sys.stderr)


if __name__ == "__main__":
    main()
