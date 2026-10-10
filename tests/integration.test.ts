import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { compare, hash } from "bcryptjs";
import * as schema from "../lib/db/schema";
const state = vi.hoisted(() => ({
  database: null as unknown,
  jar: new Map<string, string>(),
  cloud: new Map<string, Uint8Array>(),
  failUpload: false,
}));
vi.mock("../lib/db", () => ({ db: () => state.database }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) =>
      state.jar.has(k) ? { value: state.jar.get(k) } : undefined,
    set: (k: string, v: string) => state.jar.set(k, v),
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Uint8Array) => {
          if (state.failUpload) return { error: new Error("Storage offline") };
          state.cloud.set(path, bytes);
          return { error: null };
        },
        download: async (path: string) => ({
          data: state.cloud.has(path)
            ? new Blob([new Uint8Array(state.cloud.get(path)!)])
            : null,
          error: null,
        }),
        remove: async (paths: string[]) => {
          paths.forEach((p) => state.cloud.delete(p));
          return { error: null };
        },
      }),
    },
  }),
}));
import sharp from "sharp";
import { POST as upload } from "../app/api/upload/route";
import { GET as getMedia } from "../app/api/media/[id]/route";
import { cleanStorage } from "../lib/storage";
import * as services from "../lib/service";
import { currentUser, setSession, digest, throttle } from "../lib/auth";
import { POST } from "../app/api/actions/[action]/route";
const pg = new PGlite();
const db = drizzle(pg, { schema });
let student: schema.User, other: schema.User, admin: schema.User;
const pw = "valid-password-123";
beforeAll(async () => {
  process.env.SESSION_SECRET =
    "integration-test-only-secret-at-least-32-characters";
  process.env.APP_URL = "http://localhost:3000";
  delete process.env.REGISTRATION_CODE;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-not-a-real-key";
  state.database = db;
  for (const file of readdirSync("drizzle")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  await services.register({
    name: "학생 A",
    studentId: "20208",
    password: pw,
    confirm: pw,
  });
  await services.register({
    name: "학생 B",
    studentId: "30109",
    password: pw,
    confirm: pw,
  });
  [student, other] = await Promise.all([
    db
      .select()
      .from(schema.users)
      .where(eq(schema.users.studentId, "20208"))
      .then((r) => r[0]),
    db
      .select()
      .from(schema.users)
      .where(eq(schema.users.studentId, "30109"))
      .then((r) => r[0]),
  ]);
  [admin] = await db
    .insert(schema.users)
    .values({
      studentId: "00000",
      name: "N",
      role: "admin",
      passwordHash: await hash("NNNNN", 4),
    })
    .returning();
  await db
    .insert(schema.siteSettings)
    .values({
      id: 1,
      noticePasswordHash: await hash("00000", 4),
      calendarPasswordHash: await hash("00000", 4),
    });
});
afterAll(async () => {
  await pg.close();
});
beforeEach(() => {
  state.jar.clear();
});
async function request(
  name: string,
  body: unknown,
  origin = "http://localhost:3000",
) {
  return POST(
    new Request(`http://localhost:3000/api/actions/${name}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action: name }) },
  );
}
describe("PostgreSQL-backed workflows", () => {
  it("hashes passwords, parses IDs, and rejects duplicate IDs", async () => {
    expect(student.grade).toBe(2);
    expect(student.classNumber).toBe(2);
    expect(student.studentNumber).toBe(8);
    expect(student.passwordHash).not.toBe(pw);
    expect(await compare(pw, student.passwordHash)).toBe(true);
    await expect(
      services.register({
        name: "중복",
        studentId: "20208",
        password: pw,
        confirm: pw,
      }),
    ).rejects.toThrow("이미");
  });
  it("enforces name + student ID login and stores only a token digest", async () => {
    await expect(
      services.login({ name: "다른 이름", studentId: "20208", password: pw }),
    ).rejects.toThrow();
    const session = await services.login({
      name: student.name,
      studentId: student.studentId,
      password: pw,
    });
    await setSession(session);
    expect((await currentUser())?.id).toBe(student.id);
    const [stored] = await db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.tokenHash, digest(session.token)));
    expect(stored.tokenHash).not.toBe(session.token);
  });
  it("rejects cross-origin writes and unauthenticated writes", async () => {
    expect(
      (await request("entry-save", {}, "https://evil.example")).status,
    ).toBe(403);
    expect((await request("entry-save", {})).status).toBe(401);
  });
  it("supports API registration/login and hides sensitive fields", async () => {
    const response = await request("login", {
      name: student.name,
      studentId: student.studentId,
      password: pw,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirect: "/home" });
    expect((await currentUser())?.id).toBe(student.id);
  });
  it("blocks editing/deleting another author's entry and comment", async () => {
    const result = await services.saveEntry(student, {
      kind: "board",
      title: "로봇 설계",
      content: "질문입니다.",
    });
    const id = result.redirect.split("/").pop()!;
    await expect(
      services.saveEntry(other, {
        id,
        kind: "board",
        title: "변조",
        content: "내용",
      }),
    ).rejects.toThrow("작성자");
    await expect(services.deleteEntry(other, { id })).rejects.toThrow("권한");
    await services.saveComment(other, {
      entryId: id,
      content: "함께 고민해요.",
    });
    const [comment] = await db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.entryId, id));
    await expect(
      services.deleteComment(student, { id: comment.id }),
    ).rejects.toThrow("권한");
    await services.deleteComment(other, { id: comment.id });
    await services.deleteEntry(admin, { id });
    expect(
      await db.select().from(schema.entries).where(eq(schema.entries.id, id)),
    ).toHaveLength(0);
  });
  it("rejects stolen media IDs and allows valid album attachments", async () => {
    const id = randomUUID();
    await db
      .insert(schema.media)
      .values({
        id,
        ownerId: student.id,
        purpose: "album",
        status: "ready",
        path: `album/${id}.webp`,
        thumbnailPath: `album/${id}-thumb.webp`,
      });
    await expect(
      services.saveEntry(other, {
        kind: "album",
        title: "훔친 사진",
        content: "내용",
        mediaIds: [id],
      }),
    ).rejects.toThrow("첨부");
    const result = await services.saveEntry(student, {
      kind: "album",
      title: "현장 체험",
      content: "기록",
      mediaIds: [id],
    });
    const [attached] = await db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, id));
    expect(attached.status).toBe("attached");
    await services.deleteEntry(student, {
      id: result.redirect.split("/").pop(),
    });
    expect(
      await db
        .select()
        .from(schema.storageJobs)
        .where(eq(schema.storageJobs.path, attached.path)),
    ).toHaveLength(1);
  });
  it("verifies notice/calendar passwords on the server and bypasses only admins", async () => {
    await expect(
      services.saveEntry(student, {
        kind: "notice",
        title: "공지",
        content: "내용",
        gatePassword: "wrong",
      }),
    ).rejects.toThrow("비밀번호");
    await services.saveEntry(student, {
      kind: "notice",
      title: "공지",
      content: "내용",
      gatePassword: "00000",
    });
    await services.saveEntry(admin, {
      kind: "notice",
      title: "관리자 공지",
      content: "내용",
    });
    await expect(
      services.saveEvent(student, {
        title: "수업",
        startDate: "2026-10-10T09:00:00+09:00",
        endDate: "2026-10-10T10:00:00+09:00",
        allDay: false,
        gatePassword: "wrong",
      }),
    ).rejects.toThrow();
    await services.saveEvent(admin, {
      title: "수업",
      startDate: "2026-10-10T09:00:00+09:00",
      endDate: "2026-10-10T10:00:00+09:00",
      allDay: false,
    });
  });
  it("persists preferences and enforces admin role assignment", async () => {
    await services.saveTheme(student, { theme: "dark" });
    expect(
      (
        await db
          .select()
          .from(schema.preferences)
          .where(eq(schema.preferences.userId, student.id))
      )[0].theme,
    ).toBe("dark");
    await expect(
      services.setRole(student, { userId: other.id, role: "teacher" }),
    ).rejects.toThrow("관리자");
    await services.setRole(admin, { userId: other.id, role: "teacher" });
    expect(
      (
        await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, other.id))
      )[0].role,
    ).toBe("teacher");
  });
  it("deduplicates board views per user per Korean day", async () => {
    const result = await services.saveEntry(student, {
      kind: "board",
      title: "조회",
      content: "내용",
    });
    const id = result.redirect.split("/").pop()!;
    await services.recordView(student, { id });
    await services.recordView(student, { id });
    expect(
      (
        await db.select().from(schema.entries).where(eq(schema.entries.id, id))
      )[0].views,
    ).toBe(1);
  });
  it("revokes every session after password change", async () => {
    const session = await services.login({
      name: other.name,
      studentId: other.studentId,
      password: pw,
    });
    await setSession(session);
    await services.changePassword(other, {
      current: pw,
      password: "new-password-456",
      confirm: "new-password-456",
    });
    expect(await currentUser()).toBeNull();
    expect(
      await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, other.id)),
    ).toHaveLength(0);
  });
  it("re-encodes actual images, protects media reads, and attaches avatars", async () => {
    const token = await services.login({
      name: student.name,
      studentId: student.studentId,
      password: pw,
    });
    await setSession(token);
    const png = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 3,
        background: { r: 100, g: 140, b: 60 },
      },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set("purpose", "avatar");
    form.set(
      "file",
      new Blob([new Uint8Array(png)], { type: "image/png" }),
      "photo.png",
    );
    const response = await upload(
      new Request("http://localhost:3000/api/upload", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: form,
      }),
    );
    expect(response.status).toBe(200);
    const { id } = await response.json();
    const [file] = await db
      .select()
      .from(schema.media)
      .where(eq(schema.media.id, id));
    const metadata = await sharp(state.cloud.get(file.path)!).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBeLessThanOrEqual(512);
    expect(metadata.exif).toBeUndefined();
    await services.saveProfile(student, {
      bio: "미래를 만드는 중",
      avatarId: id,
    });
    const args = { params: Promise.resolve({ id }) };
    const result = await getMedia(
      new Request(`http://localhost:3000/api/media/${id}`),
      args,
    );
    expect(result.status).toBe(200);
    expect(result.headers.get("Cache-Control")).toBe("private, no-store");
    state.jar.clear();
    expect(
      (
        await getMedia(
          new Request(`http://localhost:3000/api/media/${id}`),
          args,
        )
      ).status,
    ).toBe(401);
  });
  it("rolls back failed upload metadata and durably queues leftover files", async () => {
    const token = await services.login({
      name: student.name,
      studentId: student.studentId,
      password: pw,
    });
    await setSession(token);
    state.failUpload = true;
    const png = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "white" },
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.set("purpose", "album");
    form.set(
      "file",
      new Blob([new Uint8Array(png)], { type: "image/png" }),
      "photo.png",
    );
    const result = await upload(
      new Request("http://localhost:3000/api/upload", {
        method: "POST",
        headers: { origin: "http://localhost:3000" },
        body: form,
      }),
    );
    state.failUpload = false;
    expect(result.status).toBe(500);
    expect(
      await db
        .select()
        .from(schema.media)
        .where(eq(schema.media.status, "pending")),
    ).toHaveLength(0);
    expect((await db.select().from(schema.storageJobs)).length).toBeGreaterThan(
      0,
    );
  });
  it("keeps private pending uploads inaccessible to other members", async () => {
    const id = randomUUID();
    await db
      .insert(schema.media)
      .values({
        id,
        ownerId: student.id,
        purpose: "profile",
        status: "ready",
        path: `profile/${id}.webp`,
        thumbnailPath: `profile/${id}-thumb.webp`,
      });
    const token = await services.login({
      name: other.name,
      studentId: other.studentId,
      password: "new-password-456",
    });
    await setSession(token);
    expect(
      (
        await getMedia(new Request(`http://localhost:3000/api/media/${id}`), {
          params: Promise.resolve({ id }),
        })
      ).status,
    ).toBe(404);
  });
  it("atomically graduates an account and retains only the alumni name/date", async () => {
    const session = await services.login({
      name: student.name,
      studentId: student.studentId,
      password: pw,
    });
    await setSession(session);
    await expect(
      services.graduate(student, {
        password: pw,
        confirm: "wrong",
        phrase: "학교를 졸업하겠습니다",
      }),
    ).rejects.toThrow();
    expect(
      await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, student.id)),
    ).toHaveLength(1);
    await services.graduate(student, {
      password: pw,
      confirm: pw,
      phrase: "학교를 졸업하겠습니다",
    });
    expect(await currentUser()).toBeNull();
    for (const table of [schema.entries, schema.comments])
      expect(
        await db.select().from(table).where(eq(table.authorId, student.id)),
      ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.media)
        .where(eq(schema.media.ownerId, student.id)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, student.id)),
    ).toHaveLength(0);
    const [a] = await db.select().from(schema.alumni);
    expect(a.name).toBe(student.name);
    expect(Object.keys(a).sort()).toEqual(["graduatedAt", "id", "name"]);
  });
  it("retries delayed storage deletion jobs and clears them on success", async () => {
    await db
      .update(schema.storageJobs)
      .set({ createdAt: new Date(Date.now() - 3600000) });
    const result = await cleanStorage(100);
    expect(result.pending).toBe(0);
    expect(await db.select().from(schema.storageJobs)).toHaveLength(0);
    expect(state.cloud.size).toBe(0);
  });
  it("rate limits persist in PostgreSQL", async () => {
    await throttle("test-rate", 1, 60);
    await expect(throttle("test-rate", 1, 60)).rejects.toThrow("요청이 너무");
  });
});
