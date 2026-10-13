import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
if (process.env.DATABASE_URL)
  throw Error("PostgreSQL Server: ใช้ pg_dump / pg_restore ตาม README");
const command = process.argv[2],
  file = process.argv[3];
if (command === "backup") {
  const directory = process.env.DATA_DIR || "./data/postgres";
  await stat(directory);
  const db = new PGlite(directory);
  try {
    await db.waitReady;
    const blob = await db.dumpDataDir();
    const output = file || `backups/postgres-${Date.now()}.tar.gz`;
    await mkdir(dirname(resolve(output)), { recursive: true });
    await writeFile(output, new Uint8Array(await blob.arrayBuffer()), {
      flag: "wx",
    });
    console.log(`สำรองแล้ว: ${resolve(output)}`);
  } finally {
    await db.close();
  }
} else if (command === "restore") {
  if (!file || !process.argv[4])
    throw Error("ใช้: pnpm db:restore <backup.tar.gz> <โฟลเดอร์ใหม่>");
  const target = resolve(process.argv[4]);
  let exists = false;
  try {
    await stat(target);
    exists = true;
  } catch {
    /* New destination only. */
  }
  if (exists)
    throw Error(
      "ปลายทางต้องเป็นโฟลเดอร์ใหม่เท่านั้น เพื่อไม่เขียนทับข้อมูลเดิม",
    );
  const bytes = await readFile(file);
  await mkdir(dirname(target), { recursive: true });
  const db = new PGlite({ dataDir: target, loadDataDir: new Blob([bytes]) });
  try {
    await db.waitReady;
    const r = await db.query("SELECT count(*) AS assets FROM assets");
    console.log("กู้คืนและตรวจฐานข้อมูลแล้ว", r.rows);
    console.log(`ตั้ง DATA_DIR=${target} เพื่อเปิดฐานที่กู้คืน`);
  } finally {
    await db.close();
  }
} else throw Error("ระบุ backup หรือ restore");
