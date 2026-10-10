import "server-only";
import { requireUser } from "./auth";
import {
  and,
  eq,
  desc,
  asc,
  ilike,
  or,
  gte,
  lte,
  sql,
  inArray,
} from "drizzle-orm";
import { db } from "./db";
import * as s from "./db/schema";
export const PAGE_SIZE = 20;
const author = {
  id: s.users.id,
  name: s.users.name,
  role: s.users.role,
  grade: s.users.grade,
  classNumber: s.users.classNumber,
  studentNumber: s.users.studentNumber,
};
export function searchPattern(q: string) {
  return `%${q.slice(0, 100).replace(/[\\%_]/g, "\\$&")}%`;
}
export async function listEntries(
  kind: s.Entry["kind"],
  options: {
    q?: string;
    category?: string;
    page?: number;
    authorId?: string;
    limit?: number;
  } = {},
) {
  await requireUser();
  const filters = [eq(s.entries.kind, kind)];
  if (options.q)
    filters.push(
      or(
        ilike(s.entries.title, searchPattern(options.q)),
        ilike(s.entries.content, searchPattern(options.q)),
      )!,
    );
  if (options.category) filters.push(eq(s.entries.category, options.category));
  if (options.authorId) filters.push(eq(s.entries.authorId, options.authorId));
  return db()
    .select({ entry: s.entries, author, avatarId: s.profiles.avatarId })
    .from(s.entries)
    .innerJoin(s.users, eq(s.entries.authorId, s.users.id))
    .leftJoin(s.profiles, eq(s.profiles.userId, s.users.id))
    .where(and(...filters))
    .orderBy(
      desc(s.entries.pinned),
      desc(s.entries.createdAt),
      desc(s.entries.id),
    )
    .limit(options.limit || PAGE_SIZE + 1)
    .offset(((options.page || 1) - 1) * PAGE_SIZE);
}
export async function getEntry(id: string) {
  await requireUser();
  const [row] = await db()
    .select({ entry: s.entries, author, avatarId: s.profiles.avatarId })
    .from(s.entries)
    .innerJoin(s.users, eq(s.entries.authorId, s.users.id))
    .leftJoin(s.profiles, eq(s.profiles.userId, s.users.id))
    .where(eq(s.entries.id, id));
  return row;
}
export async function entryMedia(ids: string[]) {
  await requireUser();
  if (!ids.length) return [];
  return db()
    .select({
      id: s.media.id,
      entryId: s.media.entryId,
      sortOrder: s.media.sortOrder,
    })
    .from(s.media)
    .where(and(inArray(s.media.entryId, ids), eq(s.media.status, "attached")))
    .orderBy(asc(s.media.sortOrder));
}
export async function entryComments(id: string) {
  await requireUser();
  return db()
    .select({ comment: s.comments, author, avatarId: s.profiles.avatarId })
    .from(s.comments)
    .innerJoin(s.users, eq(s.comments.authorId, s.users.id))
    .leftJoin(s.profiles, eq(s.profiles.userId, s.users.id))
    .where(eq(s.comments.entryId, id))
    .orderBy(asc(s.comments.createdAt));
}
export async function directory(q = "") {
  await requireUser();
  return db()
    .select({
      user: author,
      bio: s.profiles.bio,
      avatarId: s.profiles.avatarId,
    })
    .from(s.users)
    .leftJoin(s.profiles, eq(s.profiles.userId, s.users.id))
    .where(q ? ilike(s.users.name, searchPattern(q)) : undefined)
    .orderBy(
      asc(s.users.grade),
      asc(s.users.classNumber),
      asc(s.users.studentNumber),
    );
}
export async function getProfile(id: string) {
  await requireUser();
  const [row] = await db()
    .select({
      user: author,
      bio: s.profiles.bio,
      avatarId: s.profiles.avatarId,
      createdAt: s.users.createdAt,
    })
    .from(s.users)
    .leftJoin(s.profiles, eq(s.profiles.userId, s.users.id))
    .where(eq(s.users.id, id));
  return row;
}
export async function userTheme(id: string) {
  await requireUser();
  const [row] = await db()
    .select()
    .from(s.preferences)
    .where(eq(s.preferences.userId, id));
  return row?.theme || "light";
}
export async function upcoming() {
  await requireUser();
  return db()
    .select()
    .from(s.events)
    .where(gte(s.events.endDate, new Date()))
    .orderBy(asc(s.events.startDate))
    .limit(6);
}
export async function calendarEvents(start: Date, end: Date) {
  await requireUser();
  return db()
    .select()
    .from(s.events)
    .where(and(lte(s.events.startDate, end), gte(s.events.endDate, start)))
    .orderBy(asc(s.events.startDate));
}
