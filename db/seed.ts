import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { insert, type Db, type Row } from "../apps/api/src/db";
import type { LayoutObject } from "../packages/shared/model";
export const departments = [
  "แผนกสารสนเทศพิเศษ",
  "แผนกสนับสนุนทางการเงิน",
  "แผนกสนับสนุนทางเทคนิค",
  "แผนกพัฒนาระบบงาน",
];
export async function seed(db: Db) {
  if (
    (await db.query("SELECT id FROM agencies WHERE id='agency-sample'")).length
  )
    return;
  const spec = await readFile("SPEC.md", "utf8");
  await db.transaction(async (tx) => {
    await insert(tx, "agencies", {
      id: "agency-sample",
      name: "กรมการเงินกลาโหม",
      verification: "sample-unverified",
      is_sample: true,
    });
    await insert(tx, "buildings", {
      id: "building-1",
      name: "อาคารบริการ",
      agency_id: "agency-sample",
      is_sample: true,
    });
    await insert(tx, "floors", {
      id: "floor-11",
      name: "11",
      building_id: "building-1",
      is_sample: true,
    });
    await insert(tx, "divisions", {
      id: "division-1",
      name: "กองกรรมวิธีข้อมูลทางการเงิน",
      short_name: "กกมง.กง.กห.",
      agency_id: "agency-sample",
      is_sample: true,
    });
    await insert(tx, "rooms", {
      id: "room-1",
      name: "พื้นที่กองกรรมวิธีข้อมูลทางการเงิน",
      floor_id: "floor-11",
      width: 18,
      depth: 12,
      is_sample: true,
    });
    await insert(tx, "division_room_links", {
      id: "link-1",
      division_id: "division-1",
      room_id: "room-1",
    });
    for (let i = 0; i < 4; i++)
      await insert(tx, "organizational_departments", {
        id: `department-${i + 1}`,
        name: departments[i],
        division_id: "division-1",
        is_sample: true,
      });
    const names = [
      ...departments,
      "จุด ผอ.กอง",
      "จุดรอง ผอ.กอง 1",
      "จุดรอง ผอ.กอง 2",
      "จุดโต๊ะเสมียน",
      "ห้องครัว",
      "ห้องเก็บของ",
    ];
    const positions = [
      [0.5, 3],
      [4.8, 3],
      [9.1, 3],
      [13.4, 3],
      [0.5, 8],
      [4.8, 8],
      [9.1, 8],
      [0.5, 0.5],
      [13.4, 8],
    ];
    const master: LayoutObject[] = [
      {
        id: "door-1",
        kind: "door",
        name: "ประตู",
        x: 0,
        y: 0,
        width: 1.2,
        depth: 0.15,
        rotation: 0,
        color: "#c1a56c",
        z: 0,
      },
    ];
    for (let i = 0; i < 10; i++) {
      await insert(tx, "areas", {
        id: `area-${i + 1}`,
        name: names[i],
        kind: i < 4 ? "department" : "room",
        room_id: "room-1",
        division_id: "division-1",
        department_id: i < 4 ? `department-${i + 1}` : null,
        width: 4,
        depth: i === 7 ? 1.5 : 3,
        is_sample: true,
      });
      if (i < 9)
        master.push({
          id: `placement-${i + 1}`,
          kind: "area",
          ref_id: `area-${i + 1}`,
          name: names[i],
          x: positions[i][0],
          y: positions[i][1],
          width: 4,
          depth: i === 7 ? 1.5 : 3,
          rotation: 0,
          color: i < 4 ? "#d9eae2" : "#ede9dd",
          z: i + 1,
        });
    }
    for (const line of spec.split("\n").filter((l) => /^\|P\d{3}\|/.test(l))) {
      const [id, rank, first_name, last_name] = line.split("|").slice(1);
      const n = Number(id.slice(1));
      await insert(tx, "personnel", {
        id,
        rank,
        first_name,
        last_name,
        division_id: "division-1",
        department_id: n <= 16 ? `department-${Math.ceil(n / 4)}` : null,
        position_title: "บุคลากรตัวอย่าง SAMPLE",
        is_sample: true,
      });
    }
    const cats = [
      "คอมพิวเตอร์",
      "โต๊ะทำงาน",
      "เก้าอี้",
      "เครื่องพิมพ์",
      "ตู้เอกสาร",
      "ปลั๊กไฟ (ตัวอย่างเท่านั้น)",
      "ตู้เย็น",
      "ไมโครเวฟ",
    ];
    for (const [id, name] of [
      ["it", "เทคโนโลยีสารสนเทศ"],
      ["furniture", "เฟอร์นิเจอร์"],
      ["electrical", "เครื่องใช้ไฟฟ้า"],
    ])
      await insert(tx, "asset_categories", { id, code: id, name });
    for (let i = 0; i < cats.length; i++)
      await insert(tx, "asset_categories", {
        id: `cat-${i + 1}`,
        code: `C${i + 1}`,
        name: cats[i],
        parent_id: [0, 3].includes(i)
          ? "it"
          : [1, 2, 4].includes(i)
            ? "furniture"
            : "electrical",
      });
    const catIds = [
      1, 2, 3, 4, 1, 2, 3, 5, 1, 2, 4, 6, 1, 2, 3, 6, 2, 1, 3, 5, 7, 8,
    ];
    const people = [
      1, 1, 2, 3, 5, 5, 6, 7, 9, 9, 10, 11, 13, 13, 14, 15, 17, 18, 19, 20, 21,
      22,
    ];
    const details: Record<string, LayoutObject[]> = {};
    for (let i = 0; i < 10; i++)
      details[`area-${i + 1}`] =
        i < 4
          ? Array.from({ length: 5 }, (_, j) => ({
              id: `point-${i}-${j}`,
              kind: "point",
              name: `จุดตัวอย่าง ${j + 1}`,
              x: 0.15 + (j % 2) * 1.8,
              y: 0.15 + Math.floor(j / 2) * 0.9,
              width: 1.5,
              depth: 0.65,
              rotation: 0,
              color: "#eef2ef",
              z: 0,
            }))
          : [];
    for (let i = 0; i < 22; i++) {
      const n = String(i + 1).padStart(3, "0"),
        a = i < 16 ? Math.floor(i / 4) + 1 : i < 20 ? i - 11 : 9,
        area = `area-${a}`,
        cat = catIds[i];
      await insert(tx, "assets", {
        id: `asset-${n}`,
        asset_number: `7100.0001.001.${n}.01`,
        name: cats[cat - 1],
        category_id: `cat-${cat}`,
        area_id: area,
        custodian_id: `P${String(people[i]).padStart(3, "0")}`,
        division_id: "division-1",
        department_id: a <= 4 ? `department-${a}` : null,
        is_sample: true,
        notes: "SAMPLE — ไม่ใช่ทะเบียนจริง",
      });
      const j = i < 16 ? i % 4 : i >= 20 ? i - 20 : 0;
      details[area].push({
        id: `object-${n}`,
        kind: "asset",
        ref_id: `asset-${n}`,
        name: cats[cat - 1],
        x: 0.25 + (j % 2) * 1.8,
        y: 0.25 + Math.floor(j / 2) * 1.05,
        width: 0.8,
        depth: 0.5,
        rotation: 0,
        color: "#86b8a5",
        z: j + 1,
        group_id: `point-${a - 1}-${j}`,
      });
      await insert(tx, "asset_assignment_history", {
        id: randomUUID(),
        asset_id: `asset-${n}`,
        person_id: `P${String(people[i]).padStart(3, "0")}`,
        changed_by: "seed",
        reason: "ข้อมูลตั้งต้น SAMPLE",
      });
    }
    await insert(tx, "layouts", {
      id: "master-room-1",
      room_id: "room-1",
      width: 18,
      depth: 12,
      objects: JSON.stringify(master),
      settings: JSON.stringify({ snap: 0.25, bounds: true, labels: "full" }),
    });
    for (let i = 0; i < 10; i++)
      await insert(tx, "layouts", {
        id: `detail-area-${i + 1}`,
        area_id: `area-${i + 1}`,
        width: 4,
        depth: i === 7 ? 1.5 : 3,
        objects: JSON.stringify(details[`area-${i + 1}`]),
        settings: JSON.stringify({ snap: 0.1, bounds: true, labels: "full" }),
      });
    await insert(tx, "fixtures", {
      id: "fixture-1",
      fixture_code: "FX-SAMPLE-001",
      name: "ปลั๊กไฟติดผนัง SAMPLE",
      area_id: "area-3",
      is_sample: true,
    });
    for (const [name, categories] of [
      ["เฉพาะคอมฯ", ["cat-1"]],
      ["โต๊ะ + เก้าอี้", ["cat-2", "cat-3"]],
      ["เครื่องพิมพ์", ["cat-4"]],
      ["ปลั๊กไฟ", ["cat-6"]],
    ] as [string, string[]][])
      await insert(tx, "view_presets", {
        id: randomUUID(),
        name,
        filters: JSON.stringify({ categories }),
      });
  });
}
export const exportTables = [
  "agencies",
  "buildings",
  "floors",
  "divisions",
  "rooms",
  "division_room_links",
  "organizational_departments",
  "areas",
  "personnel",
  "asset_categories",
  "assets",
  "layouts",
  "fixtures",
  "asset_movements",
  "asset_assignment_history",
  "view_presets",
];
export async function snapshot(db: Db) {
  const result: Record<string, Row[]> = {};
  for (const table of exportTables)
    result[table] = await db.query(`SELECT * FROM ${table} ORDER BY id`);
  return result;
}
