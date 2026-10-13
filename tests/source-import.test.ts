import { it, expect } from "vitest";
import { openDb, migrate, insert } from "../apps/api/src/db";
import { seed } from "../db/seed";
import { assetNumber } from "../packages/shared/model";
import {
  importSourceRows,
  resolveSourceRow,
} from "../apps/api/src/source-import";

it("accepts original legacy patterns and rejects malformed identifiers", () => {
  for (const code of [
    "7100.0001.001.001.01",
    "7110.007.0008.0075.7",
    "7110.007.0008.0009.7/59",
    "7110.007.0011.0114/60",
    "7110.007.0009.0293",
  ])
    expect(assetNumber.safeParse(code).success).toBe(true);
  for (const code of [
    "123",
    "7110.007.0008.0075.7 ",
    "7110.007.0008.0075.7/",
    "8110.007.0008.0075.7",
    "7110.007.0008.0075.7\n",
  ])
    expect(assetNumber.safeParse(code).success).toBe(false);
});
it("preserves every source row, quarantines both duplicates, retries safely and resolves with audit", async () => {
  const db = await openDb(":memory:");
  try {
    await migrate(db);
    await seed(db);
    await insert(db, "user_accounts", {
      id: "test",
      username: "source-test",
      password_hash: "disabled",
      role: "admin",
    });
    await insert(db, "divisions", {
      id: "real",
      name: "กองทดสอบ",
      agency_id: "agency-sample",
      is_sample: false,
    });
    const make = (n: number, code: string) => ({
      row_number: n + 1,
      sequence: n,
      image: "1",
      room: "1",
      category: "เก้าอี้ต้นฉบับ",
      asset_number: code,
      brand: "",
      model: "7-9",
      location: "ผอ.ฯ",
      notes: "",
      transcription_status: "ถอดจากภาพ",
    });
    const body = {
      source_name: "test.xlsx",
      division_id: "real",
      rows: [
        make(1, "7110.007.0008.0075.7"),
        make(2, "7110.007.0009.0293"),
        make(3, "7110.007.0009.0293"),
        make(4, "invalid"),
      ],
    };
    const first = await importSourceRows(db, "test", body);
    expect(first).toMatchObject({
      count: 4,
      imported: 1,
      pending: 3,
      reused: false,
    });
    expect(await importSourceRows(db, "test", body)).toMatchObject({
      ...first,
      reused: true,
    });
    const [asset] = await db.query(
      "SELECT * FROM assets WHERE asset_number=$1",
      [body.rows[0].asset_number],
    );
    expect(asset).toMatchObject({
      status: "รอตรวจสอบ",
      area_id: null,
      custodian_id: null,
      model: "7-9",
      is_sample: false,
    });
    const rows = await db.query(
      "SELECT * FROM asset_import_rows ORDER BY row_number",
    );
    expect(rows[1].original_data).toEqual(body.rows[1]);
    await expect(
      resolveSourceRow(db, "test", String(rows[1].id), {
        asset_number: body.rows[0].asset_number,
        reason: "ตรวจจากภาพต้นฉบับ",
      }),
    ).rejects.toThrow("มีอยู่");
    await resolveSourceRow(db, "test", String(rows[1].id), {
      asset_number: "7110.006.0009.0293",
      reason: "ตรวจจากภาพต้นฉบับ แก้หมวดเก้าอี้",
    });
    const [resolved] = await db.query(
      "SELECT * FROM asset_import_rows WHERE id=$1",
      [rows[1].id],
    );
    expect(resolved.source_code).toBe(body.rows[1].asset_number);
    expect(resolved.status).toBe("imported");
    expect(
      (await db.query("SELECT * FROM audit_logs WHERE action='resolve_import'"))
        .length,
    ).toBe(1);
    await expect(
      db.query(
        "UPDATE assets SET asset_number='7110.006.0009.0294' WHERE id=$1",
        [asset.id],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "INSERT INTO assets(id,asset_number,name,category_id,division_id) VALUES('duplicate',$1,'dup',$2,'real')",
        [asset.asset_number, asset.category_id],
      ),
    ).rejects.toThrow();
    const originalCount = (await db.query("SELECT id FROM asset_import_rows"))
      .length;
    await expect(
      importSourceRows(db, "test", {
        ...body,
        rows: [make(5, "7110.006.0009.0295")],
        division_id: "missing",
      }),
    ).rejects.toThrow();
    expect((await db.query("SELECT id FROM asset_import_rows")).length).toBe(
      originalCount,
    );
  } finally {
    await db.close();
  }
}, 60000);
