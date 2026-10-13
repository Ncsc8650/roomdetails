import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Map,
  Box,
  Users,
  Network,
  History,
  Settings,
  LogOut,
  ArrowUpRight,
  Layers,
  Menu,
  Link,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import {
  api,
  type Data,
  type User,
  type RecordRow,
  displayName,
  entityNames,
  thaiDate,
  download,
  csv,
} from "./lib";
import { EntityManager } from "./EntityManager";
import { mayNavigate } from "./lib";
import { LayoutEditor } from "./LayoutEditor";
import type { LayoutObject } from "../../../packages/shared/model";
import { externalUrl } from "../../../packages/shared/model";
const nav = [
  ["dashboard", "ภาพรวม", LayoutDashboard],
  ["master", "ผังพื้นที่", Map],
  ["assets", "ทะเบียนครุภัณฑ์", Box],
  ["personnel", "บุคลากร", Users],
  ["organization", "โครงสร้างองค์กร", Network],
  ["asset_categories", "ประเภทครุภัณฑ์", Layers],
  ["history", "การโอนและประวัติ", History],
  ["settings", "ตั้งค่าและสิทธิ์", Settings],
] as const;
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [data, setData] = useState<Data | null>(null),
    [page, setPageRaw] = useState("dashboard"),
    [message, setMessage] = useState(""),
    [sample, setSample] = useState(false),
    [menu, setMenu] = useState(false),
    [org, setOrg] = useState("agencies");
  const notify = (s: string) => setMessage(s);
  const setPage = (s: string) => {
    if (mayNavigate()) setPageRaw(s);
  };
  async function reload() {
    setData(await api<Data>("/data"));
  }
  useEffect(() => {
    void api<User>("/me")
      .then((u) => {
        setUser(u);
        setSample(u.is_demo);
        return reload();
      })
      .catch(() => {});
  }, []);
  if (/Line\//i.test(navigator.userAgent))
    return (
      <div className="login">
        <div className="login-card">
          <h1>เปิดในเบราว์เซอร์ของเครื่อง</h1>
          <p>
            ระบบนี้ไม่เปิดใช้งานภายใน LINE กรุณากดปุ่มด้านล่าง หรือเมนู ⋯
            แล้วเลือก “เปิดในเบราว์เซอร์อื่น”
          </p>
          <a className="button primary" href={externalUrl(location.href)}>
            เปิดด้วยเบราว์เซอร์ภายนอก
          </a>
          <button
            onClick={() =>
              void navigator.clipboard
                .writeText(externalUrl(location.href))
                .then(() => notify("คัดลอกลิงก์แล้ว"))
                .catch(() => notify("กรุณาคัดลอก URL จากแถบที่อยู่"))
            }
          >
            คัดลอกลิงก์
          </button>
          <p>{message}</p>
        </div>
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={async (u) => {
          setUser(u);
          setSample(u.is_demo);
          await reload();
        }}
      />
    );
  const canEdit = ["admin", "editor"].includes(user.role);
  if (!data)
    return (
      <div className="loading">
        กำลังอ่านฐานข้อมูล…{" "}
        <button onClick={() => void reload().catch((e) => notify(e.message))}>
          ลองอีกครั้ง
        </button>
        {message}
      </div>
    );
  return (
    <div className="app">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a className="brand" onClick={() => setPage("dashboard")}>
          <div className="brand-icon">
            <Box size={26} />
          </div>
          <span>
            ASSET<span>COMMAND CENTER</span>
          </span>
        </a>
        <div className="workspace-label">พื้นที่ปฏิบัติงาน</div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => {
                setPage(id);
                setMenu(false);
              }}
            >
              <Icon size={19} />
              {label}
              {id === "assets" && (
                <small>
                  {data.assets.filter((a) => sample || !a.is_sample).length}
                </small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="online-dot" /> เชื่อมต่อฐานข้อมูล
          <div className="user">
            <div className="avatar">
              {user.username.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <strong>{user.username}</strong>
              <small>
                {user.role}
                {user.is_demo ? " • ดู SAMPLE เท่านั้น" : ""}
              </small>
            </div>
            <button
              title="ออกจากระบบ"
              onClick={() =>
                void api("/logout", "POST").then(() => {
                  setUser(null);
                  setData(null);
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="เปิดหรือปิดเมนู"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <span>
            กกมง.กง.กห. <span className="muted">/ ศูนย์บริหารครุภัณฑ์</span>
          </span>
          <div className="actions">
            <span className="date">
              {new Date().toLocaleDateString("th-TH", {
                timeZone: "Asia/Bangkok",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <button
              title="คัดลอกลิงก์สำหรับส่ง LINE"
              onClick={() =>
                void navigator.clipboard
                  .writeText(externalUrl(location.href))
                  .then(() => notify("คัดลอกลิงก์เปิดภายนอก LINE แล้ว"))
                  .catch(() => notify(externalUrl(location.href)))
              }
            >
              <Link size={17} />
            </button>
            <button
              title="โหลดข้อมูลใหม่"
              onClick={() => void reload().catch((e) => notify(e.message))}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">ASSET COMMAND CENTER</div>
              <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
              <p>บริหารพื้นที่ ดูแลทรัพย์สิน เชื่อมโยงทุกความรับผิดชอบ</p>
            </div>
            <label className="sample-toggle">
              <input
                type="checkbox"
                checked={sample}
                onChange={(e) => {
                  if (mayNavigate()) setSample(e.target.checked);
                }}
              />{" "}
              รวมข้อมูล SAMPLE
            </label>
          </div>
          {sample && (
            <div className="sample-banner">
              <ShieldCheck size={17} />
              <span>
                เปิดข้อมูลตัวอย่าง •
                ชื่อบุคลากรและเลขทะเบียนทั้งหมดในชุดตั้งต้นเป็น SAMPLE •
                กรมต้นสังกัดยังไม่ยืนยัน
              </span>
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
              <button onClick={() => setMessage("")}>ปิด</button>
            </div>
          )}
          {page === "dashboard" && (
            <Dashboard data={data} sample={sample} navigate={setPage} />
          )}
          {["assets", "personnel", "asset_categories"].includes(page) && (
            <EntityManager
              key={page}
              table={page}
              data={data}
              canEdit={canEdit}
              includeSample={sample}
              reload={reload}
              notify={notify}
            />
          )}
          {page === "organization" && (
            <>
              <div className="tabs">
                {[
                  "agencies",
                  "buildings",
                  "floors",
                  "divisions",
                  "rooms",
                  "division_room_links",
                  "organizational_departments",
                  "areas",
                  "fixtures",
                ].map((t) => (
                  <button
                    className={org === t ? "selected" : ""}
                    key={t}
                    onClick={() => setOrg(t)}
                  >
                    {entityNames[t]}
                  </button>
                ))}
              </div>
              <EntityManager
                key={org}
                table={org}
                data={data}
                canEdit={canEdit}
                includeSample={sample}
                reload={reload}
                notify={notify}
              />
            </>
          )}
          {page === "master" && (
            <LocationExplorer data={data} includeSample={sample}>
              {(roomId, areaId, openArea) => (
                <LayoutEditor
                  data={data}
                  roomId={roomId}
                  areaId={areaId}
                  openArea={openArea}
                  canEdit={canEdit}
                  includeSample={sample}
                  reload={reload}
                  notify={notify}
                />
              )}
            </LocationExplorer>
          )}
          {page === "history" && (
            <HistoryPage data={data} user={user} includeSample={sample} />
          )}
          {page === "settings" && <SettingsPage user={user} notify={notify} />}
        </div>
        <footer>
          Asset Command Center{" "}
          <span>เวลา Asia/Bangkok • ข้อมูลบันทึกผ่าน API</span>
        </footer>
      </main>
    </div>
  );
}
function Login({ onLogin }: { onLogin: (u: User) => Promise<void> }) {
  const [username, setUsername] = useState("admin"),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(demo = false) {
    setBusy(true);
    setError("");
    try {
      await onLogin(
        await api<User>(
          demo ? "/demo" : "/login",
          "POST",
          demo ? undefined : { username, password },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <div className="login-intro">
        <div className="eyebrow">ASSET COMMAND CENTER</div>
        <h1>
          ทุกพื้นที่
          <br />
          ทุกครุภัณฑ์
          <br />
          <span>ดูแลได้ในที่เดียว</span>
        </h1>
        <p>
          ระบบบริหารพื้นที่และทะเบียนครุภัณฑ์
          <br />
          กองกรรมวิธีข้อมูลทางการเงิน
        </p>
        <div className="login-grid">
          <Box size={76} />
          <Map size={76} />
          <Users size={76} />
        </div>
      </div>
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          void login();
        }}
      >
        <div className="brand-icon">
          <Box size={28} />
        </div>
        <h2>ยินดีต้อนรับ</h2>
        <p>เข้าสู่ระบบเพื่อจัดการพื้นที่และครุภัณฑ์</p>
        <label>
          ชื่อผู้ใช้
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          รหัสผ่าน
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <button disabled={busy} className="primary">
          {busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}{" "}
          <ArrowUpRight size={17} />
        </button>
        <button type="button" disabled={busy} onClick={() => void login(true)}>
          ดูข้อมูลตัวอย่าง (อ่านอย่างเดียว)
        </button>
        <small>บัญชีผู้ดูแลตั้งค่าใน .env ตามคู่มือ Windows 11</small>
      </form>
    </div>
  );
}
function Dashboard({
  data,
  sample,
  navigate,
}: {
  data: Data;
  sample: boolean;
  navigate: (s: string) => void;
}) {
  const assets = data.assets.filter((a) => sample || !a.is_sample),
    people = data.personnel.filter((p) => sample || !p.is_sample),
    areas = data.areas.filter((a) => sample || !a.is_sample);
  const preview = data.layouts.find(
    (l) =>
      l.room_id &&
      data.rooms.some((r) => r.id === l.room_id && (sample || !r.is_sample)),
  );
  const previewObjects = (preview?.objects || []) as LayoutObject[];
  const stats = [
    ["ครุภัณฑ์ทั้งหมด", assets.length, "ทะเบียนที่อยู่ในการดูแล", Box],
    ["บุคลากร", people.length, "ผู้รับผิดชอบในระบบ", Users],
    ["พื้นที่ทั้งหมด", areas.length, "จุดพื้นที่และแผนก", Map],
    [
      "พร้อมใช้งาน",
      assets.filter((a) => a.status === "ใช้งาน").length,
      "รายการสถานะใช้งาน",
      ShieldCheck,
    ],
  ] as const;
  return (
    <>
      <div className="stats">
        {stats.map(([name, value, note, Icon]) => (
          <article className="stat" key={name}>
            <div>
              <span>{name}</span>
              <Icon size={19} />
            </div>
            <strong>
              {value.toLocaleString("th-TH")}
              <small>
                {name === "บุคลากร"
                  ? "คน"
                  : name === "พื้นที่ทั้งหมด"
                    ? "จุด"
                    : "ชิ้น"}
              </small>
            </strong>
            <p>{note}</p>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>ภาพรวมพื้นที่</h2>
              <p>
                {preview
                  ? `${data.rooms.find((r) => r.id === preview.room_id)?.name} · ${preview.width} × ${preview.depth} เมตร`
                  : "ยังไม่มีผังในตัวกรองนี้"}
              </p>
            </div>
            <button onClick={() => navigate("master")}>
              เปิดผัง <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="mini-map">
            <div className="map-label">ตำแหน่งล่าสุดจากฐานข้อมูล</div>
            {preview ? (
              <>
                <svg
                  role="img"
                  aria-label="ภาพรวมผังที่บันทึก"
                  viewBox={`-.2 -.2 ${Number(preview.width) + 0.4} ${Number(preview.depth) + 0.4}`}
                  style={{ width: "100%", maxHeight: 330 }}
                >
                  <rect
                    width={Number(preview.width)}
                    height={Number(preview.depth)}
                    fill="#f9fbf7"
                    stroke="#b0c1a8"
                    strokeWidth={0.05}
                  />
                  {previewObjects
                    .filter(
                      (o) =>
                        o.kind !== "area" ||
                        areas.some((a) => a.id === o.ref_id),
                    )
                    .map((o) => (
                      <g
                        key={o.id}
                        transform={`translate(${o.x} ${o.y}) rotate(${o.rotation})`}
                      >
                        <title>{o.name}</title>
                        <rect
                          width={o.width}
                          height={o.depth}
                          rx={0.07}
                          fill={o.color}
                          stroke="#9fb79d"
                          strokeWidth={0.03}
                        />
                        {o.kind === "area" && (
                          <>
                            <text
                              x={o.width / 2}
                              y={o.depth / 2}
                              textAnchor="middle"
                              fontSize={0.24}
                              fill="#466544"
                            >
                              {o.name.replace("แผนก", "")}
                            </text>
                            <text
                              x={o.width / 2}
                              y={o.depth / 2 + 0.45}
                              textAnchor="middle"
                              fontSize={0.21}
                              fill="#7b9275"
                            >
                              {
                                assets.filter((a) => a.area_id === o.ref_id)
                                  .length
                              }{" "}
                              ครุภัณฑ์
                            </text>
                          </>
                        )}
                      </g>
                    ))}
                </svg>
                <p className="map-note">
                  รอจัดวาง:{" "}
                  {areas
                    .filter(
                      (a) =>
                        a.room_id === preview.room_id &&
                        !previewObjects.some((o) => o.ref_id === a.id),
                    )
                    .map(displayName)
                    .join(", ") || "ไม่มี"}
                </p>
              </>
            ) : (
              <div className="empty">
                เปิด “รวมข้อมูล SAMPLE” เพื่อดูผังตั้งต้น หรือเพิ่มพื้นที่จริง
              </div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>ครุภัณฑ์ตามประเภท</h2>
              <p>นับจากทะเบียนในตัวกรองปัจจุบัน</p>
            </div>
          </div>
          <div className="bars">
            {data.asset_categories
              .filter((c) => assets.some((a) => a.category_id === c.id))
              .map((c, i) => {
                const count = assets.filter(
                  (a) => a.category_id === c.id,
                ).length;
                return (
                  <div className="bar-row" key={c.id}>
                    <div>
                      <span>{displayName(c)}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="bar-track">
                      <i
                        style={{
                          width: `${(count / Math.max(1, assets.length)) * 100}%`,
                          background: i % 2 ? "#a5baaa" : "#407968",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            {!assets.length && <div className="empty">ยังไม่มีทะเบียนจริง</div>}
          </div>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>ทะเบียนล่าสุด</h2>
            <button onClick={() => navigate("assets")}>
              ดูทั้งหมด <ArrowUpRight size={17} />
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>เลขทะเบียน</th>
                  <th>รายการ</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {assets
                  .slice(-5)
                  .reverse()
                  .map((a) => (
                    <tr key={a.id}>
                      <td className="mono">{String(a.asset_number)}</td>
                      <td>
                        {displayName(a)}{" "}
                        {Boolean(a.is_sample) && (
                          <small className="sample-text">SAMPLE</small>
                        )}
                      </td>
                      <td>
                        <span className="badge green">{String(a.status)}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!assets.length && (
              <div className="empty">ยังไม่มีข้อมูลในตัวกรองนี้</div>
            )}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>การกระจายตามผู้ดูแล</h2>
          </div>
          <div className="custodians">
            {people
              .filter((p) => assets.some((a) => a.custodian_id === p.id))
              .slice(0, 5)
              .map((p) => (
                <div key={p.id}>
                  <div className="avatar">
                    {String(p.first_name).slice(0, 1)}
                  </div>
                  <span>
                    {displayName(p)}
                    <small>{String(p.position_title)}</small>
                  </span>
                  <strong>
                    {assets.filter((a) => a.custodian_id === p.id).length}{" "}
                    <small>ชิ้น</small>
                  </strong>
                </div>
              ))}
            {!people.length && (
              <div className="empty">ยังไม่มีผู้รับผิดชอบ</div>
            )}
          </div>
        </section>
      </div>
      <div className="dashboard-grid">
        {[
          {
            title: "สถานะการใช้งาน",
            groups: ["ใช้งาน", "ชำรุด", "ซ่อม", "รอตรวจสอบ", "จำหน่าย"].map(
              (s) => ({ id: s, name: s }),
            ),
            field: "status",
          },
          {
            title: "ครุภัณฑ์ตามแผนก",
            groups: data.organizational_departments.map((d) => ({
              id: d.id,
              name: displayName(d),
            })),
            field: "department_id",
          },
        ].map((chart) => (
          <section className="panel" key={chart.title}>
            <div className="panel-head">
              <h2>{chart.title}</h2>
            </div>
            <div className="bars">
              {chart.groups.map((g) => {
                const count = assets.filter(
                  (a) => a[chart.field] === g.id,
                ).length;
                return (
                  <div className="bar-row" key={g.id}>
                    <div>
                      <span>{g.name}</span>
                      <strong>{count}</strong>
                    </div>
                    <div className="bar-track">
                      <i
                        style={{
                          width: `${(count / Math.max(1, assets.length)) * 100}%`,
                          background: "#71967a",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <div className="org-summary">
        {["agencies", "buildings", "floors", "divisions"].map((k) => (
          <span key={k}>
            {entityNames[k]}{" "}
            <strong>
              {data[k].filter((r) => sample || !r.is_sample).length}
            </strong>
          </span>
        ))}
      </div>
    </>
  );
}
export function LocationExplorer({
  data,
  includeSample,
  children,
}: {
  data: Data;
  includeSample: boolean;
  children?: (
    room: string,
    area: string,
    setArea: (v: string) => void,
  ) => React.ReactNode;
}) {
  const [agency, setAgency] = useState(""),
    [building, setBuilding] = useState(""),
    [floor, setFloor] = useState(""),
    [division, setDivision] = useState(""),
    [room, setRoom] = useState(""),
    [area, setArea] = useState("");
  const agencies = data.agencies.filter((r) => includeSample || !r.is_sample);
  const a = agency || agencies[0]?.id || "",
    buildings = data.buildings.filter(
      (r) => r.agency_id === a && (includeSample || !r.is_sample),
    ),
    b = building || buildings[0]?.id || "",
    floors = data.floors.filter(
      (r) => r.building_id === b && (includeSample || !r.is_sample),
    ),
    f = floor || floors[0]?.id || "",
    divisions = data.divisions.filter(
      (r) => r.agency_id === a && (includeSample || !r.is_sample),
    ),
    d = division || divisions[0]?.id || "",
    rooms = data.rooms.filter(
      (r) =>
        r.floor_id === f &&
        (includeSample || !r.is_sample) &&
        data.division_room_links.some(
          (l) => l.division_id === d && l.room_id === r.id,
        ),
    ),
    r = room || rooms[0]?.id || "",
    areas = data.areas.filter(
      (x) =>
        x.room_id === r &&
        x.division_id === d &&
        (includeSample || !x.is_sample),
    );
  const select = (
    label: string,
    rows: RecordRow[],
    value: string,
    onChange: (s: string) => void,
  ) => (
    <label>
      {label}
      <select
        value={value}
        onChange={(e) => {
          if (mayNavigate()) onChange(e.target.value);
        }}
      >
        {!rows.length && <option value="">ไม่มีข้อมูล</option>}
        {rows.map((x) => (
          <option key={x.id} value={x.id}>
            {displayName(x)}
            {x.verification === "sample-unverified"
              ? " (sample-unverified)"
              : ""}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <>
      <div className="location-selectors">
        {select("กรม", agencies, a, (v) => {
          setAgency(v);
          setBuilding("");
          setFloor("");
          setDivision("");
          setRoom("");
          setArea("");
        })}
        {select("อาคาร", buildings, b, (v) => {
          setBuilding(v);
          setFloor("");
          setRoom("");
          setArea("");
        })}
        {select("ชั้น", floors, f, (v) => {
          setFloor(v);
          setRoom("");
          setArea("");
        })}
        {select("กองงาน", divisions, d, (v) => {
          setDivision(v);
          setRoom("");
          setArea("");
        })}
        {select("ห้อง", rooms, r, (v) => {
          setRoom(v);
          setArea("");
        })}
        <label>
          พื้นที่
          <select
            value={area}
            onChange={(e) => {
              if (mayNavigate()) setArea(e.target.value);
            }}
          >
            <option value="">ผังใหญ่ทั้งหมด</option>
            {areas.map((x) => (
              <option key={x.id} value={x.id}>
                {displayName(x)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {children ? (
        children(r, area, setArea)
      ) : (
        <div className="panel empty">เลือกพื้นที่เพื่อเปิดผัง 2D</div>
      )}
    </>
  );
}
function HistoryPage({
  data,
  user,
  includeSample,
}: {
  data: Data;
  user: User;
  includeSample: boolean;
}) {
  const movements = data.asset_movements.filter(
    (m) =>
      includeSample ||
      data.assets.some((a) => a.id === m.asset_id && !a.is_sample),
  );
  const [logs, setLogs] = useState<RecordRow[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    if (!user.is_demo)
      void api<RecordRow[]>("/audit")
        .then(setLogs)
        .catch((e) => setError(e.message));
  }, [user]);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>การโอนและประวัติการเปลี่ยนแปลง</h2>
          <p>แสดงประวัติล่าสุดสูงสุด 500 รายการ</p>
        </div>
        <button
          onClick={() =>
            download(
              "movements.csv",
              csv(movements, [
                "asset_id",
                "from_area_id",
                "to_area_id",
                "from_person_id",
                "to_person_id",
                "reason",
                "created_at",
              ]),
            )
          }
        >
          ส่งออก CSV
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>เวลาที่โอน</th>
              <th>เลขทะเบียน</th>
              <th>พื้นที่ปลายทาง</th>
              <th>ผู้รับผิดชอบใหม่</th>
              <th>เหตุผล</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id}>
                <td>{thaiDate(m.created_at)}</td>
                <td className="mono">
                  {String(
                    data.assets.find((a) => a.id === m.asset_id)
                      ?.asset_number || m.asset_id,
                  )}
                </td>
                <td>
                  {String(
                    data.areas.find((a) => a.id === m.to_area_id)?.name ||
                      "ไม่ระบุ",
                  )}
                </td>
                <td>
                  {data.personnel.find((p) => p.id === m.to_person_id)
                    ? displayName(
                        data.personnel.find((p) => p.id === m.to_person_id)!,
                      )
                    : "ไม่ระบุ"}
                </td>
                <td>{String(m.reason)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!movements.length && <p className="empty">ไม่มีการโอนในตัวกรองนี้</p>}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>ผู้ดำเนินการ</th>
              <th>การเปลี่ยนแปลง</th>
              <th>ข้อมูล</th>
              <th>รหัส</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{thaiDate(l.created_at)}</td>
                <td>{String(l.actor)}</td>
                <td>
                  {(
                    {
                      create: "สร้าง",
                      update: "แก้ไข",
                      delete: "ลบ",
                      transfer: "โอน",
                      draft: "บันทึกร่าง",
                      publish: "เผยแพร่",
                      import: "นำเข้า",
                      purge_sample: "ล้างตัวอย่าง",
                    } as Record<string, string>
                  )[String(l.action)] || String(l.action)}
                </td>
                <td>{entityNames[String(l.entity)] || String(l.entity)}</td>
                <td className="mono">{String(l.entity_id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length && (
          <div className="empty">
            {user.is_demo
              ? "บัญชีตัวอย่างไม่เข้าถึงประวัติข้อมูลจริง"
              : "ยังไม่มีประวัติ"}
          </div>
        )}
      </div>
    </section>
  );
}
function SettingsPage({
  user,
  notify,
}: {
  user: User;
  notify: (s: string) => void;
}) {
  const [settings, setSettings] = useState<{
    users: RecordRow[];
    sync: RecordRow[];
    googleConfigured: boolean;
  } | null>(null);
  const load = () =>
    api<NonNullable<typeof settings>>("/settings")
      .then(setSettings)
      .catch((e) => notify(e.message));
  useEffect(() => {
    if (user.role === "admin") void load();
  }, [user.role]);
  if (user.role !== "admin")
    return <div className="panel empty">ส่วนนี้สำหรับผู้ดูแลระบบ</div>;
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>สิทธิ์และการสำรองข้อมูล</h2>
        <button
          onClick={() =>
            void api("/backup")
              .then((b) =>
                download(
                  "asset-export.json",
                  JSON.stringify(b, null, 2),
                  "application/json",
                ),
              )
              .catch((e) => notify(e.message))
          }
        >
          ส่งออกข้อมูล JSON
        </button>
      </div>
      <div className="settings-body">
        <h3>บัญชีผู้ใช้งาน</h3>
        {settings?.users.map((u) => (
          <div className="account-row" key={u.id}>
            {String(u.username)} <span className="badge">{String(u.role)}</span>
            <select
              aria-label={`สิทธิ์ ${u.username}`}
              value={String(u.role)}
              disabled={u.id === user.id || Boolean(u.is_demo)}
              onChange={async (e) => {
                try {
                  await api(`/users/${u.id}`, "PUT", {
                    role: e.target.value,
                    active: u.active,
                  });
                  await load();
                  notify("เปลี่ยนสิทธิ์แล้ว");
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              {["viewer", "editor", "auditor", "admin"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
            <label className="check">
              <input
                type="checkbox"
                checked={Boolean(u.active)}
                disabled={u.id === user.id}
                onChange={async (e) => {
                  try {
                    await api(`/users/${u.id}`, "PUT", {
                      role: u.role,
                      active: e.target.checked,
                    });
                    await load();
                    notify("เปลี่ยนสถานะบัญชีแล้ว");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              />{" "}
              เปิดใช้งาน
            </label>
          </div>
        ))}
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              fd = new FormData(form);
            try {
              await api("/users", "POST", Object.fromEntries(fd));
              form.reset();
              await load();
              notify("สร้างบัญชีแล้ว");
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        >
          <input
            name="username"
            placeholder="ชื่อผู้ใช้ใหม่"
            required
            minLength={3}
          />
          <input
            name="password"
            type="password"
            placeholder="รหัสผ่านอย่างน้อย 12 ตัว"
            required
            minLength={12}
          />
          <select name="role">
            {["viewer", "editor", "auditor", "admin"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <button className="primary">สร้างบัญชี</button>
        </form>
        <h3>Google Sheets</h3>
        <button
          onClick={async () => {
            try {
              await api("/sheets/sync", "POST");
              await load();
              notify("ซิงก์ Google Sheets แล้ว");
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        >
          ซิงก์ตอนนี้
        </button>
        {settings?.sync.map((s) => (
          <p key={s.id}>
            {s.synced_at
              ? `ซิงก์ล่าสุด ${thaiDate(s.synced_at)}`
              : "ยังไม่มีการซิงก์อัตโนมัติ"}{" "}
            • {s.pending ? "มีข้อมูลรอซิงก์" : "ข้อมูลล่าสุด"}
            {Boolean(s.last_error) && (
              <span className="error">{String(s.last_error)}</span>
            )}
          </p>
        ))}
        <p>
          {settings?.googleConfigured
            ? "ตั้งค่า credentials แล้ว"
            : "ยังไม่ได้ตั้งค่า service account สำหรับซิงก์อัตโนมัติ"}
        </p>
        <p className="muted">
          ข้อมูลทะเบียนหลักอยู่ใน PostgreSQL •
          ชีตเป็นสำเนาที่อัปเดตผ่านเซิร์ฟเวอร์
        </p>
        <h3>สำรองและกู้คืน</h3>
        <p>
          JSON เป็นไฟล์ส่งออกข้อมูล
          สำหรับสำรองทั้งระบบให้ปิดเซิร์ฟเวอร์แล้วใช้คำสั่งสำรองตาม README หรือ
          pg_dump เมื่อใช้ PostgreSQL Server
        </p>
        <h3>ล้างข้อมูลตัวอย่าง</h3>
        <p>
          ลบเฉพาะ SAMPLE และบล็อกทั้งชุดหากเชื่อมกับข้อมูลจริง เก็บ audit ไว้
          สำรองข้อมูลก่อนใช้
        </p>
        <button
          onClick={async () => {
            const confirmation = prompt(
              "พิมพ์ DELETE SAMPLE เพื่อยืนยันล้างข้อมูลตัวอย่าง (กู้คืนได้จาก backup เท่านั้น)",
            );
            if (confirmation !== "DELETE SAMPLE") return;
            try {
              await api("/sample/cleanup", "POST", { confirmation });
              location.reload();
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        >
          ล้าง SAMPLE ที่ไม่มีความเชื่อมโยงจริง
        </button>
      </div>
    </section>
  );
}
