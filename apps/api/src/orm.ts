import { pgTable, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
// Typed Drizzle mapping for security-sensitive identity queries. Domain writes use
// parameterized SQL so identical PostgreSQL constraints run in PGlite and pg.
export const userAccounts = pgTable("user_accounts", {
  id: text().primaryKey(),
  username: text().notNull(),
  password_hash: text().notNull(),
  role: text().notNull(),
  active: boolean().notNull(),
  is_demo: boolean().notNull(),
});
export const auditLogs = pgTable("audit_logs", {
  id: text().primaryKey(),
  actor: text().notNull(),
  action: text().notNull(),
  entity: text().notNull(),
  entity_id: text().notNull(),
  before_data: jsonb(),
  after_data: jsonb(),
  created_at: timestamp({ withTimezone: true }).notNull(),
});
