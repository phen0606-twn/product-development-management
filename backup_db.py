#!/usr/bin/env python3
"""
Supabase 手動備份腳本
用法：python3 backup_db.py
備份位置：./backup/YYYYMMDD/
"""

import csv
import json
import os
import sys
from datetime import date
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── 設定 ──────────────────────────────────────────────
SUPABASE_URL = "https://vqrnkfoskjthwlhlqdkd.supabase.co"

# Service Role Key（可繞過 RLS，從 Supabase Dashboard → Settings → API 取得）
# ⚠️  此 key 擁有完整讀寫權限，請勿提交到 git
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# 要備份的資料表（順序即備份順序）
TABLES = [
    "products",
    "vendors",
    "development_costs",
    "development_progress",
    "development_events",
    "product_batches",
    "sales_records",
    "channel_sales_records",
    "channel_store_sales_records",
    "product_store_sales",
    "inventory_records",
]

PAGE_SIZE = 1000  # Supabase 每次最多回傳筆數
# ─────────────────────────────────────────────────────


def fetch_table(table: str) -> list[dict]:
    """分頁讀取整張資料表，回傳所有 rows"""
    if not SERVICE_ROLE_KEY:
        raise SystemExit(
            "\n❌ 未設定 SUPABASE_SERVICE_ROLE_KEY\n"
            "請先執行：export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'\n"
            "Key 位置：Supabase Dashboard → 左側 Settings → API → service_role"
        )

    rows = []
    offset = 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/{table}"
            f"?select=*&limit={PAGE_SIZE}&offset={offset}"
        )
        req = Request(url, headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Accept": "application/json",
        })
        try:
            with urlopen(req) as resp:
                batch = json.loads(resp.read())
        except HTTPError as e:
            body = e.read().decode()
            raise SystemExit(f"\n❌ 讀取 {table} 失敗（HTTP {e.code}）：{body}")

        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def save_csv(table: str, rows: list[dict], folder: str) -> int:
    if not rows:
        path = os.path.join(folder, f"{table}.csv")
        open(path, "w").close()
        return 0
    path = os.path.join(folder, f"{table}.csv")
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def main():
    today = date.today().strftime("%Y%m%d")
    folder = os.path.join(os.path.dirname(__file__), "backup", today)
    os.makedirs(folder, exist_ok=True)

    print(f"\n📦 Supabase 備份開始 → {folder}\n")
    total = 0
    results = []

    for table in TABLES:
        print(f"  讀取 {table}...", end=" ", flush=True)
        try:
            rows = fetch_table(table)
            count = save_csv(table, rows, folder)
            results.append((table, count, "✅"))
            total += count
            print(f"{count} 筆")
        except SystemExit:
            raise
        except Exception as e:
            results.append((table, 0, "❌"))
            print(f"失敗：{e}")

    print(f"\n{'─'*45}")
    print(f"{'資料表':<30} {'筆數':>8}  狀態")
    print(f"{'─'*45}")
    for table, count, status in results:
        print(f"{table:<30} {count:>8}  {status}")
    print(f"{'─'*45}")
    print(f"{'合計':<30} {total:>8} 筆")
    print(f"\n✅ 備份完成：{folder}\n")


if __name__ == "__main__":
    main()
