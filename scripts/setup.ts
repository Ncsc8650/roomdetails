import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const example = await readFile(".env.example", "utf8");
  await writeFile(
    ".env",
    example.replace(
      "ADMIN_PASSWORD=",
      "ADMIN_PASSWORD=" + randomBytes(18).toString("base64url"),
    ),
    { flag: "wx" },
  );
  console.log(
    "สร้าง .env แล้ว: ดู ADMIN_PASSWORD ในไฟล์นี้เพื่อเข้าสู่ระบบ เก็บไฟล์นี้เป็นความลับ",
  );
} else console.log("พบ .env เดิม ไม่เขียนทับ");
