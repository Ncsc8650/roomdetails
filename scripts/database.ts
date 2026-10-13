import { writeFile } from "node:fs/promises";
import { openDb, migrate } from "../apps/api/src/db";
import { seed, snapshot } from "../db/seed";
const db = await openDb();
try {
  await migrate(db);
  const command = process.argv[2];
  if (command === "seed") {
    await seed(db);
    console.log("สร้างข้อมูล SAMPLE แล้ว");
  }
  if (command === "snapshot")
    await writeFile(
      "data/sheets-seed.json",
      JSON.stringify(await snapshot(db)),
    );
} finally {
  await db.close();
}
