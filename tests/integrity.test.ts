import { beforeAll, afterAll, it, expect } from "vitest";
import { openDb, migrate, type Db } from "../apps/api/src/db";
import { seed } from "../db/seed";
import { saveEntity, saveLayout, deleteEntity } from "../apps/api/src/service";
import type { LayoutObject } from "../packages/shared/model";
let db: Db;
beforeAll(async () => {
  db = await openDb(":memory:");
  await migrate(db);
  await seed(db);
}, 60000);
afterAll(async () => {
  await db.close();
});
it("concurrent duplicate insert succeeds exactly once", async () => {
  const a = {
    asset_number: "7100.0001.001.099.01",
    name: "SAMPLE concurrent",
    category_id: "cat-1",
    division_id: "division-1",
    is_sample: true,
  };
  const results = await Promise.allSettled([
    saveEntity(db, "test", "assets", a),
    saveEntity(db, "test", "assets", a),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
});
it("saves geometry and published snapshot independently; hiding never deletes registry", async () => {
  const [l] = await db.query("SELECT * FROM layouts WHERE area_id='area-1'");
  const objects = (l.objects as LayoutObject[]).map((o) =>
    o.id === "object-001"
      ? { ...o, x: 1, y: 0.5, width: 1, depth: 0.5, rotation: 30 }
      : o,
  );
  const b = {
    revision: l.revision,
    width: 4,
    depth: 3,
    orientation: "landscape",
    objects,
    settings: { snap: 0.1, bounds: true, labels: "full" },
    publish: true,
  };
  const saved = await saveLayout(db, "test", String(l.id), b);
  expect(
    (saved.objects as LayoutObject[]).find((o) => o.id === "object-001")
      ?.rotation,
  ).toBe(30);
  await saveLayout(db, "test", String(l.id), {
    ...b,
    revision: saved.revision,
    width: 5,
    objects: objects.filter((o) => o.id !== "object-001"),
    publish: false,
  });
  const [after] = await db.query("SELECT * FROM layouts WHERE id=$1", [l.id]);
  expect((after.published_config as { width: number }).width).toBe(4);
  expect(after.width).toBe(5);
  expect(
    (await db.query("SELECT id FROM assets WHERE id='asset-001'")).length,
  ).toBe(1);
  expect(
    (after.published_objects as LayoutObject[]).some(
      (o) => o.id === "object-001",
    ),
  ).toBe(true);
});
it("new free area gets a detail layout and can own several assets", async () => {
  const area = await saveEntity(db, "test", "areas", {
    name: "จุดใหม่ SAMPLE",
    room_id: "room-1",
    division_id: "division-1",
    is_sample: true,
  });
  expect(
    (await db.query("SELECT * FROM layouts WHERE area_id=$1", [area.id]))
      .length,
  ).toBe(1);
  for (const n of ["097", "098"])
    await saveEntity(db, "test", "assets", {
      asset_number: `7100.0001.001.${n}.01`,
      name: "SAMPLE",
      category_id: "cat-1",
      division_id: "division-1",
      area_id: area.id,
      custodian_id: "P001",
      is_sample: true,
    });
  expect(
    (await db.query("SELECT * FROM assets WHERE area_id=$1", [area.id])).length,
  ).toBe(2);
  await expect(
    deleteEntity(db, "test", "areas", String(area.id)),
  ).rejects.toThrow("ต้องโอน");
});
