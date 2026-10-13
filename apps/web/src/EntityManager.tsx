import { useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ArrowRightLeft,
  Download,
  X,
} from "lucide-react";
import {
  api,
  entityNames,
  entityFields,
  fieldNames,
  references,
  displayName,
  textValue,
  csv,
  download,
  type Data,
  type RecordRow,
} from "./lib";
type Props = {
  data: Data;
  table: string;
  canEdit: boolean;
  includeSample: boolean;
  reload: () => Promise<void>;
  notify: (s: string) => void;
  initial?: Record<string, unknown>;
};
const optional = new Set([
  "department_id",
  "area_id",
  "custodian_id",
  "user_id",
  "parent_id",
  "purchase_date",
  "purchase_price",
]);
export function EntityManager({
  data,
  table,
  canEdit,
  includeSample,
  reload,
  notify,
  initial,
}: Props) {
  const [search, setSearch] = useState(""),
    [editing, setEditing] = useState<RecordRow | null | undefined>(undefined),
    [transfer, setTransfer] = useState<RecordRow | null>(null),
    [person, setPerson] = useState<RecordRow | null>(null);
  const rows = (data[table] || []).filter(
    (r) =>
      (includeSample || !r.is_sample) &&
      (!search ||
        Object.values(r).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase()),
        ) ||
        entityFields[table]?.some((k) =>
          textValue(data, r, k).includes(search),
        )),
  );
  const fields = entityFields[table] || [];
  const columns =
    table === "assets"
      ? [
          "asset_number",
          "name",
          "category_id",
          "area_id",
          "custodian_id",
          "status",
        ]
      : table === "personnel"
        ? ["rank", "first_name", "last_name", "department_id", "position_title"]
        : fields
            .filter(
              (k) =>
                ![
                  "description",
                  "icon",
                  "default_width",
                  "default_depth",
                ].includes(k),
            )
            .slice(0, 5);
  async function remove(row: RecordRow) {
    if (
      !confirm(
        `ยืนยันลบ ${displayName(row)}? รายการที่มีความเชื่อมโยงจะถูกบล็อก`,
      )
    )
      return;
    try {
      await api(`/entities/${table}/${row.id}`, "DELETE");
      await reload();
      notify("ลบรายการแล้ว");
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{entityNames[table]}</h2>
          <p>
            {rows.length.toLocaleString("th-TH")} รายการ • บันทึกลงฐานข้อมูลจริง
          </p>
        </div>
        <div className="actions">
          {canEdit && table === "assets" && (
            <label className="button">
              นำเข้า CSV
              <input
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  try {
                    const result = await api<{ count: number }>(
                      "/import/assets",
                      "POST",
                      { csv: await file.text() },
                    );
                    await reload();
                    notify(`นำเข้า ${result.count} รายการแล้ว`);
                  } catch (error) {
                    notify((error as Error).message);
                  }
                }}
              />
            </label>
          )}
          {canEdit && table === "assets" && (
            <button
              onClick={() =>
                download(
                  "asset-import-template.csv",
                  "\ufeffasset_number,name,category_id,division_id,area_id,custodian_id,is_sample\r\n7100.0001.001.023.01,คอมพิวเตอร์ตัวอย่าง,cat-1,division-1,area-1,P001,true\r\n",
                )
              }
            >
              แม่แบบ CSV
            </button>
          )}
          <button
            onClick={() =>
              download(
                `${table}.csv`,
                csv(rows, ["id", ...fields, "is_sample"]),
              )
            }
          >
            <Download size={16} /> CSV
          </button>
          {canEdit && (
            <button className="primary" onClick={() => setEditing(null)}>
              <Plus size={16} /> เพิ่ม{entityNames[table]}
            </button>
          )}
        </div>
      </div>
      <div className="search">
        <Search size={18} />
        <input
          aria-label="ค้นหารายการ"
          placeholder="ค้นหาชื่อ เลขทะเบียน สังกัด หรือผู้รับผิดชอบ…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((k) => (
                <th key={k}>{fieldNames[k] || k}</th>
              ))}
              <th>ข้อมูล</th>
              <th>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((k) => (
                  <td key={k} className={k === "asset_number" ? "mono" : ""}>
                    {k === "status" ? (
                      <span
                        className={`badge ${row.status === "ใช้งาน" ? "green" : "amber"}`}
                      >
                        {textValue(data, row, k)}
                      </span>
                    ) : (
                      textValue(data, row, k)
                    )}
                  </td>
                ))}
                <td>
                  {row.is_sample ? (
                    <span className="badge amber">SAMPLE</span>
                  ) : (
                    <span className="badge">ข้อมูลจริง</span>
                  )}
                </td>
                <td>
                  <div className="actions">
                    {canEdit && (
                      <>
                        <button
                          title="แก้ไข"
                          aria-label={`แก้ไข ${displayName(row)}`}
                          onClick={() => setEditing(row)}
                        >
                          <Pencil size={15} />
                        </button>
                        {table === "assets" ? (
                          <button
                            title="โอนครุภัณฑ์"
                            onClick={() => setTransfer(row)}
                          >
                            <ArrowRightLeft size={15} />
                          </button>
                        ) : (
                          <button title="ลบ" onClick={() => void remove(row)}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                    {table === "personnel" && (
                      <button className="muted" onClick={() => setPerson(row)}>
                        {
                          (data.assets || []).filter(
                            (a) =>
                              a.custodian_id === row.id &&
                              (includeSample || !a.is_sample),
                          ).length
                        }{" "}
                        ชิ้น
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="empty">ยังไม่มีรายการในตัวกรองนี้</div>
        )}
      </div>
      {editing !== undefined && (
        <EntityForm
          key={editing?.id || "new"}
          data={data}
          table={table}
          row={editing}
          initial={initial}
          close={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await reload();
            notify("บันทึกข้อมูลเรียบร้อย");
          }}
        />
      )}
      {person && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="panel-head">
              <h2>ครุภัณฑ์ของ {displayName(person)}</h2>
              <button onClick={() => setPerson(null)} aria-label="ปิด">
                <X size={18} />
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>เลขทะเบียน</th>
                  <th>รายการ</th>
                  <th>พื้นที่</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {data.assets
                  .filter(
                    (a) =>
                      a.custodian_id === person.id &&
                      (includeSample || !a.is_sample),
                  )
                  .map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{String(a.asset_number)}</td>
                      <td>{displayName(a)}</td>
                      <td>{textValue(data, a, "area_id")}</td>
                      <td>{String(a.status)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {transfer && (
        <TransferForm
          data={data}
          asset={transfer}
          close={() => setTransfer(null)}
          onSaved={async () => {
            setTransfer(null);
            await reload();
            notify("โอนครุภัณฑ์และบันทึกประวัติแล้ว");
          }}
        />
      )}
    </section>
  );
}
export function EntityForm({
  data,
  table,
  row,
  initial,
  close,
  onSaved,
}: {
  data: Data;
  table: string;
  row: RecordRow | null;
  initial?: Record<string, unknown>;
  close: () => void;
  onSaved: () => Promise<void>;
}) {
  const fields = entityFields[table];
  const [values, setValues] = useState<Record<string, unknown>>(() => {
      const v: Record<string, unknown> = { is_sample: row?.is_sample ?? false };
      for (const k of fields) {
        v[k] =
          row?.[k] ??
          initial?.[k] ??
          (k === "active"
            ? true
            : k === "status"
              ? "ใช้งาน"
              : k === "verification"
                ? "sample-unverified"
                : k === "kind"
                  ? "custom"
                  : k === "width"
                    ? 4
                    : k === "depth"
                      ? 3
                      : k === "default_width"
                        ? 0.8
                        : k === "default_depth"
                          ? 0.6
                          : optional.has(k)
                            ? null
                            : references[k]
                              ? data[references[k]]?.[0]?.id || ""
                              : "");
      }
      for (const key of [
        "width",
        "depth",
        "default_width",
        "default_depth",
        "purchase_price",
      ])
        if (v[key] != null && v[key] !== "") v[key] = Number(v[key]);
      if (v.purchase_date)
        v.purchase_date = String(v.purchase_date).slice(0, 10);
      return v;
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) =>
    setValues((old) => ({
      ...old,
      [k]: v,
      ...(k === "division_id" ? { department_id: null } : {}),
    }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        [
          ...fields,
          ...(["asset_categories", "division_room_links"].includes(table)
            ? []
            : ["is_sample"]),
        ].map((k) => [k, values[k]]),
      );
      await api(
        `/entities/${table}${row ? "/" + row.id : ""}`,
        row ? "PUT" : "POST",
        payload,
      );
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <form className="modal" onSubmit={(e) => void submit(e)}>
        <div className="panel-head">
          <h2>
            {row ? "แก้ไข" : "เพิ่ม"}
            {entityNames[table]}
          </h2>
          <button type="button" aria-label="ปิด" onClick={close}>
            <X size={18} />
          </button>
        </div>
        <div className="form-grid">
          {fields.map((k) => {
            const ref = references[k],
              disabled =
                !!row &&
                table === "assets" &&
                ["asset_number", "area_id", "custodian_id"].includes(k);
            let options = ref ? data[ref] || [] : [];
            if (k === "department_id")
              options = options.filter(
                (r) => r.division_id === values.division_id,
              );
            if (k === "parent_id")
              options = options.filter((r) => r.id !== row?.id);
            return (
              <label key={k}>
                {fieldNames[k]}
                {ref ? (
                  <select
                    disabled={disabled}
                    value={String(values[k] ?? "")}
                    required={!optional.has(k)}
                    onChange={(e) => set(k, e.target.value || null)}
                  >
                    {optional.has(k) && <option value="">ไม่ระบุ</option>}
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {displayName(o)}
                      </option>
                    ))}
                  </select>
                ) : ["active"].includes(k) ? (
                  <input
                    type="checkbox"
                    checked={Boolean(values[k])}
                    onChange={(e) => set(k, e.target.checked)}
                  />
                ) : ["status", "verification"].includes(k) ? (
                  <select
                    value={String(values[k])}
                    onChange={(e) => set(k, e.target.value)}
                  >
                    {(k === "status"
                      ? ["ใช้งาน", "ชำรุด", "ซ่อม", "รอตรวจสอบ", "จำหน่าย"]
                      : ["sample-unverified", "confirmed"]
                    ).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled={disabled}
                    required={[
                      "name",
                      "first_name",
                      "last_name",
                      "asset_number",
                      "code",
                      "fixture_code",
                    ].includes(k)}
                    type={
                      [
                        "width",
                        "depth",
                        "default_width",
                        "default_depth",
                        "purchase_price",
                      ].includes(k)
                        ? "number"
                        : k === "purchase_date"
                          ? "date"
                          : "text"
                    }
                    step="any"
                    value={String(values[k] ?? "")}
                    onChange={(e) =>
                      set(
                        k,
                        e.target.type === "number"
                          ? e.target.value
                            ? Number(e.target.value)
                            : null
                          : e.target.value || (optional.has(k) ? null : ""),
                      )
                    }
                  />
                )}
                {disabled && (
                  <small>เลขทะเบียนคงเดิม / ใช้ปุ่มโอนเพื่อย้าย</small>
                )}
              </label>
            );
          })}
        </div>
        {!["asset_categories", "division_room_links"].includes(table) && (
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(values.is_sample)}
              onChange={(e) => set("is_sample", e.target.checked)}
            />{" "}
            เป็นข้อมูลตัวอย่าง SAMPLE
          </label>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" onClick={close}>
            ยกเลิก
          </button>
          <button disabled={busy} className="primary">
            {busy ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </button>
        </div>
      </form>
    </div>
  );
}
function TransferForm({
  data,
  asset,
  close,
  onSaved,
}: {
  data: Data;
  asset: RecordRow;
  close: () => void;
  onSaved: () => Promise<void>;
}) {
  const [area, setArea] = useState(String(asset.area_id || "")),
    [person, setPerson] = useState(String(asset.custodian_id || "")),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop">
      <form
        className="modal small"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api(`/assets/${asset.id}/transfer`, "POST", {
              area_id: area || null,
              custodian_id: person || null,
              reason,
              version: asset.version,
            });
            await onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>โอนครุภัณฑ์</h2>
        <p className="mono">{String(asset.asset_number)}</p>
        <label>
          พื้นที่ปลายทาง
          <select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">รอจัดสรรพื้นที่</option>
            {data.areas.map((r) => (
              <option value={r.id} key={r.id}>
                {displayName(r)}
              </option>
            ))}
          </select>
        </label>
        <label>
          ผู้รับผิดชอบใหม่
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">ไม่ระบุ</option>
            {data.personnel
              .filter((p) => p.active)
              .map((r) => (
                <option value={r.id} key={r.id}>
                  {displayName(r)}
                </option>
              ))}
          </select>
        </label>
        <label>
          เหตุผล
          <textarea
            required
            minLength={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="modal-footer">
          <button type="button" onClick={close}>
            ยกเลิก
          </button>
          <button className="primary" disabled={busy}>
            ยืนยันการโอน
          </button>
        </div>
      </form>
    </div>
  );
}
