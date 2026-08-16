import {
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
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
  // Optional link to the project this walkthrough belongs to. Null for the
  // original standalone-walkthrough flow, which still works unchanged.
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
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

// ---------------------------------------------------------------------------
// Daily Report System
//
// Hierarchy: contractors (company/owner) → clients → projects → daily reports.
// Larger commercial projects can also break down into rooms/areas, and
// multiple contractors can be attached to a project with a role that governs
// whether they can edit reports or only view them.
// ---------------------------------------------------------------------------

// owner/foreman can edit reports; gc (general contractor) and client are
// view-only. See lib/project-access.ts for the edit/view rules.
export const projectRole = pgEnum("project_role", [
  "owner",
  "foreman",
  "gc",
  "client",
]);

export const jobType = pgEnum("project_job_type", ["commercial", "residential"]);

export const reportStatus = pgEnum("daily_report_status", [
  "draft",
  "completed",
]);

// A client belongs to one contractor (the company that owns the account).
export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id")
    .notNull()
    .references(() => contractors.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// A project (job site). latitude/longitude are geocoded from siteAddress at
// creation time and reused for automated weather on every daily report.
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id")
    .notNull()
    .references(() => contractors.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  siteAddress: text("site_address"),
  jobType: jobType("job_type").notNull().default("commercial"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Which contractors are attached to a project and in what role. The creator
// is inserted as "owner". Access checks read this table.
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "cascade" }),
    role: projectRole("role").notNull().default("foreman"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.projectId, t.contractorId)],
);

// Optional sub-level for larger commercial jobs: rooms/areas within a project.
// Workforce rows and photos on a report can be grouped by area.
export const projectAreas = pgTable("project_areas", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Company-wide crew list — the source for the workforce dropdown. Members can
// also be scoped to a single project (projectId set); a null projectId means
// the person is available on every project for that contractor.
export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  contractorId: uuid("contractor_id")
    .notNull()
    .references(() => contractors.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  trade: text("trade"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Customizable activity-type list for the workforce table's activity dropdown
// (Framing, Supervision, Demo, ...). Seeded with defaults on first use.
export const activityTypes = pgTable(
  "activity_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    contractorId: uuid("contractor_id")
      .notNull()
      .references(() => contractors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.contractorId, t.name)],
);

// One daily report per project per day (soft, not enforced). The structured
// body (workforce/equipment/events/observations) and the auto-pulled weather
// are stored as JSONB — see lib/dailyReport.ts and lib/weather.ts for shapes.
export const dailyReports = pgTable("daily_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => contractors.id, { onDelete: "cascade" }),
  reportDate: date("report_date").notNull(),
  status: reportStatus("status").notNull().default("draft"),
  // Snapshotted from the project at creation so the report reads correctly even
  // if the project's job type changes later; still editable per report.
  jobType: jobType("job_type").notNull().default("commercial"),
  reporterName: text("reporter_name"),
  generalContractor: text("general_contractor"),
  reviewerName: text("reviewer_name"),
  body: jsonb("body"),
  weather: jsonb("weather"),
  shareToken: text("share_token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Photos attached to a daily report, optionally grouped by area.
export const reportPhotos = pgTable("report_photos", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => dailyReports.id, { onDelete: "cascade" }),
  areaId: uuid("area_id").references(() => projectAreas.id, {
    onDelete: "set null",
  }),
  blobUrl: text("blob_url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Threaded comments on a published report — GC/client feedback. parentId set
// makes a comment a reply to another comment (one level of threading).
export const reportComments = pgTable("report_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id")
    .notNull()
    .references(() => dailyReports.id, { onDelete: "cascade" }),
  contractorId: uuid("contractor_id")
    .notNull()
    .references(() => contractors.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id"),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// Plan Takeoff / Estimate (Part 2)
//
// A plan is an uploaded architectural drawing (PDF or image) attached to a
// project. The user picks a scale, then traces walls/segments; each trace is
// stored as a measurement with its pixel points and computed real-world length.
// ---------------------------------------------------------------------------

export const plans = pgTable("plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  createdById: uuid("created_by_id")
    .notNull()
    .references(() => contractors.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  blobUrl: text("blob_url").notNull(),
  fileType: text("file_type").notNull(), // "pdf" | "image"
  // Selected architectural scale, stored as real-world feet per pixel plus the
  // human-readable label the user picked (e.g. "1/4\"=1'").
  scaleLabel: text("scale_label"),
  feetPerPixel: real("feet_per_pixel"),
  // The rendered pixel width the scale was calibrated against, so measurements
  // stay correct if the viewer re-renders the page at a different resolution.
  renderWidth: integer("render_width"),
  pageNumber: integer("page_number").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const measurements = pgTable("measurements", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id")
    .notNull()
    .references(() => plans.id, { onDelete: "cascade" }),
  label: text("label"),
  // Ordered list of {x, y} points in the plan's calibrated pixel space
  // (normalized to renderWidth). A segment has 2 points; a polyline has more.
  points: jsonb("points").notNull(),
  // Computed real-world length in feet at save time.
  lengthFeet: real("length_feet"),
  isClosed: boolean("is_closed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
