import {
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const jobStatus = pgEnum("job_status", [
  "recording",
  "uploading",
  "processing",
  "ready",
  "failed",
]);

// One row per signed-up user. This is the lead-gen table the GHL CRM
// sync will read later — keep fields flat and human-readable.
export const contractors = pgTable("contractors", {
  id: uuid("id").defaultRandom().primaryKey(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  businessName: text("business_name").notNull(),
  tradeType: text("trade_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// One row per walkthrough. transcript holds Whisper's timestamped
// segments; report holds Claude's structured output.
export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id")
    .notNull()
    .references(() => contractors.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  clientName: text("client_name"),
  address: text("address"),
  status: jobStatus("status").notNull().default("recording"),
  audioUrl: text("audio_url"),
  audioDurationSeconds: real("audio_duration_seconds"),
  transcript: jsonb("transcript"),
  report: jsonb("report"),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// offsetSeconds = seconds from recording start when the photo was taken;
// this is what gets matched against transcript segment timestamps.
export const photos = pgTable("photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  offsetSeconds: real("offset_seconds").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
