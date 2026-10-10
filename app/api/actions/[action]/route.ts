import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import {
  checkOrigin,
  clientIp,
  throttle,
  requireApiUser,
  setSession,
  clearSession,
  logout,
} from "@/lib/auth";
import * as service from "@/lib/service";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(request);
    if (Number(request.headers.get("content-length") || 0) > 100000)
      throw new AppError("요청이 너무 큽니다.", 413);
    const { action } = await params;
    const raw = await request.text();
    if (raw.length > 100000) throw new AppError("요청이 너무 큽니다.", 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AppError("잘못된 요청입니다.");
    }
    if (action === "register" || action === "login") {
      await throttle(`auth-ip:${clientIp(request)}`, 50);
      const session = await service[action](body);
      await setSession(session);
      return NextResponse.json({ redirect: "/home" });
    }
    const user = await requireApiUser();
    await throttle(`write:${user.id}`, 180, 60);
    if (action === "logout") {
      await logout();
      return NextResponse.json({ redirect: "/login" });
    }
    const actions = {
      "entry-save": service.saveEntry,
      "entry-delete": service.deleteEntry,
      "comment-save": service.saveComment,
      "comment-delete": service.deleteComment,
      "profile-save": service.saveProfile,
      "event-save": service.saveEvent,
      "event-delete": service.deleteEvent,
      "password-change": service.changePassword,
      theme: service.saveTheme,
      "admin-settings": service.adminSettings,
      role: service.setRole,
      graduate: service.graduate,
      view: service.recordView,
    };
    const handler = actions[action as keyof typeof actions];
    if (!handler) throw new AppError("요청을 찾을 수 없습니다.", 404);
    const result = await handler(user, body);
    if (action === "graduate" || action === "password-change")
      await clearSession();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: /[가-힣]/.test(error.issues[0]?.message || "")
            ? error.issues[0].message
            : "입력값을 확인해 주세요.",
        },
        { status: 400 },
      );
    if (error instanceof AppError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    console.error(
      "Action failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { error: "처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
