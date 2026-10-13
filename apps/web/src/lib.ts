export type RecordRow = { id: string; [key: string]: unknown };
export type Data = Record<string, RecordRow[]>;
export type User = {
  id: string;
  username: string;
  role: string;
  is_demo: boolean;
};
export function mayNavigate() {
  return window.dispatchEvent(
    new Event("acc-before-navigate", { cancelable: true }),
  );
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "asset-command-center",
    },
    body:
      body === undefined
        ? ["GET", "HEAD"].includes(method)
          ? undefined
          : "{}"
        : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์");
  return data as T;
}
export const entityNames: Record<string, string> = {
  agencies: "กรม",
  buildings: "อาคาร",
  floors: "ชั้น",
  divisions: "กองงาน",
  rooms: "ห้อง",
  division_room_links: "กองงาน / ห้อง",
  organizational_departments: "แผนก",
  areas: "จุดพื้นที่",
  personnel: "บุคลากร",
  asset_categories: "ประเภทครุภัณฑ์",
  assets: "ทะเบียนครุภัณฑ์",
  fixtures: "อุปกรณ์ติดตั้ง",
  view_presets: "มุมมองที่บันทึก",
};
export const fieldNames: Record<string, string> = {
  name: "ชื่อ",
  verification: "สถานะยืนยัน",
  agency_id: "กรม",
  building_id: "อาคาร",
  floor_id: "ชั้น",
  division_id: "กองงาน",
  room_id: "ห้อง",
  department_id: "แผนก",
  area_id: "จุดพื้นที่",
  category_id: "ประเภท",
  custodian_id: "ผู้รับผิดชอบ",
  user_id: "ผู้ใช้งาน",
  parent_id: "หมวดแม่",
  short_name: "ชื่อย่อ",
  width: "กว้าง (ม.)",
  depth: "ลึก (ม.)",
  kind: "ชนิดพื้นที่",
  description: "รายละเอียด",
  rank: "ยศ",
  first_name: "ชื่อ",
  last_name: "นามสกุล",
  position_title: "ตำแหน่ง",
  active: "เปิดใช้งาน",
  is_sample: "ข้อมูลตัวอย่าง SAMPLE",
  code: "รหัส",
  icon: "ไอคอน",
  default_width: "กว้างเริ่มต้น (ม.)",
  default_depth: "ลึกเริ่มต้น (ม.)",
  asset_number: "เลขทะเบียนครุภัณฑ์",
  brand: "ยี่ห้อ",
  model: "รุ่น",
  status: "สถานะ",
  condition: "สภาพ",
  purchase_date: "วันที่จัดซื้อ",
  purchase_price: "ราคา",
  notes: "หมายเหตุ",
  fixture_code: "รหัสอุปกรณ์",
  version: "รุ่นข้อมูล",
};
export const references: Record<string, string> = {
  agency_id: "agencies",
  building_id: "buildings",
  floor_id: "floors",
  division_id: "divisions",
  room_id: "rooms",
  department_id: "organizational_departments",
  area_id: "areas",
  category_id: "asset_categories",
  custodian_id: "personnel",
  user_id: "personnel",
  parent_id: "asset_categories",
};
export const entityFields: Record<string, string[]> = {
  agencies: ["name", "verification"],
  buildings: ["name", "agency_id"],
  floors: ["name", "building_id"],
  divisions: ["name", "short_name", "agency_id"],
  rooms: ["name", "floor_id", "width", "depth"],
  division_room_links: ["division_id", "room_id"],
  organizational_departments: ["name", "division_id"],
  areas: [
    "name",
    "kind",
    "description",
    "room_id",
    "division_id",
    "department_id",
    "width",
    "depth",
  ],
  personnel: [
    "rank",
    "first_name",
    "last_name",
    "division_id",
    "department_id",
    "position_title",
    "active",
  ],
  asset_categories: [
    "name",
    "code",
    "parent_id",
    "icon",
    "default_width",
    "default_depth",
    "active",
  ],
  assets: [
    "asset_number",
    "name",
    "category_id",
    "area_id",
    "custodian_id",
    "user_id",
    "division_id",
    "department_id",
    "brand",
    "model",
    "status",
    "condition",
    "purchase_date",
    "purchase_price",
    "notes",
  ],
  fixtures: ["fixture_code", "name", "area_id"],
};
export const displayName = (r: RecordRow) =>
  r.first_name
    ? `${r.rank || ""} ${r.first_name} ${r.last_name}`
    : String(r.name || r.id);
export function textValue(data: Data, row: RecordRow, key: string) {
  const v = row[key];
  if (v == null) return "—";
  if (references[key]) {
    const r = data[references[key]]?.find((r) => r.id === v);
    return r ? displayName(r) : String(v);
  }
  return String(v);
}
export function categoryDescendants(data: Data, ids: string[]) {
  const result = new Set(ids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of data.asset_categories || [])
      if (result.has(String(c.parent_id)) && !result.has(c.id)) {
        result.add(c.id);
        changed = true;
      }
  }
  return result;
}
export function csv(rows: RecordRow[], keys: string[]) {
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      keys.map((k) => cell(fieldNames[k] || k)).join(","),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(",")),
    ].join("\r\n")
  );
}
export function download(
  name: string,
  body: string,
  type = "text/csv;charset=utf-8",
) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const thaiDate = (value: unknown) =>
  new Date(String(value)).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
