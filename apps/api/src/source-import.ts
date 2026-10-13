import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { assetNumber } from "../../../packages/shared/model";
import { insert, type Db, type Row } from "./db";
import { AppError, audit } from "./service";

const sourceRow = z
  .object({
    row_number: z.number().int().min(2),
    sequence: z.number().int().positive(),
    image: z.string().max(100),
    room: z.string().max(200),
    category: z.string().min(1).max(200),
    asset_number: z.string().min(1).max(200),
    brand: z.string().max(200),
    model: z.string().max(200),
    location: z.string().max(500),
    notes: z.string().max(2000),
    transcription_status: z.string().max(200),
  })
  .strict();
const inputSchema = z
  .object({
    source_name: z.string().min(1).max(300),
    division_id: z.string().min(1),
    rows: z.array(sourceRow).min(1).max(2000),
  })
  .strict();
type SourceRow = z.infer<typeof sourceRow>;

async function createSourceAsset(
  tx: Db,
  actor: string,
  division: string,
  row: SourceRow,
  code: string,
  source: string,
) {
  let [category] = await tx.query(
    "SELECT id FROM asset_categories WHERE name=$1 AND active ORDER BY id LIMIT 1",
    [row.category],
  );
  if (!category) {
    category = await insert(tx, "asset_categories", {
      id: randomUUID(),
      code: `IMPORT-${randomUUID()}`,
      name: row.category,
    });
    await audit(
      tx,
      actor,
      "create",
      "asset_categories",
      String(category.id),
      null,
      category,
    );
  }
  const asset = await insert(tx, "assets", {
    id: randomUUID(),
    asset_number: code,
    name: row.category,
    category_id: category.id,
    division_id: division,
    brand: row.brand,
    model: row.model,
    status: "รอตรวจสอบ",
    is_sample: false,
    notes: `นำเข้าจาก ${source} แถว Excel ${row.row_number}\nห้องที่: ${row.room}\nใช้ประจำ / สถานที่: ${row.location}\nหมายเหตุ / หน่วยรับผิดชอบ: ${row.notes}\nสถานะถอดข้อมูล: ${row.transcription_status}\nภาพต้นฉบับ: ${row.image}\nยังไม่ยืนยันตำแหน่งในผังและผู้รับผิดชอบ`,
  });
  await insert(tx, "asset_assignment_history", {
    id: randomUUID(),
    asset_id: asset.id,
    person_id: null,
    changed_by: actor,
    reason: "นำเข้าทะเบียนจากไฟล์ต้นฉบับ ยังไม่ระบุผู้รับผิดชอบ",
  });
  await audit(tx, actor, "import", "assets", String(asset.id), null, asset);
  return asset;
}

async function result(db: Db, batch: Row, reused: boolean) {
  const rows = await db.query(
    "SELECT status FROM asset_import_rows WHERE batch_id=$1",
    [batch.id],
  );
  return {
    batch_id: batch.id,
    count: rows.length,
    imported: rows.filter((r) => r.status === "imported").length,
    pending: rows.filter((r) => r.status === "pending").length,
    reused,
  };
}

