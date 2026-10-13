import { useEffect, useState } from "react";
import { api, csv, download, type RecordRow } from "./lib";

type ImportedRow = RecordRow & {
  original_data: Record<string, string | number>;
  source_code: string;
  status: string;
  issue: string;
  registered_code: string | null;
};
export function SourceImports({
  admin,
  reload,
  notify,
}: {
  admin: boolean;
  reload: () => Promise<void>;
  notify: (message: string) => void;
}) {
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ImportedRow | null>(null);
  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  async function load() {
    try {
      setRows(await api<ImportedRow[]>("/import/source"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (!rows.length && !error) return null;
  const pending = rows.filter((r) => r.status === "pending").length;
  const visible = rows.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      (!search ||
        JSON.stringify(r.original_data).includes(search) ||
        r.registered_code?.includes(search)),
  );
  return (
    <section className="panel" style={{ marginTop: 20 }}>
      <div className="panel-head">
        <div>
          <h2>ข้อมูลครุภัณฑ์จากไฟล์ต้นฉบับ</h2>
          <p>
            ต้นฉบับ {rows.length} แถว · เข้าทะเบียนแล้ว {rows.length - pending}{" "}
            · รอตรวจสอบรหัส {pending}
          </p>
        </div>
        <div className="actions">
          <button onClick={() => void load()}>โหลดผลนำเข้าใหม่</button>
          <button
            onClick={() =>
              download(
                "source-import-review.csv",
                csv(
                  visible.map((r) => ({
                    id: r.id,
                    ...r.original_data,
                    registered_code: r.registered_code || "",
                    import_status: r.status,
                    issue: r.issue,
                  })),
                  [
                    "row_number",
                    "sequence",
                    "image",
                    "room",
                    "category",
                    "asset_number",
                    "brand",
                    "model",
                    "location",
                    "notes",
                    "transcription_status",
                    "registered_code",
                    "import_status",
                    "issue",
                  ],
                ),
              )
            }
          >
            ส่งออกข้อมูลต้นฉบับ CSV
          </button>
        </div>
      </div>
      <p>
        รายการถอดจากภาพต้องตรวจสอบกับต้นฉบับ
        ชื่อห้องและสถานที่ในตารางนี้ยังไม่ใช่ตำแหน่งที่ยืนยันในผัง
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        <label>
          ผลนำเข้า{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">ทั้งหมด</option>
            <option value="pending">รอตรวจสอบรหัส</option>
            <option value="imported">เข้าทะเบียนแล้ว</option>
          </select>
        </label>
        <input
          aria-label="ค้นหาในไฟล์ต้นฉบับ"
          placeholder="ค้นหารหัส ประเภท ห้อง หรือสถานที่"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div
        className="table-scroll"
        style={{ maxHeight: 520, overflow: "auto" }}
      >
        <table>
          <thead>
            <tr>
              {[
                "ลำดับ / แถว Excel",
                "ภาพต้นฉบับ",
                "ห้องที่",
                "ประเภทครุภัณฑ์",
                "รหัสต้นฉบับ",
                "ยี่ห้อ",
                "ชนิด/แบบ",
                "ใช้ประจำ / สถานที่",
                "หมายเหตุ / หน่วยรับผิดชอบ",
                "ผลนำเข้า",
              ].map((s) => (
                <th key={s}>{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.original_data.sequence} / {String(r.row_number)}
                </td>
                <td>{r.original_data.image}</td>
                <td>{r.original_data.room}</td>
                <td>{r.original_data.category}</td>
                <td className="mono">
                  {r.source_code}
                  {r.registered_code && r.registered_code !== r.source_code && (
                    <p>ยืนยันเป็น {r.registered_code}</p>
                  )}
                </td>
                <td>{r.original_data.brand || "—"}</td>
                <td>{r.original_data.model || "—"}</td>
                <td>{r.original_data.location}</td>
                <td>{r.original_data.notes || "—"}</td>
                <td>
                  <span
                    className={`badge ${r.status === "pending" ? "amber" : "green"}`}
                  >
                    {r.status === "pending"
                      ? "รอตรวจสอบรหัส"
                      : "เข้าทะเบียนแล้ว"}
                  </span>
                  <p>{r.issue}</p>
                  {admin && r.status === "pending" && (
                    <button
                      onClick={() => {
                        setEditing(r);
                        setCode(r.source_code);
                        setReason("");
                      }}
                    >
                      ยืนยันรหัสจากต้นฉบับ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="modal-backdrop">
          <form
            className="modal small"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await api(`/import/source/${editing.id}/resolve`, "POST", {
                  asset_number: code,
                  reason,
                });
                await load();
                await reload();
                setEditing(null);
                notify(
                  "เพิ่มเข้าทะเบียนแล้ว โดยเก็บรหัสต้นฉบับและเหตุผลการแก้ไขไว้",
                );
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            <h2>ตรวจสอบรหัส แถว {String(editing.row_number)}</h2>
            <p>
              รหัสต้นฉบับ: {editing.source_code} ·{" "}
              {editing.original_data.category}
            </p>
            <label>
              รหัสที่ตรวจสอบกับต้นฉบับแล้ว
              <input
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <label>
              เหตุผลและหลักฐานการยืนยัน
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="actions">
              <button
                type="button"
                disabled={saving}
                onClick={() => setEditing(null)}
              >
                ยกเลิก
              </button>
              <button className="primary" disabled={saving}>
                ยืนยันและเพิ่มเข้าทะเบียน
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
