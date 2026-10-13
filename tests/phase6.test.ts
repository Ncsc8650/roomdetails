import { it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { openDb, migrate } from "../apps/api/src/db";
import { seed } from "../db/seed";
import { importAssets } from "../apps/api/src/import";
import {
  externalUrl,
  withinBounds,
  type LayoutObject,
} from "../packages/shared/model";
import { cells } from "../apps/api/src/sheets";
it("CSV import is atomic across duplicate and invalid rows", async () => {
  const db = await openDb(":memory:");
  try {
    await migrate(db);
    await seed(db);
    const header = "asset_number,name,category_id,division_id\n";
    await expect(
      importAssets(
        db,
        "test",
        header +
          "7100.0001.001.023.01,ใหม่,cat-1,division-1\n7100.0001.001.001.01,ซ้ำ,cat-1,division-1",
      ),
    ).rejects.toThrow();
    expect((await db.query("SELECT * FROM assets")).length).toBe(22);
    expect(
      await importAssets(
        db,
        "test",
        header + "7100.0001.001.024.01,ใหม่,cat-1,division-1",
      ),
    ).toEqual({ count: 1 });
  } finally {
    await db.close();
  }
}, 60000);
it("PostgreSQL archive restores records, schema and constraints", async () => {
  const first = new PGlite();
  await first.exec(
    "CREATE TABLE backup_test(id integer PRIMARY KEY, value text); INSERT INTO backup_test VALUES(1,'ข้อมูลไทย')",
  );
  const archive = await first.dumpDataDir();
  await first.close();
  const restored = new PGlite({ loadDataDir: archive });
  try {
    expect(
      (await restored.query<{ value: string }>("SELECT value FROM backup_test"))
        .rows[0].value,
    ).toBe("ข้อมูลไทย");
    await expect(
      restored.query("INSERT INTO backup_test VALUES(1,'duplicate')"),
    ).rejects.toThrow();
  } finally {
    await restored.close();
  }
}, 60000);
it("LINE links preserve query/hash and sheets numbers stay strings", () => {
  expect(externalUrl("https://example.com/?x=1#area")).toBe(
    "https://example.com/?x=1&openExternalBrowser=1#area",
  );
  expect(cells(["7100.0001.001.001.01", true])[0].userEnteredValue).toEqual({
    stringValue: "7100.0001.001.001.01",
  });
});
it("rotation-aware bounds rejects rectangles extending outside", () => {
  const o: LayoutObject = {
    id: "1",
    kind: "asset",
    name: "a",
    x: 0,
    y: 0,
    width: 2,
    depth: 1,
    rotation: 90,
    color: "#ffffff",
    z: 0,
  };
  expect(withinBounds(o, 4, 3)).toBe(false);
  expect(withinBounds({ ...o, x: 1 }, 4, 3)).toBe(true);
});
