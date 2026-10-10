import { NextResponse } from "next/server";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { checkOrigin, requireApiUser, throttle } from "@/lib/auth";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { storage, lockActor, enqueueRemoval } from "@/lib/storage";
import { assert, AppError } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let saved: { id: string; path: string; thumbnailPath: string } | undefined;
  try {
    checkOrigin(request);
    const user = await requireApiUser();
    await throttle(`upload:${user.id}`, 40, 3600);
    assert(
      !user.mustChangePassword,
      "초기 비밀번호를 먼저 변경해 주세요.",
      403,
    );
    assert(
      Number(request.headers.get("content-length") || 0) <= 3500000,
      "사진 용량이 너무 큽니다.",
      413,
    );
    const form = await request.formData(),
      file = form.get("file"),
      purpose = form.get("purpose");
    assert(
      file instanceof File && file.size > 0 && file.size <= 3000000,
      "3MB 이하의 사진을 선택하세요.",
    );
    assert(
      ["avatar", "board", "album", "profile"].includes(String(purpose)),
      "잘못된 사진 종류입니다.",
    );
    const source = Buffer.from(await file.arrayBuffer());
    const processor = sharp(source, {
      limitInputPixels: 40000000,
      animated: false,
    });
    const meta = await processor.metadata();
    assert(
      ["jpeg", "png", "webp"].includes(meta.format || ""),
      "JPG, PNG, WebP 사진만 지원합니다.",
    );
    const full = await processor
      .rotate()
      .resize({
        width: purpose === "avatar" ? 512 : 1920,
        height: purpose === "avatar" ? 512 : 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();
    const thumb = await sharp(full)
      .resize({
        width: 480,
        height: 480,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 75 })
      .toBuffer();
    const id = randomUUID(),
      path = `${purpose}/${user.id}/${id}.webp`,
      thumbnailPath = `${purpose}/${user.id}/${id}-thumb.webp`;
    // Record the pending allocation before touching Storage, so interrupted uploads are collectable.
    await db().transaction(async (tx) => {
      await lockActor(tx, user.id);
      await tx
        .insert(media)
        .values({
          id,
          ownerId: user.id,
          purpose: purpose as "avatar" | "board" | "album" | "profile",
          path,
          thumbnailPath,
        });
    });
    saved = { id, path, thumbnailPath };
    for (const [key, buffer] of [
      [path, full],
      [thumbnailPath, thumb],
    ] as const) {
      const { error } = await storage().upload(key, buffer, {
        contentType: "image/webp",
        upsert: false,
        cacheControl: "0",
      });
      if (error) throw error;
    }
    await db().transaction(async (tx) => {
      await lockActor(tx, user.id);
      const rows = await tx
        .update(media)
        .set({ status: "ready" })
        .where(eq(media.id, id))
        .returning();
      assert(rows.length, "계정 상태가 변경되었습니다.");
    });
    return NextResponse.json({ id });
  } catch (error) {
    if (saved) {
      const allocation = saved;
      try {
        await db().transaction(async (tx) => {
          await enqueueRemoval(tx, [allocation]);
          await tx.delete(media).where(eq(media.id, allocation.id));
        });
      } catch {
        /* Pending allocation remains for scheduled collection. */
      }
    }
    return NextResponse.json(
      {
        error:
          error instanceof AppError
            ? error.message
            : "사진을 업로드하지 못했습니다. JPG 또는 PNG로 다시 시도해 주세요.",
      },
      { status: error instanceof AppError ? error.status : 500 },
    );
  }
}
