import { z } from "zod";
export const assetNumber = z
  .string()
  .regex(
    /^7[0-9]{3}\.[0-9]{4}\.[0-9]{3}\.[0-9]{3}\.[0-9]{2}$/,
    "เลขทะเบียนต้องเป็น 7xxx.xxxx.xxx.xxx.xx",
  );
export const objectSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "area",
    "asset",
    "wall",
    "door",
    "window",
    "pillar",
    "walkway",
    "zone",
    "point",
    "fixture",
  ]),
  ref_id: z.string().optional(),
  name: z.string().max(200),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().positive().max(1000),
  depth: z.number().positive().max(1000),
  rotation: z.number().finite(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  z: z.number().int(),
  group_id: z.string().optional(),
});
export type LayoutObject = z.infer<typeof objectSchema>;
export const layoutSchema = z.object({
  revision: z.number().int().positive(),
  width: z.number().positive().max(1000),
  depth: z.number().positive().max(1000),
  orientation: z.enum(["landscape", "portrait"]),
  objects: z.array(objectSchema),
  settings: z.object({
    snap: z.number().positive(),
    bounds: z.boolean(),
    labels: z.enum(["full", "short", "none"]),
    filters: z.record(z.string(), z.unknown()).optional(),
  }),
  publish: z.boolean().default(false),
});
export function withinBounds(o: LayoutObject, w: number, h: number) {
  const a = (o.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [0, 0],
    [o.width, 0],
    [0, o.depth],
    [o.width, o.depth],
  ].every(([x, y]) => {
    const px = o.x + x * c - y * s,
      py = o.y + x * s + y * c;
    return (
      px >= -0.0001 && py >= -0.0001 && px <= w + 0.0001 && py <= h + 0.0001
    );
  });
}
export function externalUrl(url: string) {
  const u = new URL(url);
  u.searchParams.set("openExternalBrowser", "1");
  return u.toString();
}
export function overlaps(a: LayoutObject, b: LayoutObject) {
  const corners = (o: LayoutObject) => {
    const r = (o.rotation * Math.PI) / 180,
      c = Math.cos(r),
      s = Math.sin(r);
    return [
      [0, 0],
      [o.width, 0],
      [o.width, o.depth],
      [0, o.depth],
    ].map(([x, y]) => [o.x + x * c - y * s, o.y + x * s + y * c]);
  };
  const ac = corners(a),
    bc = corners(b);
  for (const p of [ac, bc])
    for (let i = 0; i < 2; i++) {
      const edge = [p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]],
        axis = [-edge[1], edge[0]],
        project = (points: number[][]) =>
          points.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      const pa = project(ac),
        pb = project(bc);
      if (
        Math.max(...pa) <= Math.min(...pb) + 1e-8 ||
        Math.max(...pb) <= Math.min(...pa) + 1e-8
      )
        return false;
    }
  return true;
}
