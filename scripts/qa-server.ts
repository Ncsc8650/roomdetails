import "dotenv/config";
import { resolve } from "node:path";
import staticFiles from "@fastify/static";
import { openDb, migrate } from "../apps/api/src/db";
import { seed } from "../db/seed";
import { initUsers } from "../apps/api/src/auth";
import { createApp } from "../apps/api/src/app";
// Disposable QA process; never opens the user's persistent database.
const db = await openDb(":memory:");
await migrate(db);
await seed(db);
await initUsers(db);
const app = await createApp(db);
await app.register(staticFiles, { root: resolve("dist") });
await app.listen({ port: 3002, host: "127.0.0.1" });
console.log("QA (ฐานข้อมูลชั่วคราว): http://localhost:3002");
const stop = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
