import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
const time = (name: string) =>
  timestamp(name, { withTimezone: true }).notNull().defaultNow();
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    studentId: varchar("student_id", { length: 5 }).notNull().unique(),
    name: varchar({ length: 40 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text({ enum: ["student", "teacher", "admin"] })
      .notNull()
      .default("student"),
    grade: integer(),
    classNumber: integer("class_number"),
    studentNumber: integer("student_number"),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [
    index("users_directory_idx").on(t.role, t.grade, t.name),
    check("users_role_check", sql`${t.role} in ('student','teacher','admin')`),
    check("student_id_check", sql`${t.studentId} ~ '^[0-9]{5}$'`),
  ],
);
export const profiles = pgTable("user_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  bio: varchar({ length: 300 }).notNull().default(""),
  avatarId: uuid("avatar_id"),
  updatedAt: time("updated_at"),
});
export const preferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text({ enum: ["light", "dark"] })
    .notNull()
    .default("light"),
});
export const entries = pgTable(
  "entries",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: text({ enum: ["board", "album", "notice", "profile"] }).notNull(),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar({ length: 120 }).notNull(),
    content: text().notNull(),
    category: varchar({ length: 10 }).notNull().default("자유"),
    pinned: boolean().notNull().default(false),
    views: integer().notNull().default(0),
    createdAt: time("created_at"),
    updatedAt: time("updated_at"),
  },
  (t) => [
    index("entries_feed_idx").on(t.kind, t.createdAt),
    index("entries_author_idx").on(t.authorId),
    check(
      "entry_kind_check",
      sql`${t.kind} in ('board','album','notice','profile')`,
    ),
  ],
);
export const media = pgTable(
  "media",
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    entryId: uuid("entry_id").references(() => entries.id, {
      onDelete: "cascade",
    }),
    purpose: text({ enum: ["avatar", "board", "album", "profile"] }).notNull(),
    path: text().notNull().unique(),
    thumbnailPath: text("thumbnail_path").notNull().unique(),
    status: text({ enum: ["pending", "ready", "attached"] })
      .notNull()
      .default("pending"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: time("created_at"),
  },
  (t) => [
    index("media_entry_idx").on(t.entryId),
    index("media_owner_idx").on(t.ownerId),
    index("media_cleanup_idx").on(t.status, t.createdAt),
  ],
);
export const comments = pgTable(
  "comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: varchar({ length: 2000 }).notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    index("comments_entry_idx").on(t.entryId),
    index("comments_author_idx").on(t.authorId),
  ],
);
export const events = pgTable(
  "calendar_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    title: varchar({ length: 120 }).notNull(),
    description: varchar({ length: 3000 }).notNull().default(""),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: time("created_at"),
  },
  (t) => [
    index("events_start_idx").on(t.startDate),
    check("event_date_check", sql`${t.endDate} >= ${t.startDate}`),
  ],
);
export const siteSettings = pgTable(
  "site_settings",
  {
    id: integer().primaryKey().default(1),
    noticePasswordHash: text("notice_password_hash").notNull(),
    calendarPasswordHash: text("calendar_password_hash").notNull(),
    updatedAt: time("updated_at"),
  },
  (t) => [check("single_settings_row", sql`${t.id} = 1`)],
);
export const alumni = pgTable("alumni", {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 40 }).notNull(),
  graduatedAt: time("graduated_at"),
});
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: time("created_at"),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId),
    index("sessions_expiry_idx").on(t.expiresAt),
  ],
);
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().primaryKey(),
    count: integer().notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_expiry_idx").on(t.resetAt)],
);
// Durable outbox: no user FK so deletion jobs survive account deletion.
export const storageJobs = pgTable("storage_jobs", {
  id: uuid().primaryKey().defaultRandom(),
  path: text().notNull().unique(),
  createdAt: time("created_at"),
  attempts: integer().notNull().default(0),
});
export const postViews = pgTable(
  "post_views",
  {
    id: uuid().primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: varchar({ length: 10 }).notNull(),
  },
  (t) => [uniqueIndex("post_view_once_idx").on(t.entryId, t.userId, t.day)],
);
export type User = typeof users.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Media = typeof media.$inferSelect;