export async function importSourceRows(db: Db, actor: string, input: unknown) {
  const b = inputSchema.parse(input);
  if (new Set(b.rows.map((r) => r.row_number)).size !== b.rows.length)
    throw new AppError(400, "เลขแถวต้นฉบับซ้ำกัน");
  const hash = createHash("sha256")
    .update(
      JSON.stringify([...b.rows].sort((a, b) => a.row_number - b.row_number)),
    )
    .digest("hex");
  return db.transaction(async (tx) => {
    // Serialize imports and registry inserts so a concurrent duplicate cannot slip through.
    await tx.query(
      "LOCK TABLE asset_import_batches, assets, asset_categories IN SHARE ROW EXCLUSIVE MODE",
    );
    const [existing] = await tx.query(
      "SELECT * FROM asset_import_batches WHERE content_hash=$1",
      [hash],
    );
    if (existing) return result(tx, existing, true);
    const [division] = await tx.query("SELECT * FROM divisions WHERE id=$1", [
      b.division_id,
    ]);
    if (!division || division.is_sample)
      throw new AppError(400, "เลือกกองงานข้อมูลจริงสำหรับนำเข้า");
    const batch = await insert(tx, "asset_import_batches", {
      id: randomUUID(),
      source_name: b.source_name,
      content_hash: hash,
      division_id: b.division_id,
      created_by: actor,
    });
    const counts = new Map<string, number>();
    for (const row of b.rows)
      counts.set(row.asset_number, (counts.get(row.asset_number) || 0) + 1);
    for (const row of b.rows) {
      const issues: string[] = [];
      if (!assetNumber.safeParse(row.asset_number).success)
        issues.push("รูปแบบรหัสต้องตรวจสอบกับต้นฉบับ");
      if (counts.get(row.asset_number)! > 1)
        issues.push("รหัสซ้ำในไฟล์ ต้องตรวจสอบทุกแถวที่ใช้รหัสนี้");
      if (
        (
          await tx.query("SELECT id FROM assets WHERE asset_number=$1", [
            row.asset_number,
          ])
        ).length
      )
        issues.push("รหัสมีอยู่ในทะเบียนแล้ว ไม่เขียนทับรายการเดิม");
      const asset = issues.length
        ? null
        : await createSourceAsset(
            tx,
            actor,
            b.division_id,
            row,
            row.asset_number,
            b.source_name,
          );
      await insert(tx, "asset_import_rows", {
        id: randomUUID(),
        batch_id: batch.id,
        row_number: row.row_number,
        original_data: JSON.stringify(row),
        source_code: row.asset_number,
        asset_id: asset?.id || null,
        status: asset ? "imported" : "pending",
        issue: issues.join("; "),
      });
    }
    const summary = await result(tx, batch, false);
    await audit(
      tx,
      actor,
      "import",
      "asset_import_batches",
      String(batch.id),
      null,
      summary,
    );
    return summary;
  });
}

export async function resolveSourceRow(
  db: Db,
  actor: string,
  id: string,
  input: unknown,
) {
  const b = z
    .object({
      asset_number: assetNumber,
      reason: z.string().trim().min(5).max(1000),
    })
    .strict()
    .parse(input);
  return db.transaction(async (tx) => {
    await tx.query(
      "LOCK TABLE assets, asset_categories IN SHARE ROW EXCLUSIVE MODE",
    );
    const [row] = await tx.query(
      "SELECT r.*,b.division_id,b.source_name FROM asset_import_rows r JOIN asset_import_batches b ON b.id=r.batch_id WHERE r.id=$1 FOR UPDATE OF r",
      [id],
    );
    if (!row) throw new AppError(404, "ไม่พบแถวต้นฉบับ");
    if (row.status !== "pending")
      throw new AppError(409, "แถวนี้นำเข้าทะเบียนแล้ว");
    if (
      (
        await tx.query("SELECT id FROM assets WHERE asset_number=$1", [
          b.asset_number,
        ])
      ).length
    )
      throw new AppError(409, "รหัสนี้มีอยู่ในทะเบียนแล้ว กรุณาตรวจสอบต้นฉบับ");
    const asset = await createSourceAsset(
      tx,
      actor,
      String(row.division_id),
      row.original_data as SourceRow,
      b.asset_number,
      String(row.source_name),
    );
    await tx.query(
      "UPDATE asset_import_rows SET asset_id=$1,status='imported',issue=$2 WHERE id=$3",
      [asset.id, `ตรวจสอบแล้ว: ${b.reason}`, id],
    );
    await audit(tx, actor, "resolve_import", "asset_import_rows", id, row, {
      asset_id: asset.id,
      confirmed_code: b.asset_number,
      reason: b.reason,
    });
    return { asset_id: asset.id };
  });
}
