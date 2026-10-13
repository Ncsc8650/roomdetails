import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { openDb, migrate, type Db } from "../apps/api/src/db";
import { seed } from "../db/seed";
let db: Db;
beforeAll(async () => {
  db = await openDb(":memory:");
  await migrate(db);
  await seed(db);
}, 60000);
afterAll(async () => {
  await db.close();
});
describe("Phase 1 PostgreSQL constraints", () => {
  it("seeds exactly 22 people and 22 SAMPLE assets, 10 areas; seed is idempotent", async () => {
    await seed(db);
    expect((await db.query("SELECT * FROM personnel")).length).toBe(22);
    expect(
      (await db.query("SELECT * FROM assets WHERE is_sample")).length,
    ).toBe(22);
    expect((await db.query("SELECT * FROM areas")).length).toBe(10);
  });
  it("rejects duplicate, malformed and changed numbers at database level", async () => {
    await expect(
      db.query("UPDATE assets SET asset_number='invalid' WHERE id='asset-001'"),
    ).rejects.toThrow();
    await expect(
      db.query(
        "INSERT INTO assets(id,asset_number,name,category_id,division_id) VALUES('duplicate','7100.0001.001.001.01','test','cat-1','division-1')",
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        "UPDATE assets SET asset_number='7100.0001.001.023.01' WHERE id='asset-001'",
      ),
    ).rejects.toThrow();
  });
  it("cannot delete occupied areas; unpositioned store room remains", async () => {
    await expect(
      db.query("DELETE FROM areas WHERE id='area-1'"),
    ).rejects.toThrow();
    const [layout] = await db.query(
      "SELECT objects FROM layouts WHERE room_id=$1",
      ["room-1"],
    );
    expect(JSON.stringify(layout.objects)).not.toContain("area-10");
  });
  it("rolls back failed transactions", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.query("UPDATE assets SET name='bad' WHERE id='asset-001'");
        throw Error("rollback");
      }),
    ).rejects.toThrow();
    expect(
      (await db.query("SELECT name FROM assets WHERE id='asset-001'"))[0].name,
    ).toBe("คอมพิวเตอร์");
  });
});
