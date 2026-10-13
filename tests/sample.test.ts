import { it, expect } from "vitest";
import { openDb, migrate } from "../apps/api/src/db";
import { seed } from "../db/seed";
import { saveEntity } from "../apps/api/src/service";
import { purgeSample } from "../apps/api/src/sample";
it("purges sample-only data and preserves audit", async () => {
  const db = await openDb(":memory:");
  try {
    await migrate(db);
    await seed(db);
    expect(await purgeSample(db, "test")).toEqual({
      assets: 22,
      personnel: 22,
    });
    expect(await db.query("SELECT id FROM assets")).toHaveLength(0);
    expect(await db.query("SELECT id FROM personnel")).toHaveLength(0);
    expect(
      await db.query("SELECT id FROM audit_logs WHERE action='purge_sample'"),
    ).toHaveLength(1);
  } finally {
    await db.close();
  }
}, 60000);
it("rolls back all sample cleanup when real data references samples", async () => {
  const db = await openDb(":memory:");
  try {
    await migrate(db);
    await seed(db);
    await saveEntity(db, "test", "assets", {
      asset_number: "7100.0001.001.023.01",
      name: "real-reference-test",
      category_id: "cat-1",
      division_id: "division-1",
      area_id: "area-1",
      is_sample: false,
    });
    await expect(purgeSample(db, "test")).rejects.toThrow();
    expect(await db.query("SELECT id FROM assets")).toHaveLength(23);
    expect(await db.query("SELECT id FROM personnel")).toHaveLength(22);
  } finally {
    await db.close();
  }
}, 60000);
