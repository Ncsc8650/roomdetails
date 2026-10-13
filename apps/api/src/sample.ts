import { type Db } from "./db";
import { audit, AppError } from "./service";
import type { LayoutObject } from "../../../packages/shared/model";
export async function purgeSample(db: Db, actor: string) {
  return db.transaction(async (tx) => {
    await tx.query(
      "LOCK TABLE agencies,buildings,floors,divisions,rooms,division_room_links,organizational_departments,areas,personnel,assets,fixtures,layouts,asset_movements,asset_assignment_history IN SHARE ROW EXCLUSIVE MODE",
    );
    const mixed = await tx.query(
      "SELECT l.id FROM division_room_links l JOIN divisions d ON d.id=l.division_id JOIN rooms r ON r.id=l.room_id WHERE d.is_sample<>r.is_sample",
    );
    if (mixed.length)
      throw new AppError(
        409,
        "มีการเชื่อมกอง/ห้องตัวอย่างกับข้อมูลจริง จึงล้าง SAMPLE ไม่ได้",
      );
    const sampled = [
      ...(await tx.query("SELECT id FROM assets WHERE is_sample")),
      ...(await tx.query("SELECT id FROM areas WHERE is_sample")),
      ...(await tx.query("SELECT id FROM fixtures WHERE is_sample")),
    ];
    const ids = new Set(sampled.map((r) => String(r.id)));
    const before = {
      assets: (
        await tx.query(
          "SELECT count(*)::int AS count FROM assets WHERE is_sample",
        )
      )[0].count,
      personnel: (
        await tx.query(
          "SELECT count(*)::int AS count FROM personnel WHERE is_sample",
        )
      )[0].count,
    };
    for (const l of await tx.query("SELECT * FROM layouts FOR UPDATE")) {
      const remove = (v: unknown) =>
        (v as LayoutObject[]).filter((o) => !o.ref_id || !ids.has(o.ref_id));
      const objects = remove(l.objects),
        published = remove(l.published_objects);
      if (
        objects.length !== (l.objects as LayoutObject[]).length ||
        published.length !== (l.published_objects as LayoutObject[]).length
      )
        await tx.query(
          "UPDATE layouts SET objects=$1,published_objects=$2,revision=revision+1 WHERE id=$3",
          [JSON.stringify(objects), JSON.stringify(published), l.id],
        );
    }
    await tx.query(
      "DELETE FROM asset_movements WHERE asset_id IN (SELECT id FROM assets WHERE is_sample)",
    );
    await tx.query(
      "DELETE FROM asset_assignment_history WHERE asset_id IN (SELECT id FROM assets WHERE is_sample)",
    );
    await tx.query("DELETE FROM assets WHERE is_sample");
    await tx.query("DELETE FROM fixtures WHERE is_sample");
    await tx.query(
      "DELETE FROM layouts WHERE area_id IN (SELECT id FROM areas WHERE is_sample) OR room_id IN (SELECT id FROM rooms WHERE is_sample)",
    );
    for (const table of ["areas", "personnel", "organizational_departments"])
      await tx.query(`DELETE FROM ${table} WHERE is_sample`);
    await tx.query(
      "DELETE FROM division_room_links WHERE division_id IN (SELECT id FROM divisions WHERE is_sample) OR room_id IN (SELECT id FROM rooms WHERE is_sample)",
    );
    for (const table of [
      "rooms",
      "divisions",
      "floors",
      "buildings",
      "agencies",
    ])
      await tx.query(`DELETE FROM ${table} WHERE is_sample`);
    // Any real reference raises a foreign-key error and rolls this entire transaction back.
    await audit(tx, actor, "purge_sample", "sample", "sample", before, {
      cleared: true,
    });
    return before;
  });
}
