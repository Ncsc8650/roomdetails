import { z } from "zod";
import { assetNumber } from "../../../packages/shared/model";
const name = z.string().trim().min(1).max(200),
  id = z.string().min(1).max(100),
  sample = z.boolean().default(false),
  nullable = id.nullable().default(null),
  size = z.number().positive().max(1000);
export const schemas: Record<string, z.ZodType> = {
  agencies: z
    .object({
      name,
      verification: z
        .enum(["sample-unverified", "confirmed"])
        .default("sample-unverified"),
      is_sample: sample,
    })
    .strict(),
  buildings: z.object({ name, agency_id: id, is_sample: sample }).strict(),
  floors: z.object({ name, building_id: id, is_sample: sample }).strict(),
  divisions: z
    .object({
      name,
      short_name: z.string().max(100).default(""),
      agency_id: id,
      is_sample: sample,
    })
    .strict(),
  rooms: z
    .object({
      name,
      floor_id: id,
      width: size.default(18),
      depth: size.default(12),
      is_sample: sample,
    })
    .strict(),
  division_room_links: z.object({ division_id: id, room_id: id }).strict(),
  organizational_departments: z
    .object({ name, division_id: id, is_sample: sample })
    .strict(),
  areas: z
    .object({
      name,
      kind: z.string().min(1).max(50).default("custom"),
      description: z.string().max(2000).default(""),
      room_id: id,
      division_id: id,
      department_id: nullable,
      width: size.default(4),
      depth: size.default(3),
      is_sample: sample,
    })
    .strict(),
  personnel: z
    .object({
      rank: z.string().max(50).default(""),
      first_name: name,
      last_name: name,
      division_id: id,
      department_id: nullable,
      position_title: z.string().max(200).default(""),
      active: z.boolean().default(true),
      is_sample: sample,
    })
    .strict(),
  asset_categories: z
    .object({
      name,
      parent_id: nullable,
      code: name,
      icon: z.string().max(40).default("box"),
      default_width: size.default(0.8),
      default_depth: size.default(0.6),
      active: z.boolean().default(true),
    })
    .strict(),
  assets: z
    .object({
      asset_number: assetNumber,
      name,
      category_id: id,
      area_id: nullable,
      custodian_id: nullable,
      user_id: nullable,
      division_id: id,
      department_id: nullable,
      brand: z.string().max(200).default(""),
      model: z.string().max(200).default(""),
      status: z
        .enum(["ใช้งาน", "ชำรุด", "ซ่อม", "รอตรวจสอบ", "จำหน่าย"])
        .default("ใช้งาน"),
      condition: z.string().max(500).default(""),
      purchase_date: z.iso.date().nullable().default(null),
      purchase_price: z.number().nonnegative().nullable().default(null),
      notes: z.string().max(4000).default(""),
      is_sample: sample,
    })
    .strict(),
  fixtures: z
    .object({ fixture_code: name, name, area_id: id, is_sample: sample })
    .strict(),
  view_presets: z
    .object({ name, filters: z.record(z.string(), z.unknown()) })
    .strict(),
};
export const labels: Record<string, string> = {
  agencies: "กรม",
  buildings: "อาคาร",
  floors: "ชั้น",
  divisions: "กองงาน",
  rooms: "ห้อง",
  division_room_links: "กองงานใช้ห้อง",
  organizational_departments: "แผนก",
  areas: "จุดพื้นที่",
  personnel: "บุคลากร",
  asset_categories: "ประเภทครุภัณฑ์",
  assets: "ทะเบียนครุภัณฑ์",
  fixtures: "อุปกรณ์ติดตั้ง",
  view_presets: "มุมมองที่บันทึก",
};
