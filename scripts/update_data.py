#!/usr/bin/env python3
"""Fetch official EOD TWSE/TPEx snapshots, preserving existing data on failure."""
import datetime as dt
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "stocks.json"
URLS = {
    "twse_price": "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL",
    "twse_valuation": "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL",
    "twse_revenue": "https://openapi.twse.com.tw/v1/opendata/t187ap05_L",
    "tpex_price": "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes",
    "tpex_valuation": "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis",
    "tpex_revenue": "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O",
}

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "QingyuResearch/1.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=35) as response:
        data = json.load(response)
    if not isinstance(data, list):
        raise ValueError("Expected list")
    return data

def value(row, *keys):
    for key in keys:
        if row.get(key) is not None:
            return str(row[key]).strip()
    return ""

def numeric(raw):
    s = str(raw or "").strip().replace(",", "").replace("%", "")
    if s in ("", "--", "-", "N/A", "除零", "不適用", "—"):
        return None
    try:
        n = float(s)
        return round(n, 4) if n == n and abs(n) != float("inf") else None
    except ValueError:
        return None

def date(raw):
    s = re.sub(r"[^0-9]", "", str(raw or ""))
    if len(s) == 7:
        return f"{int(s[:3])+1911:04d}-{s[3:5]}-{s[5:7]}"
    if len(s) == 8:
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return None

def code(row):
    c = value(row, "Code", "SecuritiesCompanyCode", "SecuritiesCode", "StockCode", "股票代號", "公司代號", "證券代號")
    return c if re.fullmatch(r"\d{4,6}", c) else None

def valuation(row):
    """Normalize common official valuation field aliases without fabricating missing data."""
    return {
        "pe": numeric(value(row, "PEratio", "PERatio", "PriceEarningRatio", "P/E", "本益比", "本益比(倍)", "本益比（倍）")),
        "pb": numeric(value(row, "PBratio", "PBRatio", "PriceBookRatio", "P/B", "股價淨值比", "股價淨值比(倍)", "股價淨值比（倍）")),
        "yield_": numeric(value(row, "DividendYield", "DividendYieldRatio", "Yield", "YieldRatio", "CashDividendYield", "殖利率(%)", "殖利率", "殖利率(％)", "殖利率（%）")),
    }

def industry(row):
    """Use only an explicitly supplied official industry field."""
    return value(row, "產業別", "產業類別", "Industry", "IndustryName") or None


def valuation_source_diagnostics(rows):
    """Summarize feed schema and parsing without exposing raw rows."""
    columns = sorted({str(key) for row in rows[:50] for key in row.keys()})
    parsed = sum(any(v is not None for v in valuation(row).values()) for row in rows)
    codes = sum(code(row) is not None for row in rows)
    return {"rows": len(rows), "rows_with_code": codes,
            "rows_with_valuation": parsed, "columns": columns}


def merge_valuation(stock, row):
    """Only replace metrics when the new source supplies an actual numeric value."""
    stock.update({key: val for key, val in valuation(row).items() if val is not None})


def validate_valuation_coverage(stocks, results):
    """Reject suspiciously empty valuation feeds rather than publishing lost metrics."""
    if "twse_valuation" not in results or "tpex_valuation" not in results:
        raise RuntimeError("Official valuation feed missing; previous snapshot preserved")
    for market, source, min_ratio in (
        ("上市", "twse_valuation", 0.20),
        ("上櫃", "tpex_valuation", 0.10),
    ):
        rows = [s for s in stocks.values() if s["market"] == market and s["price"] is not None]
        if not rows:
            raise RuntimeError(f"No priced securities for {market}")
        matched = sum(s["pe"] is not None or s["pb"] is not None for s in rows)
        coverage = matched / len(rows)
        if coverage < min_ratio:
            raise RuntimeError(
                f"{market} valuation coverage {coverage:.1%} below {min_ratio:.0%}; "
                f"source={source} rows={len(results[source])}; previous snapshot preserved"
            )


