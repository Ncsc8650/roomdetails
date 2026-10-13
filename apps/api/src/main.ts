import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import fastifyStatic from "@fastify/static";
import { openDb, migrate } from "./db";
import { initUsers } from "./auth";
import { createApp } from "./app";
import { syncSheets } from "./sheets";
const db = await openDb();
await migrate(db);
await initUsers(db);
const app = await createApp(db);
if (existsSync("dist"))
  await app.register(fastifyStatic, { root: resolve("dist") });
await app.listen({
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || "127.0.0.1",
});
const syncTimer = setInterval(() => {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS)
    void db
      .query("SELECT pending FROM sync_state WHERE id='google_sheets'")
      .then((r) => {
        if (r[0]?.pending) return syncSheets(db);
      })
      .catch(() => {});
}, 60000);
syncTimer.unref();
console.log(
  `Asset Command Center: http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 3001}`,
);
const stop = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
