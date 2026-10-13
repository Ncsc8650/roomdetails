import { GoogleAuth } from "google-auth-library";
import { type Db, type Row } from "./db";
import { exportTables } from "../../../db/seed";
let running = false;
type Sheet = {
  properties: {
    sheetId: number;
    title: string;
    gridProperties: { rowCount: number; columnCount: number };
  };
};
export function cells(values: unknown[]) {
  return values.map((v) => ({
    userEnteredValue:
      typeof v === "boolean"
        ? { boolValue: v }
        : typeof v === "number"
          ? { numberValue: v }
          : {
              stringValue:
                v == null
                  ? ""
                  : v instanceof Date
                    ? v.toISOString()
                    : typeof v === "object"
                      ? JSON.stringify(v)
                      : String(v),
            },
  }));
}
export async function syncSheets(db: Db) {
  if (running) return { busy: true };
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS)
    throw Error("ยังไม่ได้ตั้งค่า GOOGLE_APPLICATION_CREDENTIALS");
  running = true;
  try {
    const auth = new GoogleAuth({
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      }),
      client = await auth.getClient();
    const id = process.env.GOOGLE_SPREADSHEET_ID;
    if (!id || !/^[-\w]+$/.test(id))
      throw Error("GOOGLE_SPREADSHEET_ID ไม่ถูกต้อง");
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${id}`;
    const meta = await client.request<{ sheets: Sheet[] }>({
      url,
      params: { fields: "sheets.properties" },
    });
    // Keep the snapshot and watermark consistent; later writes remain pending.
    const snap = await db.transaction(async (tx) => {
      await tx.exec("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      const [watermark] = await tx.query(
        "SELECT count(*)::int AS count FROM audit_logs",
      );
      const tables: Record<string, { headers: string[]; rows: Row[] }> = {};
      for (const table of exportTables) {
        const cols = await tx.query(
          "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",
          [table],
        );
        tables[table] = {
          headers: cols.map((c) => String(c.column_name)),
          rows: await tx.query(`SELECT * FROM ${table} ORDER BY id`),
        };
      }
      return { tables, watermark: watermark.count };
    });
    const requests: Row[] = [];
    let nextId =
      Math.max(...meta.data.sheets.map((s) => s.properties.sheetId), 0) + 1;
    for (const [name, { headers, rows }] of Object.entries(snap.tables)) {
      const existing = meta.data.sheets.find(
        (s) => s.properties.title === name,
      );
      const sheetId = existing?.properties.sheetId ?? nextId++;
      if (!existing)
        requests.push({
          addSheet: {
            properties: {
              sheetId,
              title: name,
              gridProperties: {
                rowCount: Math.max(1000, rows.length + 1),
                columnCount: Math.max(26, headers.length),
                frozenRowCount: 1,
              },
            },
          },
        });
      else if (
        existing.properties.gridProperties.rowCount < rows.length + 1 ||
        existing.properties.gridProperties.columnCount < headers.length
      )
        requests.push({
          updateSheetProperties: {
            properties: {
              sheetId,
              gridProperties: {
                rowCount: Math.max(
                  existing.properties.gridProperties.rowCount,
                  rows.length + 1,
                ),
                columnCount: Math.max(
                  existing.properties.gridProperties.columnCount,
                  headers.length,
                ),
              },
            },
            fields: "gridProperties.rowCount,gridProperties.columnCount",
          },
        });
      // Clearing trailing values and writing the current snapshot is a single atomic batch.
      requests.push({
        updateCells: {
          range: {
            sheetId,
            startRowIndex: 0,
            endRowIndex: Math.max(
              existing?.properties.gridProperties.rowCount || 1000,
              rows.length + 1,
            ),
            startColumnIndex: 0,
            endColumnIndex: headers.length,
          },
          rows: [
            { values: cells(headers) },
            ...rows.map((r) => ({ values: cells(headers.map((k) => r[k])) })),
          ],
          fields: "userEnteredValue",
        },
      });
    }
    await client.request({
      url: url + ":batchUpdate",
      method: "POST",
      data: { requests },
    });
    await db.query(
      "UPDATE sync_state SET synced_at=now(),last_error=NULL,pending=((SELECT count(*) FROM audit_logs)<>$1) WHERE id='google_sheets'",
      [snap.watermark],
    );
    return { ok: true, tables: exportTables.length };
  } catch (e) {
    await db.query(
      "UPDATE sync_state SET last_error=$1,pending=true WHERE id='google_sheets'",
      [(e as Error).message.slice(0, 1000)],
    );
    throw e;
  } finally {
    running = false;
  }
}