def main():
    results = {}
    errors = {}
    for name, url in URLS.items():
        try:
            results[name] = fetch(url)
            print(name, len(results[name]))
            if name in ("twse_valuation", "tpex_valuation"):
                print(name, "schema_diagnostics:", json.dumps(valuation_source_diagnostics(results[name]), ensure_ascii=False))
            elif results[name] and name in ("tpex_revenue",):
                print(name, "columns:", list(results[name][0].keys()))
        except Exception as exc:
            errors[name] = str(exc)
            print("WARNING", name, exc)
    stocks = {}
    for row in results.get("twse_price", []):
        c = code(row)
        if c:
            stocks[c] = dict(code=c, name=value(row, "Name", "證券名稱"), market="上市", price=numeric(value(row, "ClosingPrice", "收盤價")), pe=None, pb=None, yield_=None, yoy=None, date=date(value(row, "Date", "日期")))
    for row in results.get("tpex_price", []):
        c = code(row)
        if c and c not in stocks:
            stocks[c] = dict(code=c, name=value(row, "CompanyName", "Name", "證券名稱"), market="上櫃", price=numeric(value(row, "Close", "ClosingPrice")), pe=None, pb=None, yield_=None, yoy=None, date=date(value(row, "Date")))
    for source in ("twse_valuation", "tpex_valuation"):
        for row in results.get(source, []):
            c = code(row)
            if c in stocks:
                s = stocks[c]
                merge_valuation(s, row)
    for row in results.get("twse_revenue", []) + results.get("tpex_revenue", []):
        c = code(row)
        if c in stocks:
            yoy = numeric(value(row, "營業收入-去年同月增減(%)", "營業收入-去年同月增減（%）", "營業收入-去年同月增減百分比", "去年同月增減(%)", "去年同月增減(％)", "去年同月增減百分比", "LastYearMonthlyRevenueGrowthRate"))
            if yoy is not None:
                stocks[c]["yoy"] = yoy
            group = industry(row)
            if group:
                stocks[c]["industry"] = group
    # Never publish an incomplete or stale market snapshot as official.
    if "twse_price" not in results or "tpex_price" not in results:
        raise RuntimeError("Incomplete market fetch; preserving previous data: " + json.dumps(errors, ensure_ascii=False))
    counts = {m: sum(s["market"] == m and s["price"] is not None for s in stocks.values()) for m in ("上市", "上櫃")}
    if counts["上市"] < 700 or counts["上櫃"] < 500:
        raise RuntimeError(f"Unexpected market coverage: {counts}. Previous file preserved.")
    validate_valuation_coverage(stocks, results)
    available_dates = [s["date"] for s in stocks.values() if s["date"]]
    if not available_dates:
        raise RuntimeError("Missing official trade date; previous file preserved.")
    latest = dt.date.fromisoformat(max(available_dates))
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    if latest > today or (today - latest).days > 14:
        raise RuntimeError(f"Stale or future snapshot: {latest}. Previous file preserved.")
    for market in ("上市", "上櫃"):
        print("Coverage", market, {key: sum(s["market"] == market and s[key] is not None for s in stocks.values()) for key in ("pe", "pb", "yield_", "yoy")})
    clean = [{"code":s["code"], "name":s["name"], "market":s["market"], "price":s["price"], "pe":s["pe"], "pb":s["pb"], "yield":s["yield_"], "yoy":s["yoy"], "date":s["date"], "industry":s.get("industry")} for s in stocks.values()]
    dates = [s["date"] for s in clean if s["date"]]
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=8)))
    payload = {"meta":{"mode":"official", "trade_date":max(dates) if dates else None, "updated_at":now.strftime("%Y-%m-%d %H:%M UTC+08:00"), "sources":[k for k in results if k in ("twse_price", "tpex_price")], "source_details":list(results), "errors":errors, "note":"官方盤後快照；缺值為 null；營收年增為最近公布月份，可能不等於交易日期。"}, "stocks":sorted(clean, key=lambda s:s["code"])}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(OUT)
    print("Saved", len(clean), "records")

if __name__ == "__main__":
    main()
