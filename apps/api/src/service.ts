import { randomUUID } from "node:crypto";
import { z } from "zod";
import { insert, type Db, type Row } from "./db";
import { schemas } from "./entities";
import {
  layoutSchema,
  withinBounds,
  type LayoutObject,
} from "../../../packages/shared/model";
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export async function audit(
  tx: Db,
  actor: string,
  action: string,
  entity: string,
  id: string,
  before: unknown,
  after: unknown,
) {
  await insert(tx, "audit_logs", {
    id: randomUUID(),
    actor,
    action,
    entity,
    entity_id: id,
    before_data: before == null ? null : JSON.stringify(before),
    after_data: after == null ? null : JSON.stringify(after),
  });
  await tx.query("UPDATE sync_state SET pending=true WHERE id='google_sheets'");
}
export async function validateRelations(
  tx: Db,
  table: string,
  row: Row,
  id?: string,
) {
  if (row.department_id) {
    const [d] = await tx.query(
      "SELECT * FROM organizational_departments WHERE id=$1",
      [row.department_id],
    );
    if (!d || d.division_id !== row.division_id)
      throw new AppError(400, "แผนกไม่ได้อยู่ในกองงานที่เลือก");
  }
  if (table === "areas" || table === "division_room_links") {
    const [r] = await tx.query(
      "SELECT b.agency_id FROM rooms r JOIN floors f ON r.floor_id=f.id JOIN buildings b ON f.building_id=b.id WHERE r.id=$1",
      [row.room_id],
    );
    const [d] = await tx.query("SELECT agency_id FROM divisions WHERE id=$1", [
      row.division_id,
    ]);
    if (!r || !d || r.agency_id !== d.agency_id)
      throw new AppError(400, "ห้องและกองงานต้องอยู่ในกรมเดียวกัน");
  }
  if (table === "assets") {
    const [category] = await tx.query(
      "SELECT active FROM asset_categories WHERE id=$1",
      [row.category_id],
    );
    if (!category?.active) throw new AppError(400, "ประเภทนี้ไม่ได้เปิดใช้งาน");
    for (const field of ["custodian_id", "user_id"])
      if (row[field]) {
        const [person] = await tx.query(
          "SELECT active FROM personnel WHERE id=$1 FOR UPDATE",
          [row[field]],
        );
        if (!person?.active)
          throw new AppError(400, "บุคลากรนี้ไม่ได้เปิดใช้งาน");
      }
  }
  if (
    table === "personnel" &&
    row.active === false &&
    id &&
    (
      await tx.query(
        "SELECT id FROM assets WHERE custodian_id=$1 OR user_id=$1",
        [id],
      )
    ).length
  )
    throw new AppError(409, "ต้องโอนครุภัณฑ์ของบุคลากรก่อนปิดใช้งาน");
  if (table === "asset_categories" && row.parent_id && id) {
    const ancestors = await tx.query(
      "WITH RECURSIVE chain AS (SELECT id,parent_id FROM asset_categories WHERE id=$1 UNION SELECT c.id,c.parent_id FROM asset_categories c JOIN chain ON c.id=chain.parent_id) SELECT id FROM chain",
      [row.parent_id],
    );
    if (ancestors.some((r) => r.id === id))
      throw new AppError(400, "หมวดหมู่วนกลับหาตัวเองไม่ได้");
  }
}
export async function saveEntity(
  db: Db,
  actor: string,
  table: string,
  input: unknown,
  id?: string,
) {
  if (!Object.hasOwn(schemas, table)) throw new AppError(404, "ไม่พบตาราง");
  const parsed = schemas[table].parse(input) as Row;
  return db.transaction(async (tx) => {
    const before = id
      ? (
          await tx.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`, [id])
        )[0]
      : null;
    if (id && !before) throw new AppError(404, "ไม่พบรายการ");
    const parents: Record<string, string[]> = {
      buildings: ["agency_id"],
      floors: ["building_id"],
      divisions: ["agency_id"],
      rooms: ["floor_id"],
      organizational_departments: ["division_id"],
      areas: ["room_id", "division_id"],
    };
    if (before && parents[table]?.some((k) => parsed[k] !== before[k]))
      throw new AppError(
        409,
        "ไม่รองรับย้ายโครงสร้างแม่ผ่านการแก้ไขทั่วไป ให้สร้างปลายทางและโอนข้อมูลโดยเก็บประวัติ",
      );
    if (table === "assets" && before) {
      if (parsed.asset_number !== before.asset_number)
        throw new AppError(400, "ห้ามเปลี่ยนเลขทะเบียน");
      if (
        parsed.area_id !== before.area_id ||
        parsed.custodian_id !== before.custodian_id
      )
        throw new AppError(
          400,
          "ใช้หน้าการโอนเพื่อเปลี่ยนพื้นที่หรือผู้รับผิดชอบ",
        );
    }
    if (table === "asset_categories")
      await tx.query("LOCK TABLE asset_categories IN SHARE ROW EXCLUSIVE MODE");
    await validateRelations(tx, table, parsed, id);
    const values = { ...parsed };
    if (table === "view_presets")
      values.filters = JSON.stringify(values.filters);
    const keys = Object.keys(values);
    const result = id
      ? (
          await tx.query(
            `UPDATE ${table} SET ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")}${table === "assets" ? ",version=version+1,updated_at=now()" : ""} WHERE id=$${keys.length + 1} RETURNING *`,
            [...keys.map((k) => values[k]), id],
          )
        )[0]
      : await insert(tx, table, { id: randomUUID(), ...values });
    if (!id && (table === "rooms" || table === "areas"))
      await insert(tx, "layouts", {
        id: randomUUID(),
        [table === "rooms" ? "room_id" : "area_id"]: result.id,
        width: result.width,
        depth: result.depth,
        settings: JSON.stringify({ snap: 0.25, bounds: true, labels: "full" }),
      });
    if (!id && table === "assets")
      await insert(tx, "asset_assignment_history", {
        id: randomUUID(),
        asset_id: result.id,
        person_id: result.custodian_id,
        changed_by: actor,
        reason: "สร้างทะเบียน",
      });
    await audit(
      tx,
      actor,
      id ? "update" : "create",
      table,
      String(result.id),
      before,
      result,
    );
    return result;
  });
}
export async function deleteEntity(
  db: Db,
  actor: string,
  table: string,
  id: string,
) {
  if (!Object.hasOwn(schemas, table)) throw new AppError(404, "ไม่พบตาราง");
  if (table === "assets")
    throw new AppError(409, "ทะเบียนไม่สามารถลบได้ ให้เปลี่ยนสถานะเป็นจำหน่าย");
  return db.transaction(async (tx) => {
    const [before] = await tx.query(
      `SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,
      [id],
    );
    if (!before) throw new AppError(404, "ไม่พบรายการ");
    if (table === "areas") {
      if (
        (await tx.query("SELECT id FROM assets WHERE area_id=$1", [id])).length
      )
        throw new AppError(409, "พื้นที่มีครุภัณฑ์ ต้องโอนก่อนลบ");
      await tx.query("DELETE FROM layouts WHERE area_id=$1", [id]);
      const masters = await tx.query(
        "SELECT * FROM layouts WHERE room_id=$1 FOR UPDATE",
        [before.room_id],
      );
      for (const l of masters) {
        const remove = (v: unknown) =>
          (v as LayoutObject[]).filter((o) => o.ref_id !== id);
        await tx.query(
          "UPDATE layouts SET objects=$1,published_objects=$2,revision=revision+1 WHERE id=$3",
          [
            JSON.stringify(remove(l.objects)),
            JSON.stringify(remove(l.published_objects)),
            l.id,
          ],
        );
      }
    }
    if (table === "rooms")
      await tx.query("DELETE FROM layouts WHERE room_id=$1", [id]);
    await tx.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    await audit(tx, actor, "delete", table, id, before, null);
  });
}
export async function saveLayout(
  db: Db,
  actor: string,
  id: string,
  input: unknown,
) {
  const body = layoutSchema.parse(input);
  return db.transaction(async (tx) => {
    const [before] = await tx.query(
      "SELECT * FROM layouts WHERE id=$1 FOR UPDATE",
      [id],
    );
    if (!before) throw new AppError(404, "ไม่พบผัง");
    if (before.revision !== body.revision)
      throw new AppError(
        409,
        "ผังถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดข้อมูลล่าสุด",
      );
    const ids = new Set<string>(),
      refs = new Set<string>();
    for (const o of body.objects) {
      if (ids.has(o.id)) throw new AppError(400, "รหัสวัตถุซ้ำ");
      ids.add(o.id);
      if (
        o.group_id &&
        !body.objects.some((p) => p.id === o.group_id && p.kind === "point")
      )
        throw new AppError(400, "จุดย่อยอ้างอิงไม่อยู่ในผัง");
      if (body.settings.bounds && !withinBounds(o, body.width, body.depth))
        throw new AppError(400, `วัตถุ ${o.name} อยู่นอกขอบเขต`);
      if (["area", "asset", "fixture"].includes(o.kind)) {
        if (!o.ref_id || refs.has(o.ref_id))
          throw new AppError(400, "วัตถุอ้างอิงซ้ำหรือไม่ถูกต้อง");
        refs.add(o.ref_id);
        if (
          (o.kind === "area" && !before.room_id) ||
          (o.kind !== "area" && !before.area_id)
        )
          throw new AppError(400, "ชนิดวัตถุไม่ตรงกับผัง");
        const table =
          o.kind === "area"
            ? "areas"
            : o.kind === "asset"
              ? "assets"
              : "fixtures";
        const [r] = await tx.query(`SELECT * FROM ${table} WHERE id=$1`, [
          o.ref_id,
        ]);
        if (
          !r ||
          (o.kind === "area"
            ? r.room_id !== before.room_id
            : r.area_id !== before.area_id)
        )
          throw new AppError(400, "วัตถุไม่ได้อยู่ในพื้นที่นี้");
      }
    }
    const [after] = await tx.query(
      "UPDATE layouts SET objects=$1,width=$2,depth=$3,orientation=$4,settings=$5,revision=revision+1,updated_at=now(),published_objects=CASE WHEN $6 THEN $1::jsonb ELSE published_objects END,published_at=CASE WHEN $6 THEN now() ELSE published_at END WHERE id=$7 RETURNING *",
      [
        JSON.stringify(body.objects),
        body.width,
        body.depth,
        body.orientation,
        JSON.stringify(body.settings),
        body.publish,
        id,
      ],
    );
    if (body.publish)
      await tx.query("UPDATE layouts SET published_config=$1 WHERE id=$2", [
        JSON.stringify({
          width: body.width,
          depth: body.depth,
          orientation: body.orientation,
          settings: body.settings,
        }),
        id,
      ]);
    await audit(
      tx,
      actor,
      body.publish ? "publish" : "draft",
      "layouts",
      id,
      before,
      after,
    );
    return after;
  });
}
const transferSchema = z
  .object({
    area_id: z.string().nullable(),
    custodian_id: z.string().nullable(),
    reason: z.string().trim().min(3).max(2000),
    version: z.number().int().positive(),
  })
  .strict();
export async function transfer(
  db: Db,
  actor: string,
  id: string,
  input: unknown,
) {
  const b = transferSchema.parse(input);
  return db.transaction(async (tx) => {
    const [a] = await tx.query("SELECT * FROM assets WHERE id=$1 FOR UPDATE", [
      id,
    ]);
    if (!a) throw new AppError(404, "ไม่พบทะเบียน");
    if (a.version !== b.version)
      throw new AppError(409, "ทะเบียนมีการเปลี่ยนแปลง กรุณาโหลดใหม่");
    if (b.custodian_id) {
      const [p] = await tx.query(
        "SELECT active FROM personnel WHERE id=$1 FOR UPDATE",
        [b.custodian_id],
      );
      if (!p?.active) throw new AppError(400, "บุคลากรไม่ได้เปิดใช้งาน");
    }
    const [after] = await tx.query(
      "UPDATE assets SET area_id=$1,custodian_id=$2,version=version+1,updated_at=now() WHERE id=$3 RETURNING *",
      [b.area_id, b.custodian_id, id],
    );
    if (a.area_id !== b.area_id) {
      const layouts = await tx.query(
        "SELECT * FROM layouts WHERE area_id=$1 FOR UPDATE",
        [a.area_id],
      );
      for (const l of layouts) {
        const filter = (v: unknown) =>
          (v as LayoutObject[]).filter((o) => o.ref_id !== id);
        await tx.query(
          "UPDATE layouts SET objects=$1,published_objects=$2,revision=revision+1 WHERE id=$3",
          [
            JSON.stringify(filter(l.objects)),
            JSON.stringify(filter(l.published_objects)),
            l.id,
          ],
        );
      }
    }
    await insert(tx, "asset_movements", {
      id: randomUUID(),
      asset_id: id,
      from_area_id: a.area_id,
      to_area_id: b.area_id,
      from_person_id: a.custodian_id,
      to_person_id: b.custodian_id,
      changed_by: actor,
      reason: b.reason,
    });
    if (a.custodian_id !== b.custodian_id) {
      await tx.query(
        "UPDATE asset_assignment_history SET assigned_to=now() WHERE asset_id=$1 AND assigned_to IS NULL",
        [id],
      );
      await insert(tx, "asset_assignment_history", {
        id: randomUUID(),
        asset_id: id,
        person_id: b.custodian_id,
        changed_by: actor,
        reason: b.reason,
      });
    }
    await audit(tx, actor, "transfer", "assets", id, a, after);
    return after;
  });
}
