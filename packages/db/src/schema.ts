import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  real,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Enums
export const scanStatusEnum = pgEnum("scan_status", [
  "queued",
  "crawling",
  "scanning",
  "triaging",
  "done",
  "failed",
]);

export const severityEnum = pgEnum("severity", [
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

export const findingStatusEnum = pgEnum("finding_status", [
  "open",
  "fixed",
  "accepted",
  "regressed",
]);

export const verdictEnum = pgEnum("ai_verdict", [
  "true_positive",
  "false_positive",
  "needs_review",
]);

// 2. Targets (websites you own and have verified)
export const targets = pgTable("targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: text("org_id").notNull(),
  baseUrl: text("base_url").notNull().unique(),
  verified: boolean("verified").default(false),
  verifyToken: text("verify_token").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. Scans (individual scan runs)
export const scans = pgTable("scans", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetId: uuid("target_id")
    .notNull()
    .references(() => targets.id, { onDelete: "cascade" }),
  status: scanStatusEnum("status").notNull().default("queued"),
  profile: text("profile").default("safe"),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  screenshot: text("screenshot"), // <-- ADDED: Stores the Base64 image string
  createdAt: timestamp("created_at").defaultNow(),
});

// 4. Findings (the actual vulnerabilities/bugs found)
export const findings = pgTable("findings", {
  id: uuid("id").primaryKey().defaultRandom(),
  scanId: uuid("scan_id")
    .notNull()
    .references(() => scans.id, { onDelete: "cascade" }),
  fingerprint: text("fingerprint").notNull(),
  source: text("source").notNull(),
  cwe: text("cwe"),
  title: text("title").notNull(),
  severity: severityEnum("severity").notNull(),
  url: text("url"),
  evidence: jsonb("evidence"),
  aiVerdict: verdictEnum("ai_verdict"),
  aiConfidence: real("ai_confidence"),
  fixGuide: jsonb("fix_guide"),
  status: findingStatusEnum("status").default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 5. Relations (for easy querying)
export const targetsRelations = relations(targets, ({ many }) => ({
  scans: many(scans),
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  target: one(targets, {
    fields: [scans.targetId],
    references: [targets.id],
  }),
  findings: many(findings),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  scan: one(scans, {
    fields: [findings.scanId],
    references: [scans.id],
  }),
}));