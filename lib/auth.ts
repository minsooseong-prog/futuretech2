import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, type Tx } from "./db";
import { users, sessions, rateLimits } from "./db/schema";
import { AppError, assert } from "./errors";
export const cookieName =
  process.env.NODE_ENV === "production" ? "__Host-ft-session" : "ft-session";
export function digest(value: string) {
  const key = process.env.SESSION_SECRET;
  if (!key || key.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return createHmac("sha256", key).update(value).digest("hex");
}
export function secretMatches(a: string, b: string) {
  const x = Buffer.from(digest(a)),
    y = Buffer.from(digest(b));
  return timingSafeEqual(x, y);
}
export const currentUser = cache(async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const [row] = await db()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, digest(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row?.user ?? null;
});
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireApiUser() {
  const user = await currentUser();
  if (!user) throw new AppError("로그인이 필요합니다.", 401);
  return user;
}
export async function newSession(tx: Tx, userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await tx
    .insert(sessions)
    .values({ tokenHash: digest(token), userId, expiresAt: expires });
  return { token, expires };
}
export async function setSession(session: { token: string; expires: Date }) {
  (await cookies()).set(cookieName, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expires,
  });
}
export async function clearSession() {
  (await cookies()).set(cookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
export async function logout() {
  const token = (await cookies()).get(cookieName)?.value;
  if (token)
    await db()
      .delete(sessions)
      .where(eq(sessions.tokenHash, digest(token)));
  await clearSession();
}
export async function throttle(key: string, limit = 10, seconds = 900) {
  const hashed = digest(key),
    now = new Date(),
    reset = new Date(Date.now() + seconds * 1000);
  const [row] = await db()
    .insert(rateLimits)
    .values({ key: hashed, count: 1, resetAt: reset })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.resetAt} <= ${now} then 1 else ${rateLimits.count}+1 end`,
        resetAt: sql`case when ${rateLimits.resetAt} <= ${now} then ${reset} else ${rateLimits.resetAt} end`,
      },
    })
    .returning();
  assert(
    row.count <= limit,
    "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    429,
  );
}
export function checkOrigin(request: Request) {
  const expected = process.env.APP_URL;
  assert(expected, "사이트 주소 설정이 필요합니다.", 503);
  const origin = request.headers.get("origin");
  assert(origin === new URL(expected).origin, "허용되지 않은 요청입니다.", 403);
}
export function clientIp(request: Request) {
  return process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
    : "local";
}
