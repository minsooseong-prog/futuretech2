import "server-only";
import { createClient } from "@supabase/supabase-js";
import { and, eq, lt, ne, or, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "./db";
import {
  media,
  storageJobs,
  users,
  sessions,
  rateLimits,
  postViews,
} from "./db/schema";
import { assert } from "./errors";
export const bucket = () =>
  process.env.SUPABASE_STORAGE_BUCKET || "future-tech-private";
export function storage() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Storage configuration missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(bucket());
}
export async function enqueueRemoval(
  tx: Tx,
  files: { path: string; thumbnailPath: string }[],
) {
  const rows = files.flatMap((m) => [
    { path: m.path },
    { path: m.thumbnailPath },
  ]);
  if (rows.length)
    await tx.insert(storageJobs).values(rows).onConflictDoNothing();
}
// Removing references + enqueueing paths is one DB transaction. Storage failures are retryable.
export async function cleanStorage(limit = 100) {
  const stale = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db().transaction(async (tx) => {
    const unused = await tx
      .select()
      .from(media)
      .where(and(ne(media.status, "attached"), lt(media.createdAt, stale)))
      .for("update", { skipLocked: true })
      .limit(limit);
    await enqueueRemoval(tx, unused);
    if (unused.length)
      await tx.delete(media).where(
        inArray(
          media.id,
          unused.map((m) => m.id),
        ),
      );
  });
  const jobs = await db()
    .select()
    .from(storageJobs)
    .where(lt(storageJobs.createdAt, new Date(Date.now() - 10 * 60 * 1000)))
    .orderBy(storageJobs.createdAt)
    .limit(limit);
  let removed = 0;
  if (jobs.length) {
    const { error } = await storage().remove(jobs.map((j) => j.path));
    if (error) {
      await db()
        .update(storageJobs)
        .set({ attempts: sql`${storageJobs.attempts}+1` })
        .where(
          inArray(
            storageJobs.id,
            jobs.map((j) => j.id),
          ),
        );
    } else {
      await db()
        .delete(storageJobs)
        .where(
          inArray(
            storageJobs.id,
            jobs.map((j) => j.id),
          ),
        );
      removed = jobs.length;
    }
  }
  await db().delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db().delete(rateLimits).where(lt(rateLimits.resetAt, new Date()));
  await db()
    .delete(postViews)
    .where(lt(postViews.day, stale.toISOString().slice(0, 10)));
  return { processed: jobs.length, removed, pending: jobs.length - removed };
}
export async function lockActor(
  tx: Tx,
  userId: string,
  allowPasswordChange = false,
) {
  const [user] = await tx
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .for("update");
  assert(user, "계정이 존재하지 않습니다.", 401);
  assert(
    allowPasswordChange || !user.mustChangePassword,
    "초기 비밀번호를 설정에서 먼저 변경해 주세요.",
    403,
  );
  return user;
}
