import { useEffect, useRef, useState } from "react";
import {
  Stage,
  Layer,
  Rect,
  Text,
  Group,
  Transformer,
  Line,
} from "react-konva";
import Konva from "konva";
import {
  Save,
  Undo2,
  Redo2,
  Plus,
  ZoomIn,
  ZoomOut,
  MousePointer2,
  Hand,
  ArrowLeft,
  Upload,
  Trash2,
} from "lucide-react";
import {
  api,
  type Data,
  type RecordRow,
  displayName,
  categoryDescendants,
  thaiDate,
} from "./lib";
import { EntityForm } from "./EntityManager";
import {
  withinBounds,
  overlaps,
  type LayoutObject,
} from "../../../packages/shared/model";
type Filters = {
  categories: string[];
  search: string;
  status: string;
  custodian: string;
  department: string;
};
type Settings = {
  snap: number;
  bounds: boolean;
  labels: "full" | "short" | "none";
  filters?: Filters;
};
type Layout = RecordRow & {
  width: number;
  depth: number;
  revision: number;
  orientation: "landscape" | "portrait";
  objects: LayoutObject[];
  settings: Settings;
  published_at: string | null;
};
const emptyFilters: Filters = {
  categories: [],
  search: "",
  status: "",
  custodian: "",
  department: "",
};
const structures = {
  wall: "ผนัง",
  door: "ประตู",
  window: "หน้าต่าง",
  pillar: "เสา",
  walkway: "ทางเดิน",
  zone: "โซน",
  point: "จุดย่อย",
};
type Props = {
  data: Data;
  roomId: string;
  areaId: string;
  canEdit: boolean;
  includeSample: boolean;
  openArea: (id: string) => void;
  reload: () => Promise<void>;
  notify: (s: string) => void;
};
export function LayoutEditor(props: Props) {
  const l = props.data.layouts.find((l) =>
    props.areaId ? l.area_id === props.areaId : l.room_id === props.roomId,
  ) as Layout | undefined;
  return l ? (
    <Editor key={l.id} {...props} layout={l} />
  ) : (
    <section className="panel empty">
      เลือกห้อง หรือเพิ่มห้องและเชื่อมกองงานในเมนูโครงสร้างองค์กร
    </section>
  );
}
function Editor({
  data,
  roomId,
  areaId,
  canEdit,
  includeSample,
  openArea,
  reload,
  notify,
  layout,
}: Props & { layout: Layout }) {
  const [objects, setObjects] = useState(layout.objects),
    [settings, setSettings] = useState<Settings>({ ...layout.settings }),
    [width, setWidth] = useState(layout.width),
    [depth, setDepth] = useState(layout.depth),
    [orientation, setOrientation] = useState(layout.orientation),
    [revision, setRevision] = useState(layout.revision),
    [selected, setSelected] = useState(""),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState(false),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [savedAt, setSavedAt] = useState(""),
    [auto, setAuto] = useState(false),
    [filters, setFilters] = useState<Filters>({
      ...emptyFilters,
      ...layout.settings.filters,
    }),
    [create, setCreate] = useState<"areas" | "assets" | "fixtures" | null>(
      null,
    ),
    [past, setPast] = useState<LayoutObject[][]>([]),
    [future, setFuture] = useState<LayoutObject[][]>([]),
    [published, setPublished] = useState(layout.published_at),
    [showPublished, setShowPublished] = useState(false),
    [canvasWidth, setCanvasWidth] = useState(800);
  const canvasBox = useRef<HTMLDivElement>(null),
    inFlight = useRef(false),
    latest = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    const observer = new ResizeObserver((e) =>
      setCanvasWidth(e[0].contentRect.width),
    );
    if (canvasBox.current) observer.observe(canvasBox.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: Event) => {
      if (!confirm("ยังมีการแก้ไขผังที่ไม่บันทึก ต้องการออกหรือไม่?"))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", before);
    window.addEventListener("acc-before-navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", before);
      window.removeEventListener("acc-before-navigate", navigate);
    };
  }, [dirty]);
  const editable = canEdit && !saving && !showPublished;
  function change(next: LayoutObject[]) {
    if (!editable) return;
    setPast((p) => [...p.slice(-49), objects]);
    setFuture([]);
    setObjects(next);
    setDirty(true);
    setError("");
  }
  function patch(id: string, values: Partial<LayoutObject>) {
    change(objects.map((o) => (o.id === id ? { ...o, ...values } : o)));
  }
  function filter(values: Partial<Filters>) {
    if (saving || showPublished) return;
    setFilters((f) => ({ ...f, ...values }));
    if (canEdit) setDirty(true);
  }
  function setting(values: Partial<Settings>) {
    if (saving || showPublished) return;
    setSettings((s) => ({ ...s, ...values }));
    if (canEdit) setDirty(true);
  }
  const current = objects.find((o) => o.id === selected);
  async function save(publish = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const l = await api<Layout>(`/layouts/${layout.id}`, "PUT", {
        revision,
        width,
        depth,
        orientation,
        objects,
        settings: { ...settings, filters },
        publish,
      });
      setRevision(l.revision);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString("th-TH"));
      setPublished(l.published_at);
      await reload();
    } catch (e) {
      setError((e as Error).message);
      setAuto(false);
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }
  latest.current = () => save();
  useEffect(() => {
    if (!auto || !dirty || saving) return;
    const t = setTimeout(() => void latest.current(), 1500);
    return () => clearTimeout(t);
  }, [
    auto,
    dirty,
    objects,
    settings,
    width,
    depth,
    orientation,
    filters,
    saving,
  ]);
  function navigate(id: string) {
    if (
      dirty &&
      !confirm("ยังมีการแก้ไขที่ไม่บันทึก ต้องการออกจากผังนี้หรือไม่?")
    )
      return;
    openArea(id);
  }
  const snap = (v: number) => Math.round(v / settings.snap) * settings.snap;
  const actualObjects = showPublished
    ? ((data.layouts.find((l) => l.id === layout.id)?.published_objects ||
        []) as LayoutObject[])
    : objects;
  const cats = categoryDescendants(data, filters.categories);
  const visible = actualObjects
    .filter((o) => {
      if (o.kind === "area") {
        const a = data.areas.find((a) => a.id === o.ref_id);
        return (
          !!a &&
          (includeSample || !a.is_sample) &&
          (!filters.department || a.department_id === filters.department)
        );
      }
      if (o.kind !== "asset") return true;
      const a = data.assets.find((a) => a.id === o.ref_id);
      return (
        !!a &&
        (includeSample || !a.is_sample) &&
        (!cats.size || cats.has(String(a.category_id))) &&
        (!filters.search ||
          `${a.asset_number} ${a.name}`.includes(filters.search)) &&
        (!filters.status || a.status === filters.status) &&
        (!filters.custodian || a.custodian_id === filters.custodian) &&
        (!filters.department || a.department_id === filters.department)
      );
    })
    .sort((a, b) => a.z - b.z);
  const available = areaId
    ? data.assets.filter(
        (a) =>
          a.area_id === areaId &&
          (includeSample || !a.is_sample) &&
          !objects.some((o) => o.ref_id === a.id),
      )
    : data.areas.filter(
        (a) =>
          a.room_id === roomId &&
          (includeSample || !a.is_sample) &&
          !objects.some((o) => o.ref_id === a.id),
      );
  const visibleAssets = visible.filter((o) => o.kind === "asset");
  const publishedConfig = data.layouts.find((l) => l.id === layout.id)
    ?.published_config as { width: number; depth: number } | undefined;
  const viewWidth =
      showPublished && publishedConfig ? publishedConfig.width : width,
    viewDepth =
      showPublished && publishedConfig ? publishedConfig.depth : depth;
  const scale =
      Math.min(
        75,
        Math.max(14, (canvasWidth - (areaId ? 230 : 44)) / viewWidth),
      ) * zoom,
    w = viewWidth * scale,
    h = viewDepth * scale;
  const overlapping = objects.filter((a, i) =>
    objects.some(
      (b, j) =>
        i !== j && a.kind === "asset" && b.kind === "asset" && overlaps(a, b),
    ),
  );
  const outOfBounds = objects.filter((o) => !withinBounds(o, width, depth));
  function add(kind: LayoutObject["kind"], ref?: RecordRow) {
    const obj: LayoutObject = {
      id: crypto.randomUUID(),
      kind,
      ref_id: ref?.id,
      name: ref
        ? displayName(ref)
        : structures[kind as keyof typeof structures] || "วัตถุ",
      x: 0,
      y: 0,
      width: Math.min(
        width,
        Number(
          ref?.width || (["wall", "window", "door"].includes(kind) ? 1.5 : 1),
        ),
      ),
      depth: Math.min(
        depth,
        Number(
          ref?.depth ||
            (["wall", "window", "door"].includes(kind) ? 0.12 : 0.6),
        ),
      ),
      rotation: 0,
      color:
        kind === "area"
          ? "#d9eae2"
          : kind === "asset"
            ? "#8eb9a6"
            : kind === "point"
              ? "#eff2eb"
              : kind === "wall"
                ? "#516a60"
                : "#d7c6a2",
      z: objects.length,
    };
    change([...objects, obj]);
    setSelected(obj.id);
  }
  function template() {
    const s = prompt(
      "จำนวนจุดแต่ละแถว (2–8 แถว, แถวละ 2–10 จุด) เช่น 2,2,2",
      "2,2,2",
    );
    if (!s) return;
    const ns = s.split(",").map(Number);
    if (
      ns.length < 2 ||
      ns.length > 8 ||
      ns.some((n) => !Number.isInteger(n) || n < 2 || n > 10)
    ) {
      setError("รูปแบบแม่แบบไม่ถูกต้อง");
      return;
    }
    const points: LayoutObject[] = ns.flatMap((n, r) =>
      Array.from({ length: n }, (_, c) => ({
        id: crypto.randomUUID(),
        kind: "point",
        name: `แถว ${r + 1} จุด ${c + 1}`,
        x: (c * width) / n,
        y: (r * depth) / ns.length,
        width: (width / n) * 0.85,
        depth: (depth / ns.length) * 0.85,
        rotation: 0,
        color: "#eff2eb",
        z: 0,
      })),
    );
    change([...objects, ...points]);
  }
  const title = areaId
    ? data.areas.find((a) => a.id === areaId)?.name
    : data.rooms.find((r) => r.id === roomId)?.name;
  return (
    <>
      <section className="panel layout-panel">
        <div className="panel-head">
          <div className="actions">
            {areaId && (
              <button onClick={() => navigate("")}>
                <ArrowLeft size={17} />
              </button>
            )}
            <div>
              <h2>
                {areaId ? "Detail Layout" : "Master Layout"}{" "}
                <span className="muted">/ {String(title)}</span>
              </h2>
              <p>
                {width} × {depth} เมตร ·{" "}
                {areaId
                  ? "ครุภัณฑ์หลายรายการต่อจุด"
                  : "คลิกเลือกพื้นที่ แล้วเปิดผังย่อย"}{" "}
                · รุ่น {revision}
              </p>
            </div>
          </div>
          <div className="actions">
            <span className="save-status">
              {saving
                ? "กำลังบันทึก…"
                : dirty
                  ? "มีการแก้ไข"
                  : savedAt
                    ? `บันทึก ${savedAt}`
                    : "โหลดจากฐานข้อมูล"}
            </span>
            {canEdit && (
              <>
                <button
                  disabled={saving || showPublished}
                  onClick={() => void save()}
                >
                  <Save size={15} /> บันทึกร่าง
                </button>
                <button
                  className="primary"
                  disabled={saving || showPublished}
                  onClick={() => void save(true)}
                >
                  <Upload size={15} /> เผยแพร่ผัง
                </button>
              </>
            )}
          </div>
        </div>
        <div className="layout-toolbar">
          <div className="actions">
            <button
              className={!pan ? "selected" : ""}
              title="เลือกวัตถุ"
              onClick={() => setPan(false)}
            >
              <MousePointer2 size={16} />
            </button>
            <button
              className={pan ? "selected" : ""}
              title="เลื่อนผัง"
              onClick={() => setPan(true)}
            >
              <Hand size={16} />
            </button>
            <button
              title="ลดขนาด"
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
            >
              <ZoomOut size={16} />
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              title="ขยาย"
              onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
            >
              <ZoomIn size={16} />
            </button>
            <button
              disabled={!past.length || !editable}
              title="ย้อนกลับ"
              onClick={() => {
                setFuture((f) => [objects, ...f]);
                setObjects(past[past.length - 1]);
                setPast((p) => p.slice(0, -1));
                setDirty(true);
              }}
            >
              <Undo2 size={16} />
            </button>
            <button
              disabled={!future.length || !editable}
              title="ทำซ้ำ"
              onClick={() => {
                setPast((p) => [...p, objects]);
                setObjects(future[0]);
                setFuture((f) => f.slice(1));
                setDirty(true);
              }}
            >
              <Redo2 size={16} />
            </button>
          </div>
          <div className="actions">
            <label>
              กริด{" "}
              <select
                disabled={!editable}
                value={settings.snap}
                onChange={(e) => setting({ snap: Number(e.target.value) })}
              >
                {[0.05, 0.1, 0.25, 0.5].map((v) => (
                  <option key={v} value={v}>
                    {v * 100} ซม.
                  </option>
                ))}
              </select>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={auto}
                disabled={!editable}
                onChange={(e) => setAuto(e.target.checked)}
              />{" "}
              บันทึกอัตโนมัติ
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={showPublished}
                disabled={dirty || saving}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setShowPublished(checked);
                  const config = data.layouts.find((l) => l.id === layout.id)
                    ?.published_config as { settings: Settings } | undefined;
                  const next =
                    checked && config ? config.settings : layout.settings;
                  setSettings(next);
                  setFilters({ ...emptyFilters, ...next.filters });
                }}
              />{" "}
              ดูฉบับเผยแพร่
            </label>
          </div>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}{" "}
            <button
              onClick={() => {
                if (confirm("ทิ้งร่างที่ยังไม่บันทึกและโหลดใหม่?"))
                  location.reload();
              }}
            >
              โหลดใหม่
            </button>
          </div>
        )}
        <div className="editor-body">
          <div className="editor-canvas" ref={canvasBox}>
            <div className="canvas-caption">
              {orientation === "landscape" ? "แนวนอน" : "แนวตั้ง"} •
              พิกัดจริงไม่เปลี่ยนตามทิศทาง • หน่วยเมตร
            </div>
            <div className="stage-scroll">
              <Stage
                width={Math.max(canvasWidth, w + (areaId ? 240 : 44))}
                height={Math.max(450, h + 85, visibleAssets.length * 35 + 80)}
                draggable={pan}
                onMouseDown={(e) => {
                  if (e.target === e.target.getStage()) setSelected("");
                }}
              >
                <Layer x={22} y={25}>
                  <Rect
                    width={w}
                    height={h}
                    fill="#fafbf8"
                    stroke="#8c9c8c"
                    strokeWidth={2}
                    onClick={() => setSelected("")}
                  />
                  {Array.from(
                    { length: Math.min(201, Math.ceil(width / settings.snap)) },
                    (_, i) => (
                      <Line
                        key={"x" + i}
                        points={[
                          i * settings.snap * scale,
                          0,
                          i * settings.snap * scale,
                          h,
                        ]}
                        stroke="#e4eadd"
                        strokeWidth={0.5}
                        listening={false}
                      />
                    ),
                  )}
                  {Array.from(
                    { length: Math.min(201, Math.ceil(depth / settings.snap)) },
                    (_, i) => (
                      <Line
                        key={"y" + i}
                        points={[
                          0,
                          i * settings.snap * scale,
                          w,
                          i * settings.snap * scale,
                        ]}
                        stroke="#e4eadd"
                        strokeWidth={0.5}
                        listening={false}
                      />
                    ),
                  )}
                  {visible.map((o) => (
                    <Shape
                      key={o.id}
                      object={o}
                      scale={scale}
                      selected={o.id === selected}
                      editable={editable && !pan}
                      onSelect={() => setSelected(o.id)}
                      onOpen={() => {
                        if (o.kind === "area" && o.ref_id) navigate(o.ref_id);
                      }}
                      onChange={(values) => {
                        const proposed = {
                          ...o,
                          ...values,
                          x: snap(values.x ?? o.x),
                          y: snap(values.y ?? o.y),
                        };
                        if (
                          settings.bounds &&
                          !withinBounds(proposed, width, depth)
                        ) {
                          setError("ตำแหน่งหรือขนาดเกินขอบเขต");
                          setObjects((old) => [...old]);
                          return;
                        }
                        patch(o.id, proposed);
                      }}
                      count={
                        o.kind === "area"
                          ? data.assets.filter(
                              (a) =>
                                a.area_id === o.ref_id &&
                                (includeSample || !a.is_sample),
                            ).length
                          : undefined
                      }
                    />
                  ))}
                  {settings.labels !== "none" &&
                    visibleAssets.map((o, i) => {
                      const a = data.assets.find((a) => a.id === o.ref_id),
                        label =
                          settings.labels === "short"
                            ? String(a?.asset_number).slice(-10)
                            : String(a?.asset_number),
                        y = 15 + i * 35;
                      return (
                        <Group key={"label" + o.id} listening={false}>
                          <Line
                            points={[
                              (o.x + o.width / 2) * scale,
                              (o.y + o.depth / 2) * scale,
                              w + 12,
                              y + 9,
                              w + 22,
                              y + 9,
                            ]}
                            stroke="#789687"
                            strokeWidth={0.8}
                          />
                          <Rect
                            x={w + 22}
                            y={y - 3}
                            width={186}
                            height={27}
                            fill="#ffffff"
                            stroke="#d6e2d5"
                            cornerRadius={3}
                          />
                          <Text
                            x={w + 28}
                            y={y + 4}
                            text={label}
                            fontFamily="Consolas"
                            fontSize={11}
                            fill="#355c48"
                          />
                        </Group>
                      );
                    })}
                  <Text
                    y={h + 14}
                    text={`${width} ม. × ${depth} ม. | ${visibleAssets.length} ครุภัณฑ์ที่แสดง`}
                    fontFamily="Tahoma"
                    fontSize={11}
                    fill="#738670"
                  />
                </Layer>
              </Stage>
            </div>
            <div className="canvas-bottom">
              <span>
                {visible.length} วัตถุที่แสดง / {objects.length} ทั้งหมด
              </span>
              <span>
                {published
                  ? `เผยแพร่ ${thaiDate(published)}`
                  : "ยังไม่มีฉบับเผยแพร่"}
              </span>
            </div>
          </div>
          <aside className="inspector">
            <div className="inspector-tabs">
              <strong>{current ? "คุณสมบัติวัตถุ" : "คุณสมบัติผัง"}</strong>
            </div>
            {current ? (
              <div className="inspector-section">
                <label>
                  ชื่อ
                  <input
                    disabled={!editable}
                    value={current.name}
                    onChange={(e) =>
                      patch(current.id, { name: e.target.value })
                    }
                  />
                </label>
                <div className="property-grid">
                  {(["x", "y", "width", "depth", "rotation", "z"] as const).map(
                    (k) => (
                      <label key={k}>
                        {
                          {
                            x: "X (ม.)",
                            y: "Y (ม.)",
                            width: "กว้าง (ม.)",
                            depth: "ลึก (ม.)",
                            rotation: "หมุน (°)",
                            z: "ลำดับภาพ",
                          }[k]
                        }
                        <input
                          type="number"
                          step={k === "z" ? 1 : 0.05}
                          disabled={!editable}
                          value={current[k]}
                          onChange={(e) =>
                            patch(current.id, { [k]: Number(e.target.value) })
                          }
                        />
                      </label>
                    ),
                  )}
                </div>
                <label>
                  สี
                  <input
                    type="color"
                    disabled={!editable}
                    value={current.color}
                    onChange={(e) =>
                      patch(current.id, { color: e.target.value })
                    }
                  />
                </label>
                {current.kind === "asset" && (
                  <label>
                    จุดย่อย / กลุ่ม
                    <select
                      disabled={!editable}
                      value={current.group_id || ""}
                      onChange={(e) =>
                        patch(current.id, {
                          group_id: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">ไม่จัดกลุ่ม</option>
                      {objects
                        .filter((o) => o.kind === "point")
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                {current.kind === "area" && (
                  <button
                    className="primary wide"
                    onClick={() => navigate(current.ref_id!)}
                  >
                    เปิดผังย่อย →
                  </button>
                )}
                {editable && (
                  <button
                    className="wide"
                    onClick={() => {
                      change(
                        objects
                          .filter((o) => o.id !== current.id)
                          .map((o) =>
                            o.group_id === current.id
                              ? { ...o, group_id: undefined }
                              : o,
                          ),
                      );
                      setSelected("");
                    }}
                  >
                    <Trash2 size={14} /> เอาออกจากผังเท่านั้น
                  </button>
                )}
                <p className="hint">นำออกจากผังไม่ลบทะเบียนหรือจุดพื้นที่</p>
              </div>
            ) : (
              <div className="inspector-section">
                <div className="property-grid">
                  <label>
                    กว้าง (ม.)
                    <input
                      type="number"
                      step=".1"
                      min=".1"
                      disabled={!editable}
                      value={width}
                      onChange={(e) => {
                        setWidth(Number(e.target.value));
                        setDirty(true);
                      }}
                    />
                  </label>
                  <label>
                    ลึก (ม.)
                    <input
                      type="number"
                      step=".1"
                      min=".1"
                      disabled={!editable}
                      value={depth}
                      onChange={(e) => {
                        setDepth(Number(e.target.value));
                        setDirty(true);
                      }}
                    />
                  </label>
                </div>
                <label>
                  ทิศทาง
                  <select
                    disabled={!editable}
                    value={orientation}
                    onChange={(e) => {
                      setOrientation(e.target.value as typeof orientation);
                      setDirty(true);
                    }}
                  >
                    <option value="landscape">แนวนอน</option>
                    <option value="portrait">แนวตั้ง</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={settings.bounds}
                    onChange={(e) => setting({ bounds: e.target.checked })}
                  />{" "}
                  จำกัดขอบเขตวัตถุ
                </label>
              </div>
            )}
            {editable && (
              <div className="inspector-section">
                <h3>เพิ่มในผัง</h3>
                <button
                  className="primary wide"
                  onClick={() => setCreate(areaId ? "assets" : "areas")}
                >
                  <Plus size={15} />{" "}
                  {areaId ? "สร้างทะเบียนใหม่" : "เพิ่มจุดพื้นที่ใหม่"}
                </button>
                <select
                  aria-label="รายการรอจัดวาง"
                  value=""
                  onChange={(e) => {
                    const ref = available.find((a) => a.id === e.target.value);
                    if (ref) add(areaId ? "asset" : "area", ref);
                  }}
                >
                  <option value="">รอจัดวาง ({available.length})</option>
                  {available.map((a) => (
                    <option key={a.id} value={a.id}>
                      {displayName(a)} {String(a.asset_number || "")}
                    </option>
                  ))}
                </select>
                <div className="structure-buttons">
                  {Object.entries(structures)
                    .filter(([k]) => areaId || k !== "point")
                    .map(([k, n]) => (
                      <button
                        key={k}
                        onClick={() => add(k as LayoutObject["kind"])}
                      >
                        {n}
                      </button>
                    ))}
                </div>
                {areaId && (
                  <>
                    <button
                      className="wide"
                      onClick={() => setCreate("fixtures")}
                    >
                      เพิ่มอุปกรณ์ไม่มีทะเบียน
                    </button>
                    <select
                      aria-label="อุปกรณ์ติดตั้งรอจัดวาง"
                      value=""
                      onChange={(e) => {
                        const f = data.fixtures.find(
                          (f) => f.id === e.target.value,
                        );
                        if (f) add("fixture", f);
                      }}
                    >
                      <option value="">อุปกรณ์ติดตั้งรอจัดวาง</option>
                      {data.fixtures
                        .filter(
                          (f) =>
                            f.area_id === areaId &&
                            !objects.some((o) => o.ref_id === f.id),
                        )
                        .map((f) => (
                          <option value={f.id} key={f.id}>
                            {displayName(f)}
                          </option>
                        ))}
                    </select>
                    <button className="wide" onClick={template}>
                      สร้างแม่แบบแถว / จุด
                    </button>
                  </>
                )}
              </div>
            )}
            <div className="inspector-section">
              <h3>การแสดงภาพ</h3>
              {areaId && (
                <>
                  <label>
                    มุมมองสำเร็จรูป
                    <select
                      value=""
                      onChange={(e) => {
                        const p = data.view_presets.find(
                          (p) => p.id === e.target.value,
                        );
                        if (p) {
                          filter({
                            ...emptyFilters,
                            ...(p.filters as Partial<Filters>),
                          });
                          setting({ labels: "full" });
                        }
                      }}
                    >
                      <option value="">เลือกมุมมอง</option>
                      {data.view_presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {displayName(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    ค้นหาเลขทะเบียน / รายการ
                    <input
                      value={filters.search}
                      onChange={(e) => {
                        filter({ search: e.target.value });
                        setting({ labels: "full" });
                      }}
                    />
                  </label>
                  <div className="category-checks">
                    {data.asset_categories.map((c) => (
                      <label className="check" key={c.id}>
                        <input
                          type="checkbox"
                          checked={filters.categories.includes(c.id)}
                          onChange={(e) => {
                            filter({
                              categories: e.target.checked
                                ? [...filters.categories, c.id]
                                : filters.categories.filter(
                                    (id) => id !== c.id,
                                  ),
                            });
                            setting({ labels: "full" });
                          }}
                        />
                        {displayName(c)}
                      </label>
                    ))}
                  </div>
                  <label>
                    สถานะ
                    <select
                      value={filters.status}
                      onChange={(e) => filter({ status: e.target.value })}
                    >
                      <option value="">ทุกสถานะ</option>
                      {["ใช้งาน", "ชำรุด", "ซ่อม", "รอตรวจสอบ", "จำหน่าย"].map(
                        (s) => (
                          <option key={s}>{s}</option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    ผู้รับผิดชอบ
                    <select
                      value={filters.custodian}
                      onChange={(e) => filter({ custodian: e.target.value })}
                    >
                      <option value="">ทุกคน</option>
                      {data.personnel.map((p) => (
                        <option key={p.id} value={p.id}>
                          {displayName(p)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label>
                แผนก
                <select
                  value={filters.department}
                  onChange={(e) => filter({ department: e.target.value })}
                >
                  <option value="">ทุกแผนก</option>
                  {data.organizational_departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {displayName(d)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                เลขทะเบียนบนผัง
                <select
                  value={settings.labels}
                  onChange={(e) =>
                    setting({ labels: e.target.value as Settings["labels"] })
                  }
                >
                  <option value="full">เลขเต็ม + เส้นเชื่อม</option>
                  <option value="short">เลขย่อ</option>
                  <option value="none">ซ่อนเลขทะเบียน</option>
                </select>
              </label>
              <button className="wide" onClick={() => filter(emptyFilters)}>
                ล้างตัวกรอง
              </button>
              {canEdit && (
                <button
                  className="wide"
                  onClick={async () => {
                    const name = prompt("ชื่อมุมมอง");
                    if (!name) return;
                    try {
                      await api("/entities/view_presets", "POST", {
                        name,
                        filters,
                      });
                      await reload();
                      notify("บันทึกมุมมองแล้ว");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  บันทึกมุมมองนี้
                </button>
              )}
            </div>
          </aside>
        </div>
        <div className="layout-notes">
          <span>
            {outOfBounds.length
              ? `${outOfBounds.length} วัตถุอยู่นอกขอบเขต`
              : "วัตถุอยู่ในขอบเขต"}
          </span>
          {overlapping.length > 0 && (
            <span className="warning">
              พบวัตถุทับกัน {overlapping.length} ชิ้น —
              อนุญาตเมื่อวางซ้อนตามเจตนา
            </span>
          )}
          <span>ซ่อนภาพไม่ลบข้อมูล • ลาก ปรับขนาด หมุน แล้วบันทึก</span>
        </div>
      </section>
      {create && (
        <EntityForm
          data={data}
          table={create}
          row={null}
          initial={{
            room_id: roomId,
            area_id: areaId,
            division_id:
              data.areas.find((a) => a.id === areaId)?.division_id ||
              data.division_room_links.find((l) => l.room_id === roomId)
                ?.division_id,
          }}
          close={() => setCreate(null)}
          onSaved={async () => {
            setCreate(null);
            await reload();
            notify("สร้างข้อมูลแล้ว เลือกในรายการรอจัดวางเพื่อนำลงผัง");
          }}
        />
      )}
    </>
  );
}
function Shape({
  object: o,
  scale,
  selected,
  editable,
  onSelect,
  onOpen,
  onChange,
  count,
}: {
  object: LayoutObject;
  scale: number;
  selected: boolean;
  editable: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onChange: (p: Partial<LayoutObject>) => void;
  count?: number;
}) {
  const ref = useRef<Konva.Group>(null),
    transform = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (selected && editable && ref.current && transform.current) {
      transform.current.nodes([ref.current]);
      transform.current.getLayer()?.batchDraw();
    }
  }, [selected, editable]);
  return (
    <>
      <Group
        ref={ref}
        _useStrictMode
        x={o.x * scale}
        y={o.y * scale}
        rotation={o.rotation}
        draggable={editable}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={onOpen}
        onDblTap={onOpen}
        onDragEnd={(e) =>
          onChange({ x: e.target.x() / scale, y: e.target.y() / scale })
        }
        onTransformEnd={() => {
          const node = ref.current!,
            values = {
              x: node.x() / scale,
              y: node.y() / scale,
              width: Math.max(0.05, o.width * node.scaleX()),
              depth: Math.max(0.05, o.depth * node.scaleY()),
              rotation: node.rotation(),
            };
          node.scaleX(1);
          node.scaleY(1);
          onChange(values);
        }}
      >
        <Rect
          width={o.width * scale}
          height={o.depth * scale}
          fill={o.color}
          stroke={
            selected ? "#277957" : o.kind === "point" ? "#bfccba" : "#90a797"
          }
          strokeWidth={selected ? 2 : 1}
          dash={o.kind === "point" ? [4, 3] : undefined}
          cornerRadius={o.kind === "wall" ? 0 : 3}
        />
        <Text
          text={o.name + (count !== undefined ? `\n${count} ครุภัณฑ์` : "")}
          x={5}
          y={Math.min(8, (o.depth * scale) / 4)}
          width={Math.max(10, o.width * scale - 10)}
          height={Math.max(8, o.depth * scale - 8)}
          fontFamily="Tahoma"
          fontSize={
            o.kind === "area"
              ? Math.max(8, Math.min(12, scale * 0.3))
              : Math.min(10, scale * 0.24)
          }
          fill="#345748"
          align="center"
          verticalAlign="middle"
          listening={false}
        />
      </Group>
      {selected && editable && (
        <Transformer
          ref={transform}
          rotateEnabled
          flipEnabled={false}
          ignoreStroke
          boundBoxFunc={(old, b) => (b.width < 5 || b.height < 5 ? old : b)}
        />
      )}
    </>
  );
}
