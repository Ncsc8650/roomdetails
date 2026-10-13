import "dotenv/config";
import { readFile } from "node:fs/promises";

// Local API import preserves authorization, audit and the single running DB owner.
// Usage: pnpm exec tsx scripts/import-source.ts imports/source.json <division-id>
const [file, division] = process.argv.slice(2);
if (!file || !division)
  throw Error("ระบุไฟล์ JSON จาก extract-source.py และ division-id ข้อมูลจริง");
const origin = `http://127.0.0.1:${process.env.PORT || 3001}`;
let cookie = "";
async function request(path: string, body: unknown) {
  const response = await fetch(origin + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "asset-command-center",
      Cookie: cookie,
    },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error);
  const session = response.headers.get("set-cookie");
  if (session) cookie = session.split(";")[0];
  return value;
}
await request("/api/login", {
  username: process.env.ADMIN_USERNAME,
  password: process.env.ADMIN_PASSWORD,
});
try {
  const source = JSON.parse(await readFile(file, "utf8"));
  console.log(
    JSON.stringify(
      await request("/api/import/source", { ...source, division_id: division }),
      null,
      2,
    ),
  );
} finally {
  await request("/api/logout", {});
}
