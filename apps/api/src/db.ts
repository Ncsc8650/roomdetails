import "dotenv/config";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleLite } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { userAccounts } from "./orm";
import { readFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
export type Row = Record<string, unknown>;
export interface Db {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  userByName(username: string): Promise<Row | undefined>;
}
export async function openDb(path?: string): Promise<Db> {
  if (!path && process.env.DATABASE_URL) {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    const wrap = (client: pg.Pool | pg.PoolClient): Db => ({
      userByName: async (username) =>
        (
          await drizzlePg(client)
            .select()
            .from(userAccounts)
            .where(eq(userAccounts.username, username))
        )[0],
      query: async <T extends Row>(sql: string, params?: unknown[]) =>
        (await client.query(sql, params)).rows as T[],
      exec: async (sql) => {
        await client.query(sql);
      },
      close: async () => {
        await pool.end();
      },
      transaction: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query("BEGIN");
          const r = await fn(wrap(c));
          await c.query("COMMIT");
          return r;
        } catch (e) {
          await c.query("ROLLBACK");
          throw e;
        } finally {
          c.release();
        }
      },
    });
    return wrap(pool);
  }
  const directory =
    path === ":memory:"
      ? undefined
      : path || process.env.DATA_DIR || "./data/postgres";
  if (directory) await mkdir(dirname(resolve(directory)), { recursive: true });
  const p = new PGlite(directory);
  await p.waitReady;
  const wrap = (client: Pick<PGlite, "query" | "exec">): Db => ({
    userByName: async (username) =>
      (
        await drizzleLite(p)
          .select()
          .from(userAccounts)
          .where(eq(userAccounts.username, username))
      )[0],
    query: async <T extends Row>(sql: string, params?: unknown[]) =>
      (await client.query<T>(sql, params)).rows,
    exec: async (sql) => {
      await client.exec(sql);
    },
    transaction: (fn) => p.transaction((tx) => fn(wrap(tx))),
    close: () => p.close(),
  });
  return wrap(p);
}
export async function migrate(db: Db) {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  for (const name of [
    "001_initial",
    "002_published_snapshot",
    "003_source_import",
  ]) {
    const version = name.slice(0, 3);
    if (
      !(
        await db.query(
          "SELECT version FROM schema_migrations WHERE version=$1",
          [version],
        )
      ).length
    ) {
      const source = await readFile(
        resolve(`db/migrations/${name}.sql`),
        "utf8",
      );
      await db.transaction(async (tx) => {
        await tx.exec(source);
        await tx.query("INSERT INTO schema_migrations(version) VALUES($1)", [
          version,
        ]);
      });
    }
  }
}
export async function insert(db: Db, table: string, row: Row) {
  const keys = Object.keys(row);
  if (!/^[a-z_]+$/.test(table) || keys.some((k) => !/^\w+$/.test(k)))
    throw Error("Invalid identifier");
  return (
    await db.query(
      `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING *`,
      keys.map((k) => row[k]),
    )
  )[0];
}
