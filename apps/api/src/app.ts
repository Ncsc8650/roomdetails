import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { type Db, type Row, insert } from "./db";
import { verifyPassword, hashPassword } from "./auth";
import { schemas } from "./entities";
import {
  AppError,
  saveEntity,
  deleteEntity,
  saveLayout,
  transfer,
  audit,
} from "./service";
import { snapshot } from "../../../db/seed";
import { syncSheets } from "./sheets";
import { importAssets } from "./import";
import { purgeSample } from "./sample";
import { importSourceRows, resolveSourceRow } from "./source-import";
type User = { id: string; username: string; role: string; is_demo: boolean };
declare module "fastify" {
  interface FastifyRequest {
    user: User | null;
  }
}
export async function createApp(db: Db) {
  const app = Fastify({ logger: false, bodyLimit: 4 * 1024 * 1024 });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  app.decorateRequest("user", null);
  app.addHook("onSend", async (req, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
    reply.header("Referrer-Policy", "same-origin");
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.setErrorHandler((error, _req, reply) => {
    const e = error as Error & { code?: string; statusCode?: number };
    let status = e.statusCode || 500,
      message = "เกิดข้อผิดพลาดภายในระบบ";
    if (e instanceof z.ZodError) {
      status = 400;
      message = e.issues
        .map((x) => `${x.path.join(".")}: ${x.message}`)
        .join("; ");
    } else if (e.code === "23505") {
      status = 409;
      message = "เลขทะเบียนหรือรหัสนี้มีอยู่แล้ว";
    } else if (e.code === "23503") {
      status = 409;
      message = "ข้อมูลมีความเชื่อมโยงอยู่ หรือรายการอ้างอิงไม่ถูกต้อง";
    } else if (e.code === "23514") {
      status = 400;
      message = "ข้อมูลผิดข้อกำหนดฐานข้อมูล";
    } else if (status < 500) message = e.message;
    else console.error(e);
    reply.code(status).send({ error: message });
  });
  const publicPaths = new Set(["/api/login", "/api/demo", "/api/health"]);
  app.addHook("preHandler", async (req) => {
    if (!req.url.startsWith("/api/")) return;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const origin = req.headers.origin;
      if (
        origin &&
        origin !== process.env.APP_ORIGIN &&
        origin !== `http://${req.headers.host}` &&
        origin !== `https://${req.headers.host}`
      )
        throw new AppError(403, "ต้นทางไม่อนุญาต");
      if (req.headers["x-requested-with"] !== "asset-command-center")
        throw new AppError(403, "คำขอไม่ถูกต้อง");
    }
    if (publicPaths.has(req.url.split("?")[0])) return;
    const token = req.cookies.acc_session;
    if (token) {
      const [u] = await db.query(
        "SELECT u.id,u.username,u.role,u.is_demo FROM sessions s JOIN user_accounts u ON u.id=s.user_id WHERE s.id=$1 AND s.expires_at>now() AND u.active",
        [createHash("sha256").update(token).digest("hex")],
      );
      if (u) req.user = u as User;
    }
    if (!req.user) throw new AppError(401, "กรุณาเข้าสู่ระบบ");
    if (
      !["GET", "HEAD"].includes(req.method) &&
      !["/api/logout"].includes(req.url) &&
      !["admin", "editor"].includes(req.user.role)
    )
      throw new AppError(403, "บัญชีนี้ดูได้อย่างเดียว");
  });
  const session = async (user: Row, reply: import("fastify").FastifyReply) => {
    const token = randomBytes(32).toString("hex");
    await insert(db, "sessions", {
      id: createHash("sha256").update(token).digest("hex"),
      user_id: user.id,
      expires_at: new Date(Date.now() + 8 * 3600000).toISOString(),
    });
    reply.setCookie("acc_session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 8 * 3600,
    });
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      is_demo: user.is_demo,
    };
  };
  app.get("/api/health", async () => ({ ok: true }));
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const b = z
        .object({
          username: z.string().max(100),
          password: z.string().max(300),
        })
        .parse(req.body);
      const u = await db.userByName(b.username);
      if (
        !u ||
        !u.active ||
        !verifyPassword(b.password, String(u.password_hash))
      )
        throw new AppError(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
      return session(u, reply);
    },
  );
  app.post("/api/demo", async (_req, reply) => {
    if (process.env.DEMO_LOGIN !== "true")
      throw new AppError(403, "ปิดบัญชีตัวอย่าง");
    const [u] = await db.query(
      "SELECT * FROM user_accounts WHERE id='demo-viewer' AND active",
    );
    if (!u) throw new AppError(403, "ไม่มีบัญชีตัวอย่าง");
    return session(u, reply);
  });
  app.post("/api/logout", async (req, reply) => {
    await db.query("DELETE FROM sessions WHERE id=$1", [
      createHash("sha256")
        .update(req.cookies.acc_session || "")
        .digest("hex"),
    ]);
    reply.clearCookie("acc_session", { path: "/" });
    return { ok: true };
  });
  app.get("/api/me", async (req) => req.user);
  app.get("/api/import/source", async (req) => {
    if (req.user?.is_demo)
      throw new AppError(403, "บัญชีตัวอย่างดูไฟล์นำเข้าจริงไม่ได้");
    return db.query(
      "SELECT r.*,b.source_name,b.created_at,a.asset_number AS registered_code FROM asset_import_rows r JOIN asset_import_batches b ON b.id=r.batch_id LEFT JOIN assets a ON a.id=r.asset_id ORDER BY b.created_at DESC,r.row_number",
    );
  });
  app.post("/api/import/source", async (req) => {
    if (req.user!.role !== "admin") throw new AppError(403, "เฉพาะผู้ดูแล");
    return importSourceRows(db, req.user!.id, req.body);
  });
  app.post<{ Params: { id: string } }>(
    "/api/import/source/:id/resolve",
    async (req) => {
      if (req.user!.role !== "admin") throw new AppError(403, "เฉพาะผู้ดูแล");
      return resolveSourceRow(db, req.user!.id, req.params.id, req.body);
    },
  );
  app.get("/api/data", async (req) => {
    const data = await snapshot(db);
    if (req.user?.is_demo) {
      for (const key of [
        "agencies",
        "buildings",
        "floors",
        "divisions",
        "rooms",
        "organizational_departments",
        "areas",
        "personnel",
        "assets",
        "fixtures",
      ])
        data[key] = data[key].filter((r) => r.is_sample === true);
      const areas = new Set(data.areas.map((r) => r.id)),
        rooms = new Set(data.rooms.map((r) => r.id));
      data.layouts = data.layouts.filter(
        (l) => areas.has(l.area_id) || rooms.has(l.room_id),
      );
      const allowedRefs = new Set(
        [...data.areas, ...data.assets, ...data.fixtures].map((r) => r.id),
      );
      for (const l of data.layouts)
        for (const key of ["objects", "published_objects"])
          l[key] = (l[key] as Row[]).filter(
            (o) => !o.ref_id || allowedRefs.has(String(o.ref_id)),
          );
      data.division_room_links = data.division_room_links.filter((l) =>
        rooms.has(l.room_id),
      );
      data.asset_movements = [];
      data.asset_assignment_history = [];
      data.asset_import_batches = [];
      data.asset_import_rows = [];
    }
    return data;
  });
  app.post<{ Params: { table: string } }>("/api/entities/:table", async (req) =>
    saveEntity(db, req.user!.id, req.params.table, req.body),
  );
  app.put<{ Params: { table: string; id: string } }>(
    "/api/entities/:table/:id",
    async (req) =>
      saveEntity(db, req.user!.id, req.params.table, req.body, req.params.id),
  );
  app.delete<{ Params: { table: string; id: string } }>(
    "/api/entities/:table/:id",
    async (req) => {
      await deleteEntity(db, req.user!.id, req.params.table, req.params.id);
      return { ok: true };
    },
  );
  app.put<{ Params: { id: string } }>("/api/layouts/:id", async (req) =>
    saveLayout(db, req.user!.id, req.params.id, req.body),
  );
  app.post<{ Params: { id: string } }>(
    "/api/assets/:id/transfer",
    async (req) => transfer(db, req.user!.id, req.params.id, req.body),
  );
  app.get("/api/audit", async (req) => {
    if (req.user?.is_demo)
      throw new AppError(403, "บัญชีตัวอย่างดูประวัติจริงไม่ได้");
    return db.query(
      "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500",
    );
  });
  app.get("/api/settings", async (req) => {
    if (req.user!.role !== "admin") throw new AppError(403, "เฉพาะผู้ดูแล");
    return {
      users: await db.query(
        "SELECT id,username,role,active,is_demo FROM user_accounts",
      ),
      sync: await db.query("SELECT * FROM sync_state"),
      googleConfigured: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    };
  });
  app.post("/api/users", async (req) => {
    if (req.user!.role !== "admin") throw new AppError(403, "เฉพาะผู้ดูแล");
    const b = z
      .object({
        username: z.string().min(3).max(100),
        password: z.string().min(12).max(300),
        role: z.enum(["admin", "editor", "viewer", "auditor"]),
      })
      .parse(req.body);
    return db.transaction(async (tx) => {
      const u = await insert(tx, "user_accounts", {
        id: randomUUID(),
        username: b.username,
        password_hash: hashPassword(b.password),
        role: b.role,
      });
      await audit(
        tx,
        req.user!.id,
        "create",
        "user_accounts",
        String(u.id),
        null,
        { username: b.username, role: b.role },
      );
      return { id: u.id };
    });
  });
  app.get("/api/backup", async (req) => {
    if (req.user!.role !== "admin") throw new AppError(403, "เฉพาะผู้ดูแล");
    return {
      format: "acc-export-v1",
      created_at: new Date().toISOString(),
      data: await snapshot(db),
    };
  });
  app.put<{ Params: { id: string } }>("/api/users/:id", async (req) => {
    if (req.user!.role !== "admin") throw new AppError(403, "เฉพาะผู้ดูแล");
    const b = z
      .object({
        role: z.enum(["admin", "editor", "viewer", "auditor"]),
        active: z.boolean(),
      })
      .strict()
      .parse(req.body);
    return db.transaction(async (tx) => {
      await tx.query("LOCK TABLE user_accounts IN SHARE ROW EXCLUSIVE MODE");
      const [before] = await tx.query(
        "SELECT id,username,role,active,is_demo FROM user_accounts WHERE id=$1",
        [req.params.id],
      );
      if (!before) throw new AppError(404, "ไม่พบบัญชี");
      if (before.is_demo && b.role !== "viewer")
        throw new AppError(400, "บัญชีตัวอย่างต้องเป็น viewer เท่านั้น");
      if (req.params.id === req.user!.id && (!b.active || b.role !== "admin"))
        throw new AppError(400, "ไม่สามารถลดสิทธิ์หรือปิดบัญชีตัวเอง");
      const [after] = await tx.query(
        "UPDATE user_accounts SET role=$1,active=$2 WHERE id=$3 RETURNING id,username,role,active,is_demo",
        [b.role, b.active, req.params.id],
      );
      await tx.query("DELETE FROM sessions WHERE user_id=$1", [req.params.id]);
      await audit(
        tx,
        req.user!.id,
        "update",
        "user_accounts",
        req.params.id,
        before,
        after,
      );
      return after;
    });
  });
  app.get("/api/schema", async () => Object.keys(schemas));
  app.post("/api/sample/cleanup", async (req) => {
    if (req.user!.role !== "admin") throw new AppError(403, "เฉพาะผู้ดูแล");
    z.object({ confirmation: z.literal("DELETE SAMPLE") }).parse(req.body);
    return purgeSample(db, req.user!.id);
  });
  app.post("/api/import/assets", async (req) => {
    const b = z.object({ csv: z.string().min(1).max(3000000) }).parse(req.body);
    return importAssets(db, req.user!.id, b.csv);
  });
  app.post("/api/sheets/sync", async (req) => {
    if (req.user!.role !== "admin") throw new AppError(403, "เฉพาะผู้ดูแล");
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS)
      throw new AppError(503, "ยังไม่ได้ตั้งค่า service account");
    return syncSheets(db);
  });
  return app;
}
