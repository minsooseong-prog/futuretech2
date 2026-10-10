import { z } from "zod";
export const uuid = z.uuid();
export const name = z.string().trim().min(1, "이름을 입력하세요.").max(40);
export const password = z
  .string()
  .min(10, "비밀번호는 10자 이상 입력하세요.")
  .max(64)
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "비밀번호는 UTF-8 72바이트 이내여야 합니다.",
  );
export const oldPassword = z
  .string()
  .min(1)
  .max(72)
  .refine((v) => new TextEncoder().encode(v).length <= 72);
export const studentId = z
  .string()
  .regex(/^[1-3][0-9]{4}$/, "학번은 1~3학년으로 시작하는 숫자 5자리입니다.")
  .refine(
    (v) => Number(v.slice(1, 3)) > 0 && Number(v.slice(3)) > 0,
    "반과 번호는 1 이상이어야 합니다.",
  );
export const loginSchema = z.object({
  name,
  studentId: z.string().regex(/^\d{5}$/),
  password: oldPassword,
});
export const registerSchema = z
  .object({
    name,
    studentId,
    password,
    confirm: z.string(),
    inviteCode: z.string().max(200).optional(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "비밀번호가 일치하지 않습니다.",
  });
export const categories = [
  "자유",
  "질문",
  "정보",
  "잡담",
  "사진",
  "과제",
  "기타",
] as const;
export const entrySchema = z
  .object({
    id: uuid.optional(),
    kind: z.enum(["board", "album", "notice", "profile"]),
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().min(1).max(20000),
    category: z.enum(categories).default("자유"),
    pinned: z.boolean().default(false),
    mediaIds: z.array(uuid).max(10).default([]),
    gatePassword: z.string().max(72).optional(),
  })
  .refine((v) => new Set(v.mediaIds).size === v.mediaIds.length, {
    message: "중복 사진은 첨부할 수 없습니다.",
  });
export const eventSchema = z
  .object({
    id: uuid.optional(),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().max(3000).default(""),
    startDate: z.iso.datetime({ offset: true }),
    endDate: z.iso.datetime({ offset: true }),
    allDay: z.boolean(),
    gatePassword: z.string().max(72).optional(),
  })
  .refine((v) => new Date(v.endDate) >= new Date(v.startDate), {
    message: "종료일은 시작일 이후여야 합니다.",
  });
export const graduationSchema = z.object({
  password: oldPassword,
  confirm: oldPassword,
  phrase: z.literal("학교를 졸업하겠습니다"),
});
export function parseStudentId(id: string) {
  studentId.parse(id);
  return {
    grade: Number(id[0]),
    classNumber: Number(id.slice(1, 3)),
    studentNumber: Number(id.slice(3)),
  };
}
