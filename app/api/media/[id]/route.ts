import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { currentUser } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { uuid } from "@/lib/validation";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  if (!uuid.safeParse(id).success) return new Response(null, { status: 404 });
  const [m] = await db().select().from(media).where(eq(media.id, id));
  if (
    !m ||
    m.status === "pending" ||
    (m.status !== "attached" && m.ownerId !== user.id)
  )
    return new Response(null, { status: 404 });
  const path =
    new URL(request.url).searchParams.get("size") === "full"
      ? m.path
      : m.thumbnailPath;
  const { data, error } = await storage().download(path);
  if (error || !data) return new Response(null, { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
