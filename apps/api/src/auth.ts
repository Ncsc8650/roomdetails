import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";
import { insert, type Db } from "./db";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const a = Buffer.from(key, "hex"),
    b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function initUsers(db: Db) {
  if (process.env.ADMIN_PASSWORD) {
    if (process.env.ADMIN_PASSWORD.length < 12)
      throw Error("ADMIN_PASSWORD ต้องมีอย่างน้อย 12 ตัวอักษร");
    if (
      !(
        await db.query("SELECT id FROM user_accounts WHERE username=$1", [
          process.env.ADMIN_USERNAME || "admin",
        ])
      ).length
    )
      await insert(db, "user_accounts", {
        id: randomUUID(),
        username: process.env.ADMIN_USERNAME || "admin",
        password_hash: hashPassword(process.env.ADMIN_PASSWORD),
        role: "admin",
      });
  }
  if (
    process.env.DEMO_LOGIN === "true" &&
    !(await db.query("SELECT id FROM user_accounts WHERE id='demo-viewer'"))
      .length
  )
    await insert(db, "user_accounts", {
      id: "demo-viewer",
      username: "demo-viewer",
      password_hash: "disabled",
      role: "viewer",
      is_demo: true,
    });
}
