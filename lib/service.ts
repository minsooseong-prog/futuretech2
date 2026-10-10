import "server-only";
import { compare, hash } from "bcryptjs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import * as s from "./db/schema";
import { assert } from "./errors";
import * as v from "./validation";
import { newSession, secretMatches, throttle } from "./auth";
import { enqueueRemoval, lockActor } from "./storage";
import { entryUrl } from "./format";
const DUMMY_HASH =
  "$2b$12$C6UzMDM.H6dfI/f/IKcEe.2yE6ikdL.dDE5KLLo19zGx/AvE0kQ6W";
export async function register(data: unknown) {
  const d = v.registerSchema.parse(data);
  if (process.env.REGISTRATION_CODE)
    assert(
      secretMatches(d.inviteCode || "", process.env.REGISTRATION_CODE),
      "초대 코드가 올바르지 않습니다.",
    );
  const passwordHash = await hash(d.password, 12);
  return db().transaction(async (tx) => {
    const [user] = await tx
      .insert(s.users)
      .values({
        name: d.name,
        studentId: d.studentId,
        passwordHash,
        ...v.parseStudentId(d.studentId),
      })
      .onConflictDoNothing()
      .returning();
    assert(user, "이미 사용 중인 학번입니다.", 409);
    await tx.insert(s.profiles).values({ userId: user.id });
    await tx.insert(s.preferences).values({ userId: user.id });
    return newSession(tx, user.id);
  });
}
export async function login(data: unknown) {
  const d = v.loginSchema.parse(data);
  await throttle(`login:${d.studentId}`, 10);
  const [user] = await db()
    .select()
    .from(s.users)
    .where(eq(s.users.studentId, d.studentId));
  const valid = await compare(d.password, user?.passwordHash || DUMMY_HASH);
  assert(
    user && valid && user.name === d.name,
    "이름, 학번 또는 비밀번호가 올바르지 않습니다.",
    401,
  );
  return db().transaction(async (tx) => {
    const locked = await lockActor(tx, user.id, true);
    assert(
      locked.passwordHash === user.passwordHash,
      "다시 로그인해 주세요.",
      401,
    );
    return newSession(tx, user.id);
  });
}
export async function verifyGate(
  user: s.User,
  kind: "notice" | "calendar",
  password: string | undefined,
) {
  if (user.role === "admin") return;
  await throttle(`gate:${kind}:${user.id}`, 5);
  const [settings] = await db()
    .select()
    .from(s.siteSettings)
    .where(eq(s.siteSettings.id, 1));
  assert(settings, "초기 설정이 필요합니다.", 503);
  assert(
    await compare(
      password || "",
      kind === "notice"
        ? settings.noticePasswordHash
        : settings.calendarPasswordHash,
    ),
    "작성 비밀번호가 올바르지 않습니다.",
    403,
  );
}
export async function saveEntry(user: s.User, input: unknown) {
  const d = v.entrySchema.parse(input);
  if (d.kind === "notice") await verifyGate(user, "notice", d.gatePassword);
  assert(
    d.kind !== "album" || d.mediaIds.length > 0,
    "앨범에는 사진을 한 장 이상 첨부하세요.",
  );
  assert(
    d.kind !== "notice" || d.mediaIds.length === 0,
    "공지에는 사진을 첨부할 수 없습니다.",
  );
  return db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id);
    if (d.id) {
      const [old] = await tx
        .select()
        .from(s.entries)
        .where(eq(s.entries.id, d.id))
        .for("update");
      assert(old && old.kind === d.kind, "게시물을 찾을 수 없습니다.", 404);
      assert(old.authorId === actor.id, "작성자만 수정할 수 있습니다.", 403);
    }
    const uploads = d.mediaIds.length
      ? await tx
          .select()
          .from(s.media)
          .where(inArray(s.media.id, d.mediaIds))
          .for("update")
      : [];
    assert(
      uploads.length === d.mediaIds.length &&
        uploads.every(
          (m) =>
            m.ownerId === actor.id &&
            m.purpose === d.kind &&
            ((m.status === "ready" && !m.entryId) ||
              (m.status === "attached" && m.entryId === d.id)),
        ),
      "사용할 수 없는 첨부 사진입니다.",
      403,
    );
    const values = {
      title: d.title,
      content: d.content,
      category: d.category,
      pinned: d.kind === "notice" ? d.pinned : false,
      updatedAt: new Date(),
    };
    const [entry] = d.id
      ? await tx
          .update(s.entries)
          .set(values)
          .where(eq(s.entries.id, d.id))
          .returning()
      : await tx
          .insert(s.entries)
          .values({ ...values, kind: d.kind, authorId: actor.id })
          .returning();
    const previous = await tx
      .select()
      .from(s.media)
      .where(eq(s.media.entryId, entry.id));
    const removed = previous.filter((m) => !d.mediaIds.includes(m.id));
    await enqueueRemoval(tx, removed);
    if (removed.length)
      await tx.delete(s.media).where(
        inArray(
          s.media.id,
          removed.map((m) => m.id),
        ),
      );
    for (const [i, id] of d.mediaIds.entries())
      await tx
        .update(s.media)
        .set({ entryId: entry.id, status: "attached", sortOrder: i })
        .where(eq(s.media.id, id));
    return { redirect: entryUrl(entry) };
  });
}
export async function deleteEntry(user: s.User, input: unknown) {
  const { id } = z.object({ id: v.uuid }).parse(input);
  return db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id);
    const [e] = await tx
      .select()
      .from(s.entries)
      .where(eq(s.entries.id, id))
      .for("update");
    assert(e, "게시물을 찾을 수 없습니다.", 404);
    assert(
      e.authorId === actor.id || actor.role === "admin",
      "삭제 권한이 없습니다.",
      403,
    );
    await enqueueRemoval(
      tx,
      await tx.select().from(s.media).where(eq(s.media.entryId, id)),
    );
    await tx.delete(s.entries).where(eq(s.entries.id, id));
    return {
      redirect:
        e.kind === "profile"
          ? `/profile/${e.authorId}`
          : `/${e.kind === "notice" ? "notices" : e.kind}`,
    };
  });
}
export async function saveComment(user: s.User, input: unknown) {
  const d = z
    .object({ entryId: v.uuid, content: z.string().trim().min(1).max(2000) })
    .parse(input);
  await db().transaction(async (tx) => {
    await lockActor(tx, user.id);
    const [e] = await tx
      .select()
      .from(s.entries)
      .where(eq(s.entries.id, d.entryId));
    assert(e?.kind === "board", "댓글을 작성할 수 없습니다.", 404);
    await tx.insert(s.comments).values({ ...d, authorId: user.id });
  });
  return {};
}
export async function deleteComment(user: s.User, input: unknown) {
  const { id } = z.object({ id: v.uuid }).parse(input);
  await db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id);
    const [c] = await tx.select().from(s.comments).where(eq(s.comments.id, id));
    assert(
      c && (c.authorId === actor.id || actor.role === "admin"),
      "삭제 권한이 없습니다.",
      403,
    );
    await tx.delete(s.comments).where(eq(s.comments.id, id));
  });
  return {};
}
export async function saveProfile(user: s.User, input: unknown) {
  const d = z
    .object({ bio: z.string().trim().max(300), avatarId: v.uuid.nullable() })
    .parse(input);
  await db().transaction(async (tx) => {
    await lockActor(tx, user.id);
    const [old] = await tx
      .select()
      .from(s.profiles)
      .where(eq(s.profiles.userId, user.id));
    if (d.avatarId !== old.avatarId) {
      if (d.avatarId) {
        const [m] = await tx
          .select()
          .from(s.media)
          .where(eq(s.media.id, d.avatarId))
          .for("update");
        assert(
          m &&
            m.ownerId === user.id &&
            m.purpose === "avatar" &&
            m.status === "ready",
          "사용할 수 없는 프로필 사진입니다.",
          403,
        );
        await tx
          .update(s.media)
          .set({ status: "attached" })
          .where(eq(s.media.id, m.id));
      }
      if (old.avatarId) {
        const files = await tx
          .select()
          .from(s.media)
          .where(eq(s.media.id, old.avatarId));
        await enqueueRemoval(tx, files);
        await tx.delete(s.media).where(eq(s.media.id, old.avatarId));
      }
    }
    await tx
      .update(s.profiles)
      .set({ ...d, updatedAt: new Date() })
      .where(eq(s.profiles.userId, user.id));
  });
  return { redirect: `/profile/${user.id}` };
}
export async function saveEvent(user: s.User, input: unknown) {
  const d = v.eventSchema.parse(input);
  await verifyGate(user, "calendar", d.gatePassword);
  await db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id);
    if (d.id) {
      const [event] = await tx
        .select()
        .from(s.events)
        .where(eq(s.events.id, d.id));
      assert(
        event && (event.createdBy === actor.id || actor.role === "admin"),
        "수정 권한이 없습니다.",
        403,
      );
    }
    const values = {
      title: d.title,
      description: d.description,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      allDay: d.allDay,
    };
    if (d.id)
      await tx.update(s.events).set(values).where(eq(s.events.id, d.id));
    else await tx.insert(s.events).values({ ...values, createdBy: actor.id });
  });
  return {};
}
export async function deleteEvent(user: s.User, input: unknown) {
  const d = z.object({ id: v.uuid }).parse(input);
  await db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id);
    const [e] = await tx.select().from(s.events).where(eq(s.events.id, d.id));
    assert(
      e && (e.createdBy === actor.id || actor.role === "admin"),
      "삭제 권한이 없습니다.",
      403,
    );
    await tx.delete(s.events).where(eq(s.events.id, d.id));
  });
  return {};
}
export async function changePassword(user: s.User, input: unknown) {
  const d = z
    .object({
      current: v.oldPassword,
      password: v.password,
      confirm: z.string(),
    })
    .refine((x) => x.password === x.confirm, {
      message: "비밀번호가 일치하지 않습니다.",
    })
    .parse(input);
  await throttle(`password:${user.id}`, 5);
  const passwordHash = await hash(d.password, 12);
  await db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id, true);
    assert(
      await compare(d.current, actor.passwordHash),
      "현재 비밀번호가 올바르지 않습니다.",
    );
    assert(
      !(await compare(d.password, actor.passwordHash)),
      "다른 새 비밀번호를 입력하세요.",
    );
    await tx
      .update(s.users)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
      .where(eq(s.users.id, user.id));
    await tx.delete(s.sessions).where(eq(s.sessions.userId, user.id));
  });
  return { redirect: "/login?changed=1" };
}
export async function saveTheme(user: s.User, input: unknown) {
  const d = z.object({ theme: z.enum(["light", "dark"]) }).parse(input);
  await db().transaction(async (tx) => {
    await lockActor(tx, user.id, true);
    await tx
      .update(s.preferences)
      .set(d)
      .where(eq(s.preferences.userId, user.id));
  });
  return {};
}
export async function adminSettings(user: s.User, input: unknown) {
  const d = z
    .object({
      kind: z.enum(["notice", "calendar"]),
      password: v.password,
      confirm: z.string(),
    })
    .refine((x) => x.password === x.confirm, {
      message: "비밀번호가 일치하지 않습니다.",
    })
    .parse(input);
  const value = await hash(d.password, 12);
  await db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id);
    assert(actor.role === "admin", "관리자만 변경할 수 있습니다.", 403);
    await tx
      .update(s.siteSettings)
      .set({
        ...(d.kind === "notice"
          ? { noticePasswordHash: value }
          : { calendarPasswordHash: value }),
        updatedAt: new Date(),
      })
      .where(eq(s.siteSettings.id, 1));
  });
  return {};
}
export async function setRole(user: s.User, input: unknown) {
  const d = z
    .object({ userId: v.uuid, role: z.enum(["student", "teacher"]) })
    .parse(input);
  await db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id);
    assert(actor.role === "admin", "관리자만 변경할 수 있습니다.", 403);
    const [target] = await tx
      .select()
      .from(s.users)
      .where(eq(s.users.id, d.userId))
      .for("update");
    assert(
      target && target.role !== "admin",
      "관리자 역할은 변경할 수 없습니다.",
    );
    await tx
      .update(s.users)
      .set({ role: d.role, updatedAt: new Date() })
      .where(eq(s.users.id, d.userId));
  });
  return {};
}
export async function graduate(user: s.User, input: unknown) {
  const d = v.graduationSchema.parse(input);
  await throttle(`graduate:${user.id}`, 5);
  await db().transaction(async (tx) => {
    const actor = await lockActor(tx, user.id);
    assert(actor.role !== "admin", "관리자 계정은 탈퇴할 수 없습니다.");
    const [a, b] = await Promise.all([
      compare(d.password, actor.passwordHash),
      compare(d.confirm, actor.passwordHash),
    ]);
    assert(a && b, "현재 비밀번호가 올바르지 않습니다.");
    await enqueueRemoval(
      tx,
      await tx.select().from(s.media).where(eq(s.media.ownerId, actor.id)),
    );
    await tx.insert(s.alumni).values({ name: actor.name });
    await tx.delete(s.users).where(eq(s.users.id, actor.id));
  });
  return { redirect: "/login?graduated=1" };
}
export async function recordView(user: s.User, input: unknown) {
  const { id } = z.object({ id: v.uuid }).parse(input);
  await db().transaction(async (tx) => {
    await lockActor(tx, user.id, true);
    const [entry] = await tx
      .select()
      .from(s.entries)
      .where(and(eq(s.entries.id, id), eq(s.entries.kind, "board")));
    assert(entry, "게시물을 찾을 수 없습니다.", 404);
    const day = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Seoul",
    }).format(new Date());
    const inserted = await tx
      .insert(s.postViews)
      .values({ entryId: id, userId: user.id, day })
      .onConflictDoNothing()
      .returning();
    if (inserted.length)
      await tx
        .update(s.entries)
        .set({ views: sql`${s.entries.views}+1` })
        .where(eq(s.entries.id, id));
  });
  return {};
}
