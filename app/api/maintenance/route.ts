import { secretMatches } from "@/lib/auth";
import { cleanStorage } from "@/lib/storage";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret ||
    !secretMatches(
      request.headers.get("authorization") || "",
      `Bearer ${secret}`,
    )
  )
    return new Response(null, { status: 401 });
  return Response.json(await cleanStorage(1000));
}
