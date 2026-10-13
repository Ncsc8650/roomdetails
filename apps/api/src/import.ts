import { parse } from "csv-parse/sync";
import { randomUUID } from "node:crypto";
import { schemas } from "./entities";
import { insert, type Db, type Row } from "./db";
import { AppError, audit, validateRelations } from "./service";
export async function importAssets(db: Db, actor: string, csv: string) {
  let rows: Row[];
  try {
    rows = parse(csv, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      trim: true,
    }) as Row[];
  } catch {
    throw new AppError(400, "รูปแบบ CSV ไม่ถูกต้อง");
  }
  if (!rows.length || rows.length > 2000)
    throw new AppError(400, "นำเข้าได้ 1–2,000 รายการต่อครั้ง");
  const parsed = rows.map((r) => {
    const v = { ...r };
    for (const k of Object.keys(v)) if (v[k] === "") delete v[k];
    delete v.id;
    if (v.is_sample !== undefined) {
      if (!["true", "false"].includes(String(v.is_sample)))
        throw new AppError(400, "is_sample ต้องเป็น true หรือ false");
      v.is_sample = v.is_sample === "true";
    }
    if (v.purchase_price) v.purchase_price = Number(v.purchase_price);
    return schemas.assets.parse(v) as Row;
  });
  if (new Set(parsed.map((r) => r.asset_number)).size !== parsed.length)
    throw new AppError(409, "พบเลขทะเบียนซ้ำในไฟล์ CSV");
  return db.transaction(async (tx) => {
    for (const r of parsed) {
      await validateRelations(tx, "assets", r);
      const a = await insert(tx, "assets", { id: randomUUID(), ...r });
      await insert(tx, "asset_assignment_history", {
        id: randomUUID(),
        asset_id: a.id,
        person_id: a.custodian_id,
        changed_by: actor,
        reason: "นำเข้า CSV",
      });
      await audit(tx, actor, "import", "assets", String(a.id), null, a);
    }
    return { count: parsed.length };
  });
}
