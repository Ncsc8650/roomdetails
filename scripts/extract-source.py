"""Read the supplied Thai registry format without changing the workbook.
Usage: python scripts/extract-source.py source.xlsx imports/source.json
Requires openpyxl; output remains local (imports/ is gitignored).
"""
import json
import sys
from pathlib import Path
import openpyxl

source, output = map(Path, sys.argv[1:3])
workbook = openpyxl.load_workbook(source, read_only=True, data_only=False)
sheet = workbook["ทะเบียนครุภัณฑ์"]
expected = ["ลำดับรวม", "ภาพต้นฉบับ", "ห้องที่", "ประเภทครุภัณฑ์", "รหัสครุภัณฑ์", "ยี่ห้อ", "ชนิด/แบบ", "ใช้ประจำ / สถานที่", "หมายเหตุ / หน่วยรับผิดชอบ", "สถานะถอดข้อมูล"]
iterator = sheet.iter_rows()
headers = [c.value for c in next(iterator)]
if headers != expected:
    raise ValueError("Workbook columns do not match the expected Thai source pattern")
keys = ["sequence", "image", "room", "category", "asset_number", "brand", "model", "location", "notes", "transcription_status"]
rows = []
for number, cells in enumerate(iterator, start=2):
    if not any(c.value is not None for c in cells):
        continue
    if any(c.data_type in ("f", "e") for c in cells):
        raise ValueError(f"Row {number}: formula/error needs review")
    values = [c.value for c in cells]
    row = {key: "" if value is None else str(value) for key, value in zip(keys, values)}
    row["sequence"] = int(values[0])
    row["row_number"] = number
    rows.append(row)
workbook.close()
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({"source_name": source.name, "rows": rows}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Extracted {len(rows)} rows to {output}")
