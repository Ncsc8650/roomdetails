import { beforeAll, afterAll, it, expect } from "vitest";
import { openDb, migrate, type Db } from "../apps/api/src/db";
import { seed } from "../db/seed";
import { initUsers } from "../apps/api/src/auth";
import { createApp } from "../apps/api/src/app";
let db: Db,
  app: Awaited<ReturnType<typeof createApp>>,
  cookie = "";
const headers = () => ({ "x-requested-with": "asset-command-center", cookie });
beforeAll(async () => {
  process.env.ADMIN_PASSWORD = "test-only-password-234";
  process.env.DEMO_LOGIN = "true";
  db = await openDb(":memory:");
  await migrate(db);
  await seed(db);
  await initUsers(db);
  app = await createApp(db);
  const r = await app.inject({
    method: "POST",
    url: "/api/login",
    headers: headers(),
    payload: { username: "admin", password: process.env.ADMIN_PASSWORD },
  });
  cookie = r.cookies[0].name + "=" + r.cookies[0].value;
}, 60000);
afterAll(async () => {
  await app.close();
  await db.close();
});
it("rejects cross-origin writes and demo private-data access", async () => {
  const attack = await app.inject({
    method: "POST",
    url: "/api/entities/agencies",
    headers: { ...headers(), origin: "https://untrusted.example" },
    payload: { name: "bad" },
  });
  expect(attack.statusCode).toBe(403);
  const demo = await app.inject({
    method: "POST",
    url: "/api/demo",
    headers: { ...headers(), "content-type": "application/json" },
    payload: {},
  });
  expect(demo.statusCode).toBe(200);
  const demoHeaders = {
    ...headers(),
    cookie: "acc_session=" + demo.cookies[0].value,
  };
  expect(
    (await app.inject({ url: "/api/audit", headers: demoHeaders })).statusCode,
  ).toBe(403);
  const data = (
    await app.inject({ url: "/api/data", headers: demoHeaders })
  ).json();
  expect(data.personnel.every((p: { is_sample: boolean }) => p.is_sample)).toBe(
    true,
  );
  expect(data.asset_movements).toEqual([]);
});
it("requires login and prevents demo writes", async () => {
  expect((await app.inject("/api/data")).statusCode).toBe(401);
  const d = await app.inject({
    method: "POST",
    url: "/api/demo",
    headers: headers(),
  });
  const r = await app.inject({
    method: "POST",
    url: "/api/entities/agencies",
    headers: { ...headers(), cookie: "acc_session=" + d.cookies[0].value },
    payload: { name: "bad" },
  });
  expect(r.statusCode).toBe(403);
});
it("creates valid .023, rejects duplicates and bad numbers", async () => {
  const a = {
    asset_number: "7100.0001.001.023.01",
    name: "ทดสอบ",
    category_id: "cat-1",
    division_id: "division-1",
    area_id: "area-1",
    custodian_id: "P001",
  };
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/entities/assets",
        headers: headers(),
        payload: a,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/entities/assets",
        headers: headers(),
        payload: a,
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/entities/assets",
        headers: headers(),
        payload: { ...a, asset_number: "bad" },
      })
    ).statusCode,
  ).toBe(400);
});
it("protects occupied areas and category cycles", async () => {
  expect(
    (
      await app.inject({
        method: "DELETE",
        url: "/api/entities/areas/area-1",
        headers: headers(),
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await app.inject({
        method: "PUT",
        url: "/api/entities/asset_categories/it",
        headers: headers(),
        payload: { name: "IT", code: "it", parent_id: "cat-1" },
      })
    ).statusCode,
  ).toBe(400);
});
it("transactional transfers preserve number, remove old placement, keep history", async () => {
  const r = await app.inject({
    method: "POST",
    url: "/api/assets/asset-001/transfer",
    headers: headers(),
    payload: {
      area_id: "area-2",
      custodian_id: "P005",
      reason: "ทดสอบการโอน",
      version: 1,
    },
  });
  expect(r.statusCode).toBe(200);
  expect(r.json().asset_number).toBe("7100.0001.001.001.01");
  expect(
    (await db.query("SELECT * FROM asset_movements WHERE asset_id='asset-001'"))
      .length,
  ).toBe(1);
  expect(
    JSON.stringify(
      (await db.query("SELECT objects FROM layouts WHERE area_id='area-1'"))[0],
    ),
  ).not.toContain("asset-001");
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/assets/asset-001/transfer",
        headers: headers(),
        payload: {
          area_id: null,
          custodian_id: null,
          reason: "stale",
          version: 1,
        },
      })
    ).statusCode,
  ).toBe(409);
});
it("persists transformed layouts and rejects stale autosave", async () => {
  const [l] = await db.query("SELECT * FROM layouts WHERE id='master-room-1'");
  const b = {
    revision: l.revision,
    width: 18,
    depth: 12,
    orientation: "portrait",
    objects: l.objects,
    settings: { snap: 0.25, bounds: true, labels: "full" },
    publish: true,
  };
  expect(
    (
      await app.inject({
        method: "PUT",
        url: "/api/layouts/master-room-1",
        headers: headers(),
        payload: b,
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: "PUT",
        url: "/api/layouts/master-room-1",
        headers: headers(),
        payload: b,
      })
    ).statusCode,
  ).toBe(409);
  const [saved] = await db.query(
    "SELECT * FROM layouts WHERE id='master-room-1'",
  );
  expect(saved.orientation).toBe("portrait");
  expect(saved.published_at).toBeTruthy();
});
